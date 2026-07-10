async def build_park_graph(db, park_id: str) -> ParkGraph:
    """Assembles ParkGraph from park_id's grid + latest computed risk heatmap."""