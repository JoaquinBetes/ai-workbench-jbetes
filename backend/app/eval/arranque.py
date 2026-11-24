"""Al arrancar: aplicar migraciones pendientes y cargar los conjuntos curados.

Los conjuntos curados viven en `conjuntos/*.json` y se identifican por su `slug`.
Si un slug ya está en la base no se toca (así se conservan los ids que usan las
corridas viejas); si falta, se crea.
"""

import asyncio
import json
import logging
from pathlib import Path

from alembic import command
from alembic.config import Config
from sqlalchemy import select, update

from ..db import Sesion
from .modelos import Caso, Conjunto, Corrida

log = logging.getLogger(__name__)
RAIZ = Path(__file__).resolve().parent.parent.parent  # carpeta backend/
CURADOS = Path(__file__).resolve().parent / "conjuntos"


def _migrar() -> None:
    cfg = Config(str(RAIZ / "alembic.ini"))
    cfg.set_main_option("script_location", str(RAIZ / "migrations"))
    cfg.attributes["configurar_logs"] = False  # no pisar la configuración de logs de uvicorn
    command.upgrade(cfg, "head")


async def migrar() -> None:
    # Alembic corre su propio bucle asíncrono: va en un hilo aparte.
    await asyncio.to_thread(_migrar)


async def cargar_curados() -> int:
    nuevos = 0
    async with Sesion() as sesion:
        existentes = set((await sesion.scalars(select(Conjunto.slug).where(Conjunto.slug.is_not(None)))).all())
        for archivo in sorted(CURADOS.glob("*.json")):
            datos = json.loads(archivo.read_text(encoding="utf-8"))
            if datos["slug"] in existentes:
                continue
            conjunto = Conjunto(
                slug=datos["slug"], nombre=datos["nombre"], descripcion=datos.get("descripcion", ""), curado=True
            )
            conjunto.casos = [
                Caso(orden=i, pregunta=c["pregunta"], referencia=c["referencia"]) for i, c in enumerate(datos["casos"])
            ]
            sesion.add(conjunto)
            nuevos += 1
        await sesion.commit()
    return nuevos


async def cerrar_huerfanas() -> None:
    """Corridas que quedaron "corriendo" porque el servidor se reinició a mitad de camino."""
    async with Sesion() as sesion:
        await sesion.execute(update(Corrida).where(Corrida.estado == "corriendo").values(estado="cancelada"))
        await sesion.commit()


async def preparar_base() -> dict:
    """Devuelve el estado para /api/health; nunca tira abajo la app si la base no está."""
    try:
        await migrar()
        nuevos = await cargar_curados()
        await cerrar_huerfanas()
        if nuevos:
            log.info("Se cargaron %s conjuntos de casos curados", nuevos)
        return {"ok": True}
    except Exception as e:  # sin base, el resto del laboratorio sigue andando
        log.warning("La base de datos no está disponible: %s", e)
        return {"ok": False, "error": str(e)}
