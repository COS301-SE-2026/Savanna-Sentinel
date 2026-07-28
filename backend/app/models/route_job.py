class RouteJob:
    request_id: str
    park_id: str
    status: str #queued | processing | completed | failed
    num_alternatives_requested: int
    num_alternatives_found: int
