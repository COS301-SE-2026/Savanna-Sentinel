from app.repositories.ingestion_repository import IngestionRepository


class IngestionService:
    def __init__ (self, repo: IngestionRepository):
        self.repo = repo
