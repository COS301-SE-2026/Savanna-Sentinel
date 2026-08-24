from backend.app.repositories.comment_repository import CommentRepository


class CommentService:
    def __init__(
        self,
        repo: CommentRepository,
    ):
        self.repo = repo
