async def generate_route_job(request: RouteRequest, user) -> RouteJobResponse:
    """Validates preconditions, creates a RouteJob record (queued),
    enqueues background job, returns 202 payload."""