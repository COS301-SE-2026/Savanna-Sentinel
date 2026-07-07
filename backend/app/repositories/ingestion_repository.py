class IngestionRepository:
    def __init__(self, db):
        if db is None:
            raise ValueError(
                "IngestionRepository needs an async database session",
                )
        self.db = db
