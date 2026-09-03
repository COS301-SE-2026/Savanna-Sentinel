import asyncio
from datetime import datetime, timedelta, timezone

from botocore.exceptions import ClientError
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine
from sqlalchemy.pool import NullPool

from app.core.config import settings
from app.repositories import risk_repository
from app.services.risk_model_storage import RiskModelStorage
from app.workers.celery_app import celery_app
from app.workers.ml.explainability import explain_cells
from app.workers.ml.risk_engine import (
    _SIGHTING_LOOKBACK_DAYS,
    build_training_examples,
    compute_cell_features,
    compute_incident_floors,
    load_model,
    score_cells,
    train_model,
)

_FEATURE_LOOKBACK_DAYS = 365
_MIN_TRAINING_EXAMPLES = 20
_engine = create_async_engine(settings.DATABASE_URL, poolclass=NullPool)
_TaskSessionLocal = async_sessionmaker(_engine, expire_on_commit=False)
_storage = RiskModelStorage()


async def _train(
    park_id: str,
    window_start: datetime,
    window_end: datetime,
    triggered_by: str,
) -> dict:
    async with _TaskSessionLocal() as session:
        await risk_repository.persist_grid_cells(session, park_id)
        cells = await risk_repository.get_grid_cells(session, park_id)

        fetch_since = window_start - timedelta(days=_FEATURE_LOOKBACK_DAYS)
        sighting_fetch_since = window_start - timedelta(
            days=_SIGHTING_LOOKBACK_DAYS,
        )
        incidents_by_cell = await risk_repository.fetch_incidents_by_cell(
            session,
            park_id,
            fetch_since,
        )
        patrol_by_cell = await risk_repository.fetch_patrol_tracks_by_cell(
            session,
            park_id,
            fetch_since,
        )
        sightings_by_cell = await risk_repository.fetch_sightings_by_cell(
            session,
            park_id,
            sighting_fetch_since,
        )

        examples = build_training_examples(
            cells,
            incidents_by_cell,
            patrol_by_cell,
            window_start,
            window_end,
            feature_lookback_days=_FEATURE_LOOKBACK_DAYS,
            sightings_by_cell=sightings_by_cell,
        )
        if len(examples) < _MIN_TRAINING_EXAMPLES:
            return {
                "status": "skipped",
                "reason": "insufficient_training_examples",
                "n_examples": len(examples),
            }

        model_bytes, metrics = train_model(examples)

        object_key = _storage.upload_model(park_id, model_bytes)

        try:
            model_id = await risk_repository.save_model_version(
                session,
                park_id,
                object_key,
                triggered_by,
                window_start,
                window_end,
                len(examples),
                metrics,
            )
            await session.commit()
        except IntegrityError:
            await session.rollback()
            try:
                _storage.delete_model(object_key)
            except ClientError:
                pass
            return {
                "status": "failed",
                "reason": "concurrent_training_conflict",
            }

        return {
            "status": "completed",
            "model_id": model_id,
            "metrics": metrics,
            "n_training_examples": len(examples),
        }


@celery_app.task(name="risk.train_model")
def run_risk_training_job(
    park_id: str,
    window_start: str,
    window_end: str,
    triggered_by: str,
) -> dict:
    start_dt = datetime.fromisoformat(window_start)
    end_dt = datetime.fromisoformat(window_end)
    return asyncio.run(_train(park_id, start_dt, end_dt, triggered_by))


async def _score(park_id: str, triggered_manually: bool = False) -> dict:
    async with _TaskSessionLocal() as session:
        active_model = await risk_repository.get_active_model(session, park_id)
        if active_model is None:
            return {"status": "skipped", "reason": "no_active_model"}

        try:
            model_bytes = _storage.download_model(
                active_model.object_storage_key,
            )
        except ClientError as exc:
            if exc.response.get("Error", {}).get("Code") == "NoSuchKey":
                return {"status": "skipped", "reason": "model_artifact_missing"}
            raise
        model = load_model(model_bytes)

        await risk_repository.persist_grid_cells(session, park_id)
        cells = await risk_repository.get_grid_cells(session, park_id)

        reference_time = datetime.now(timezone.utc)
        fetch_since = reference_time - timedelta(days=_FEATURE_LOOKBACK_DAYS)
        sighting_fetch_since = reference_time - timedelta(
            days=_SIGHTING_LOOKBACK_DAYS,
        )
        incidents_by_cell = await risk_repository.fetch_incidents_by_cell(
            session,
            park_id,
            fetch_since,
        )
        patrol_by_cell = await risk_repository.fetch_patrol_tracks_by_cell(
            session,
            park_id,
            fetch_since,
        )
        sightings_by_cell = await risk_repository.fetch_sightings_by_cell(
            session,
            park_id,
            sighting_fetch_since,
        )

        features_per_cell = compute_cell_features(
            cells,
            incidents_by_cell,
            patrol_by_cell,
            reference_time,
            lookback_days=_FEATURE_LOOKBACK_DAYS,
            sightings_by_cell=sightings_by_cell,
        )
        scores = score_cells(model, features_per_cell)
        explanations = explain_cells(model, features_per_cell)

        floors = compute_incident_floors(
            cells,
            incidents_by_cell,
            reference_time,
        )
        for cell_id, model_score in list(scores.items()):
            floor = floors.get(cell_id, 0.0)
            if floor > model_score:
                scores[cell_id] = floor
                explanations[cell_id] = [("recent_incident", 1.0)]

        heatmap_id, computed_at = await risk_repository.save_heatmap_snapshot(
            session,
            active_model.id,
            cells,
            scores,
            features_per_cell,
            explanations,
            time_interval="ad-hoc" if triggered_manually else "6h",
        )
        await session.commit()

        return {
            "status": "completed",
            "heatmap_id": heatmap_id,
            "computed_at": computed_at.isoformat(),
            "n_cells_scored": len(scores),
        }


@celery_app.task(name="risk.score_heatmap")
def run_risk_scoring_job(
    park_id: str,
    triggered_manually: bool = False,
) -> dict:
    return asyncio.run(_score(park_id, triggered_manually))
