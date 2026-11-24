"""Tablas de la evaluación.

- Conjunto / Caso:   preguntas con su respuesta de referencia. Los curados vienen
                     con la app (no se editan; se duplican); los demás son del usuario.
- Corrida:           un modelo respondiendo un conjunto, con su configuración.
- Resultado:         una respuesta y sus métricas. Guarda una copia de la pregunta y
                     la referencia, así editar un conjunto no cambia corridas viejas.
- EmbeddingTexto:    caché de embeddings por (modelo, texto): la referencia de un
                     caso se calcula una vez aunque se evalúe muchas veces.
"""

from datetime import datetime

from pgvector.sqlalchemy import Vector
from sqlalchemy import JSON, Boolean, DateTime, Float, ForeignKey, Integer, String, Text, UniqueConstraint, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from ..db import Base


class Conjunto(Base):
    __tablename__ = "conjuntos"

    id: Mapped[int] = mapped_column(primary_key=True)
    slug: Mapped[str | None] = mapped_column(String(40), unique=True)  # solo los curados
    nombre: Mapped[str] = mapped_column(String(80))
    descripcion: Mapped[str] = mapped_column(Text, default="")
    curado: Mapped[bool] = mapped_column(Boolean, default=False)
    creado: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    casos: Mapped[list["Caso"]] = relationship(
        back_populates="conjunto", order_by="Caso.orden", cascade="all, delete-orphan"
    )


class Caso(Base):
    __tablename__ = "casos"

    id: Mapped[int] = mapped_column(primary_key=True)
    conjunto_id: Mapped[int] = mapped_column(ForeignKey("conjuntos.id", ondelete="CASCADE"), index=True)
    orden: Mapped[int] = mapped_column(Integer)
    pregunta: Mapped[str] = mapped_column(Text)
    referencia: Mapped[str] = mapped_column(Text)

    conjunto: Mapped[Conjunto] = relationship(back_populates="casos")


class Corrida(Base):
    __tablename__ = "corridas"

    id: Mapped[int] = mapped_column(primary_key=True)
    conjunto_id: Mapped[int | None] = mapped_column(ForeignKey("conjuntos.id", ondelete="SET NULL"), index=True)
    conjunto_nombre: Mapped[str] = mapped_column(String(80))
    modelo: Mapped[str] = mapped_column(String(120))
    temperatura: Mapped[float] = mapped_column(Float)
    max_tokens: Mapped[int] = mapped_column(Integer)
    system: Mapped[str | None] = mapped_column(Text)
    modelo_embeddings: Mapped[str | None] = mapped_column(String(120))
    estado: Mapped[str] = mapped_column(String(20), default="corriendo")  # corriendo | lista | error | cancelada
    error: Mapped[str | None] = mapped_column(Text)
    agregados: Mapped[dict | None] = mapped_column(JSON)
    creada: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    terminada: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))

    resultados: Mapped[list["Resultado"]] = relationship(
        back_populates="corrida", order_by="Resultado.orden", cascade="all, delete-orphan"
    )


class Resultado(Base):
    __tablename__ = "resultados"

    id: Mapped[int] = mapped_column(primary_key=True)
    corrida_id: Mapped[int] = mapped_column(ForeignKey("corridas.id", ondelete="CASCADE"), index=True)
    caso_id: Mapped[int | None] = mapped_column(ForeignKey("casos.id", ondelete="SET NULL"))
    orden: Mapped[int] = mapped_column(Integer)
    pregunta: Mapped[str] = mapped_column(Text)
    referencia: Mapped[str] = mapped_column(Text)
    respuesta: Mapped[str] = mapped_column(Text)
    exacta: Mapped[bool] = mapped_column(Boolean)
    normalizada: Mapped[bool] = mapped_column(Boolean)
    contiene: Mapped[bool] = mapped_column(Boolean)
    edicion: Mapped[float] = mapped_column(Float)
    rouge_l: Mapped[float] = mapped_column(Float)
    bleu: Mapped[float] = mapped_column(Float)
    semantica: Mapped[float | None] = mapped_column(Float)
    perplejidad: Mapped[float | None] = mapped_column(Float)
    tokens: Mapped[int | None] = mapped_column(Integer)
    latencia: Mapped[float] = mapped_column(Float)
    embedding: Mapped[list[float] | None] = mapped_column(Vector())

    corrida: Mapped[Corrida] = relationship(back_populates="resultados")


class EmbeddingTexto(Base):
    __tablename__ = "embeddings"
    __table_args__ = (UniqueConstraint("modelo", "hash", name="uq_embedding_modelo_hash"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    modelo: Mapped[str] = mapped_column(String(120))
    hash: Mapped[str] = mapped_column(String(64))  # sha256 del texto
    texto: Mapped[str] = mapped_column(Text)
    vector: Mapped[list[float]] = mapped_column(Vector())
