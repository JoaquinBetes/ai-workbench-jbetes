"""Conexión a Postgres (SQLAlchemy asíncrono sobre asyncpg).

Una sola fábrica de sesiones para toda la app; los routers la piden con
`Depends(get_sesion)`. Las tablas se crean con las migraciones de Alembic
(carpeta `migrations/`), que se aplican solas al arrancar.
"""

from collections.abc import AsyncIterator

from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.orm import DeclarativeBase

from .config import settings


class Base(DeclarativeBase):
    pass


motor = create_async_engine(settings.database_url, pool_pre_ping=True)
Sesion = async_sessionmaker(motor, expire_on_commit=False)


async def get_sesion() -> AsyncIterator[AsyncSession]:
    async with Sesion() as sesion:
        yield sesion
