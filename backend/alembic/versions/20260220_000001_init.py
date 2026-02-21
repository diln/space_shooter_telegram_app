"""initial schema

Revision ID: 20260220_000001
Revises: None
Create Date: 2026-02-20 00:00:01
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


# revision identifiers, used by Alembic.
revision: str = "20260220_000001"
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


user_status_enum = postgresql.ENUM("NEW", "REQUESTED", "APPROVED", "REJECTED", name="user_status", create_type=False)
join_request_status_enum = postgresql.ENUM(
    "PENDING", "APPROVED", "REJECTED", name="join_request_status", create_type=False
)
difficulty_enum = postgresql.ENUM("easy", "normal", "hard", name="difficulty", create_type=False)


def upgrade() -> None:
    bind = op.get_bind()
    user_status_enum.create(bind, checkfirst=True)
    join_request_status_enum.create(bind, checkfirst=True)
    difficulty_enum.create(bind, checkfirst=True)

    op.create_table(
        "users",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("telegram_id", sa.BigInteger(), nullable=False),
        sa.Column("username", sa.String(length=255), nullable=True),
        sa.Column("first_name", sa.String(length=255), nullable=False),
        sa.Column("last_name", sa.String(length=255), nullable=True),
        sa.Column("photo_url", sa.String(length=1024), nullable=True),
        sa.Column("status", user_status_enum, nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("telegram_id"),
    )
    op.create_index(op.f("ix_users_id"), "users", ["id"], unique=False)
    op.create_index(op.f("ix_users_telegram_id"), "users", ["telegram_id"], unique=True)

    op.create_table(
        "join_requests",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("user_id", sa.Integer(), nullable=False),
        sa.Column("status", join_request_status_enum, nullable=False),
        sa.Column("comment", sa.String(length=1024), nullable=True),
        sa.Column("decision_reason", sa.String(length=1024), nullable=True),
        sa.Column("decided_by_admin_tg_id", sa.BigInteger(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("decided_at", sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_join_requests_user_id"), "join_requests", ["user_id"], unique=False)

    op.create_table(
        "scores",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("user_id", sa.Integer(), nullable=False),
        sa.Column("difficulty", difficulty_enum, nullable=False),
        sa.Column("score", sa.Integer(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_scores_difficulty"), "scores", ["difficulty"], unique=False)
    op.create_index(op.f("ix_scores_user_id"), "scores", ["user_id"], unique=False)


def downgrade() -> None:
    op.drop_index(op.f("ix_scores_user_id"), table_name="scores")
    op.drop_index(op.f("ix_scores_difficulty"), table_name="scores")
    op.drop_table("scores")

    op.drop_index(op.f("ix_join_requests_user_id"), table_name="join_requests")
    op.drop_table("join_requests")

    op.drop_index(op.f("ix_users_telegram_id"), table_name="users")
    op.drop_index(op.f("ix_users_id"), table_name="users")
    op.drop_table("users")

    op.execute("DROP TYPE IF EXISTS difficulty")
    op.execute("DROP TYPE IF EXISTS join_request_status")
    op.execute("DROP TYPE IF EXISTS user_status")
