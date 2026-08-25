from app.models.risk_job import RiskJob


def test_risk_job_model_declares_expected_columns():
    assert RiskJob.__tablename__ == "risk_jobs"
    assert set(RiskJob.__table__.columns.keys()) == {
        "id",
        "job_type",
        "park_id",
        "triggered_by",
        "created_at",
    }
