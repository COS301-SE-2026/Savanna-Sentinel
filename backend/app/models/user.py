"""User ORM model aligned with the database schema."""

from sqlalchemy import Boolean, DateTime, Enum, String, text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, declarative_base, mapped_column


Base = declarative_base()


class User(Base):
	__tablename__ = "users"

	id: Mapped[object] = mapped_column(UUID(as_uuid=True), primary_key=True, server_default=text("uuid_generate_v4()"))
	username: Mapped[str] = mapped_column(String, unique=True, nullable=False)
	email: Mapped[str] = mapped_column(String, unique=True, nullable=False)
	password_hash: Mapped[str] = mapped_column(String, nullable=False)
	first_name: Mapped[str] = mapped_column(String, nullable=False)
	last_name: Mapped[str] = mapped_column(String, nullable=False)
	role: Mapped[str] = mapped_column(
		Enum("ranger", "analyst", "community_liaison", "admin", name="user_role"),
		nullable=False,
	)
	is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, server_default=text("false"))
	created_at: Mapped[object] = mapped_column(DateTime(timezone=True), nullable=False, server_default=text("now()"))

	@property
	def hashed_password(self) -> str:
		return self.password_hash
