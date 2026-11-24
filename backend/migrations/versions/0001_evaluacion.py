"""Evaluación (capítulo 3): conjuntos de casos, corridas, resultados y embeddings.

Revision ID: 0001
Revises:
Create Date: 2026-11-24
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op
from pgvector.sqlalchemy import Vector

revision: str = "0001"
down_revision: str | None = None
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.execute("CREATE EXTENSION IF NOT EXISTS vector")

    op.create_table(
        "conjuntos",
        sa.Column("id", sa.Integer, primary_key=True),
        sa.Column("slug", sa.String(40), unique=True),
        sa.Column("nombre", sa.String(80), nullable=False),
        sa.Column("descripcion", sa.Text, nullable=False, server_default=""),
        sa.Column("curado", sa.Boolean, nullable=False, server_default=sa.false()),
        sa.Column("creado", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )
    op.create_table(
        "casos",
        sa.Column("id", sa.Integer, primary_key=True),
        sa.Column("conjunto_id", sa.Integer, sa.ForeignKey("conjuntos.id", ondelete="CASCADE"), nullable=False, index=True),
        sa.Column("orden", sa.Integer, nullable=False),
        sa.Column("pregunta", sa.Text, nullable=False),
        sa.Column("referencia", sa.Text, nullable=False),
    )
    op.create_table(
        "corridas",
        sa.Column("id", sa.Integer, primary_key=True),
        sa.Column("conjunto_id", sa.Integer, sa.ForeignKey("conjuntos.id", ondelete="SET NULL"), index=True),
        sa.Column("conjunto_nombre", sa.String(80), nullable=False),
        sa.Column("modelo", sa.String(120), nullable=False),
        sa.Column("temperatura", sa.Float, nullable=False),
        sa.Column("max_tokens", sa.Integer, nullable=False),
        sa.Column("system", sa.Text),
        sa.Column("modelo_embeddings", sa.String(120)),
        sa.Column("estado", sa.String(20), nullable=False, server_default="corriendo"),
        sa.Column("error", sa.Text),
        sa.Column("agregados", sa.JSON),
        sa.Column("creada", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("terminada", sa.DateTime(timezone=True)),
    )
    op.create_table(
        "resultados",
        sa.Column("id", sa.Integer, primary_key=True),
        sa.Column("corrida_id", sa.Integer, sa.ForeignKey("corridas.id", ondelete="CASCADE"), nullable=False, index=True),
        sa.Column("caso_id", sa.Integer, sa.ForeignKey("casos.id", ondelete="SET NULL")),
        sa.Column("orden", sa.Integer, nullable=False),
        sa.Column("pregunta", sa.Text, nullable=False),
        sa.Column("referencia", sa.Text, nullable=False),
        sa.Column("respuesta", sa.Text, nullable=False),
        sa.Column("exacta", sa.Boolean, nullable=False),
        sa.Column("normalizada", sa.Boolean, nullable=False),
        sa.Column("contiene", sa.Boolean, nullable=False),
        sa.Column("edicion", sa.Float, nullable=False),
        sa.Column("rouge_l", sa.Float, nullable=False),
        sa.Column("bleu", sa.Float, nullable=False),
        sa.Column("semantica", sa.Float),
        sa.Column("perplejidad", sa.Float),
        sa.Column("tokens", sa.Integer),
        sa.Column("latencia", sa.Float, nullable=False),
        sa.Column("embedding", Vector()),
    )
    op.create_table(
        "embeddings",
        sa.Column("id", sa.Integer, primary_key=True),
        sa.Column("modelo", sa.String(120), nullable=False),
        sa.Column("hash", sa.String(64), nullable=False),
        sa.Column("texto", sa.Text, nullable=False),
        sa.Column("vector", Vector(), nullable=False),
        sa.UniqueConstraint("modelo", "hash", name="uq_embedding_modelo_hash"),
    )


def downgrade() -> None:
    for tabla in ("embeddings", "resultados", "corridas", "casos", "conjuntos"):
        op.drop_table(tabla)
