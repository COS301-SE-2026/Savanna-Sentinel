from app.models.route_job import RouteJob

def test_route_job_declares_expected_fields():
    assert RouteJob.__annotations__ == {
        "request_id": str,
        "park_id": str,
        "status": str,
        "num_alternatives_requested": int,
        "num_alternatives_found": int,
    }