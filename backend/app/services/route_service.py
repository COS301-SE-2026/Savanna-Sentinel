async def generate_route_job(request: RouteRequest, user) -> RouteJobResponse:
    """Validates preconditions, creates a RouteJob record (queued),
    enqueues background job, returns 202 payload."""

async def get_routes(db, user, request_id=None, park_id=None, page=1, page_size=20):
    """Read path, when request_id is provided also loads and returns
    the RouteJobs status and requested/found counts."""