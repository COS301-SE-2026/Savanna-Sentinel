from backend.app.repositories.comment_repository import CommentRepository


class CommentService:
    def __init__(
        self,
        repo: CommentRepository,
    ):
        self.repo = repo

    async def post_comment(self, user, body, photo_urls, created_at, report_id):
        self.repo.upload_comment(user, body, photo_urls, created_at, report_id)
