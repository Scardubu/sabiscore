"""baseline schema from canonical ORM metadata

Revision ID: 0001_baseline_schema
Revises:
Create Date: 2026-06-27
"""

from __future__ import annotations

from alembic import op

from src.core.database import Base

revision = "0001_baseline_schema"
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    bind = op.get_bind()
    Base.metadata.create_all(bind=bind)


def downgrade() -> None:
    bind = op.get_bind()
    Base.metadata.drop_all(bind=bind)
