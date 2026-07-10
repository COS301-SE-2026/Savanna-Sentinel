from app.workers.celery_app import celery_app


@celery_app.task(name="routes.run_route_planning_job")
async def run_route_planning_job(job_id: str) -> None:
    """Loads ParkGraph, calls plan_routes(), persists however many
    PlannedRoute rows were actually accepted, updates the RouteJobs
    status/num_alternatives_found and marks status='completed'."""