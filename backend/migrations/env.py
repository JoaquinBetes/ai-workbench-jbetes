"""Entorno de Alembic, asíncrono (asyncpg). La URL es la misma que usa la app."""

import asyncio
from logging.config import fileConfig

from alembic import context
from sqlalchemy.ext.asyncio import create_async_engine

from app.config import settings
from app.db import Base
from app.eval import modelos  # noqa: F401  (registra las tablas en Base.metadata)

config = context.config
if config.config_file_name is not None and config.attributes.get("configurar_logs", True):
    fileConfig(config.config_file_name)

metadata = Base.metadata


def correr_offline() -> None:
    context.configure(url=settings.database_url, target_metadata=metadata, literal_binds=True)
    with context.begin_transaction():
        context.run_migrations()


def _migrar(conexion) -> None:
    context.configure(connection=conexion, target_metadata=metadata)
    with context.begin_transaction():
        context.run_migrations()


async def correr_online() -> None:
    motor = create_async_engine(settings.database_url)
    async with motor.connect() as conexion:
        await conexion.run_sync(_migrar)
    await motor.dispose()


if context.is_offline_mode():
    correr_offline()
else:
    asyncio.run(correr_online())
