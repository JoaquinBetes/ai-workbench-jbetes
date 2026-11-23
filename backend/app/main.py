"""AI Workbench JBetes — punto de entrada del backend.

En desarrollo:  uv run uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
En producción:  lo levanta Docker (ver Dockerfile), que además sirve el frontend compilado.
"""

from contextlib import asynccontextmanager
from pathlib import Path

import httpx
from fastapi import FastAPI, HTTPException
from fastapi.responses import FileResponse
from ollama import AsyncClient

from .config import settings
from .routers import chat, models


@asynccontextmanager
async def lifespan(app: FastAPI):
    app.state.ollama = AsyncClient(host=settings.ollama_host)  # un cliente para toda la app
    yield


app = FastAPI(title="AI Workbench JBetes", version="0.1.0", lifespan=lifespan)

app.include_router(models.router, prefix="/api")
app.include_router(chat.router, prefix="/api")


@app.get("/api/health", tags=["sistema"])
async def health():
    """Estado del backend y de la conexión con Ollama."""
    try:
        async with httpx.AsyncClient(timeout=3) as http:
            r = await http.get(f"{settings.ollama_host}/api/version")
            r.raise_for_status()
        ollama = {"ok": True, "host": settings.ollama_host, "version": r.json().get("version")}
    except Exception as e:
        ollama = {"ok": False, "host": settings.ollama_host, "error": str(e)}
    return {"status": "ok", "ollama": ollama}


# --- Frontend compilado (solo existe dentro de la imagen de Docker) -----------
STATIC = Path(__file__).resolve().parent.parent / "static"

if STATIC.exists():

    @app.get("/{ruta:path}", include_in_schema=False)
    async def frontend(ruta: str):
        if ruta.startswith("api/"):
            raise HTTPException(status_code=404)
        archivo = (STATIC / ruta).resolve()
        if ruta and archivo.is_file() and STATIC in archivo.parents:
            return FileResponse(archivo)
        return FileResponse(STATIC / "index.html")  # React maneja las rutas
