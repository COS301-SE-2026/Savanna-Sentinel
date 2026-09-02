from app.models.route_job import RouteJob


def test_route_job_model_declares_expected_columns():
    assert RouteJob.__tablename__ == "route_jobs"
    assert set(RouteJob.__table__.columns.keys()) == {
        "id",
        "park_id",
        "requested_by",
        "created_at",
    }
