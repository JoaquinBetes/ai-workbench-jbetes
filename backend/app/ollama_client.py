"""Cliente de Ollama compartido por toda la app.

Se crea una sola vez al arrancar el servidor (ver `lifespan` en main.py)
y los endpoints lo reciben como dependencia con `Depends(get_ollama)`.
"""

from fastapi import Request
from ollama import AsyncClient


def get_ollama(request: Request) -> AsyncClient:
    return request.app.state.ollama
