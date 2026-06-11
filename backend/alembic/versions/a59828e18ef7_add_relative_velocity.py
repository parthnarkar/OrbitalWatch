"""add relative_velocity to conjunctions

Revision ID: a59828e18ef7
Revises: 3412cb7b91bb
Create Date: 2026-06-11 19:22:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'a59828e18ef7'
down_revision: Union[str, None] = '3412cb7b91bb'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Add column relative_velocity to conjunctions table with default value
    op.add_column('conjunctions', sa.Column('relative_velocity', sa.Float(), nullable=False, server_default='7.5'))


def downgrade() -> None:
    op.drop_column('conjunctions', 'relative_velocity')
