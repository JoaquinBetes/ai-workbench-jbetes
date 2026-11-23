"""Endpoints sobre los modelos disponibles en Ollama."""

from fastapi import APIRouter, Depends
from ollama import AsyncClient
from pydantic import BaseModel

from ..ollama_client import get_ollama

router = APIRouter(tags=["modelos"])

GB = 1024**3


class ModelInfo(BaseModel):
    name: str
    size_gb: float
    parameters: str | None = None
    quantization: str | None = None
    family: str | None = None


@router.get("/models", response_model=list[ModelInfo])
async def list_models(ollama: AsyncClient = Depends(get_ollama)):
    """Lista los modelos descargados en Ollama (lo mismo que `ollama list`)."""
    resp = await ollama.list()
    modelos = []
    for m in resp.models:
        d = m.details
        modelos.append(ModelInfo(
            name=m.model,
            size_gb=round((m.size or 0) / GB, 2),
            parameters=d.parameter_size if d else None,
            quantization=d.quantization_level if d else None,
            family=d.family if d else None,
        ))
    return sorted(modelos, key=lambda x: x.name)
