import math

Point = tuple[float, float]


def _offset_from_line(p: Point, a: Point, b: Point) -> float:
    dx, dy = b[0] - a[0], b[1] - a[1]
    length = math.hypot(dx, dy)
    if length == 0:
        return math.hypot(p[0] - a[0], p[1] - a[1])
    t = ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / (length * length)
    t = min(max(t, 0.0), 1.0)
    return math.hypot(p[0] - (a[0] + t * dx), p[1] - (a[1] + t * dy))


def simplify(points: list[Point], tolerance: float) -> list[Point]:
    """Douglas-Peucker: drop points within tolerance of the line they sit on."""
    if len(points) < 3 or tolerance <= 0:
        return list(points)
    keep = [False] * len(points)
    keep[0] = keep[-1] = True
    stack = [(0, len(points) - 1)]
    while stack:
        first, last = stack.pop()
        worst, worst_at = 0.0, None
        for k in range(first + 1, last):
            offset = _offset_from_line(points[k], points[first], points[last])
            if offset > worst:
                worst, worst_at = offset, k
        if worst_at is not None and worst > tolerance:
            keep[worst_at] = True
            stack.extend([(first, worst_at), (worst_at, last)])
    return [p for p, kept in zip(points, keep) if kept]


def _toward(origin: Point, target: Point, distance: float) -> Point:
    length = math.dist(origin, target)
    t = distance / length
    return (
        origin[0] + (target[0] - origin[0]) * t,
        origin[1] + (target[1] - origin[1]) * t,
    )


def round_corners(
    points: list[Point], radius: float, samples: int = 6,
) -> list[Point]:
    """Replace each corner with a curve that starts and ends radius away."""
    if len(points) < 3 or radius <= 0:
        return list(points)
    rounded = [points[0]]
    for before, corner, after in zip(points, points[1:], points[2:]):
        r = min(
            radius,
            math.dist(before, corner) / 2,
            math.dist(corner, after) / 2,
        )
        if r <= 0:
            rounded.append(corner)
            continue
        start = _toward(corner, before, r)
        end = _toward(corner, after, r)
        for step in range(samples + 1):
            t = step / samples
            u = 1 - t
            rounded.append(
                (
                    u * u * start[0] + 2 * u * t * corner[0] + t * t * end[0],
                    u * u * start[1] + 2 * u * t * corner[1] + t * t * end[1],
                ),
            )
    rounded.append(points[-1])
    return rounded


def smooth_route(points: list[Point], cell_size: float) -> list[Point]:
    """Display line for a grid path: straightened, then corners rounded."""
    return round_corners(simplify(points, cell_size / 2), cell_size)
