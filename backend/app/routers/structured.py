"""Salidas estructuradas: tres métodos para obtener JSON del modelo (capítulo 2).

- prompt:       se pide JSON en el prompt y la respuesta se acepta solo si ya es JSON.
- postproceso:  la MISMA respuesta, pero si no parsea se extrae y repara el JSON.
- restringido:  Ollama recibe el esquema en `format` y solo puede generar tokens
                que mantengan el JSON válido (sampling restringido por gramática).

"prompt" y "postproceso" comparten una sola generación (modo "libre"): es la misma
respuesta leída de dos formas, así la diferencia entre ambos es solo el post-proceso.
Los dos modos reciben exactamente los mismos mensajes.
"""

import json
import time
from typing import Any, Literal

from fastapi import APIRouter, Depends, HTTPException
from jsonschema import SchemaError
from jsonschema.validators import Draft202012Validator
from ollama import AsyncClient
from pydantic import BaseModel, ConfigDict, Field

from ..ollama_client import get_ollama
from ..structured import errores_de_esquema, exactitud, extraer_json

router = APIRouter(tags=["salidas estructuradas"])

Metodo = Literal["prompt", "postproceso", "restringido"]


class StructuredRequest(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    model: str
    esquema: dict = Field(..., alias="schema", description="JSON Schema que debe cumplir la respuesta")
    text: str = Field(..., description="Texto del que hay que extraer los datos")
    mode: Literal["libre", "restringido"] = Field(..., description="libre = evalúa prompt y postproceso")
    temperature: float = Field(0.7, ge=0, le=2)
    seed: int | None = None
    max_tokens: int = Field(512, ge=16, le=4096)
    expected: Any | None = Field(None, description="Respuesta correcta, para medir exactitud (opcional)")


class Evaluacion(BaseModel):
    parsed: Any | None
    json_ok: bool
    schema_ok: bool
    schema_errors: list[str]
    repairs: list[str]
    accuracy: float | None


class StructuredResult(BaseModel):
    raw: str
    latency_s: float
    output_tokens: int | None
    tokens_per_second: float | None
    evaluaciones: dict[Metodo, Evaluacion]


def mensajes(esquema: dict, texto: str) -> list[dict]:
    instruccion = (
        "Extraé la información del texto del usuario y respondé SOLO con un JSON que cumpla "
        "este JSON Schema, sin texto adicional:\n" + json.dumps(esquema, ensure_ascii=False, indent=2)
    )
    return [{"role": "system", "content": instruccion}, {"role": "user", "content": texto}]


def evaluar(raw: str, esquema: dict, esperado: Any | None, reparar: bool) -> Evaluacion:
    parsed, repairs = None, []
    try:
        parsed = json.loads(raw)
    except json.JSONDecodeError:
        if reparar:
            parsed, repairs = extraer_json(raw)
    json_ok = parsed is not None
    schema_errors = errores_de_esquema(parsed, esquema) if json_ok else ["la respuesta no es JSON"]
    return Evaluacion(
        parsed=parsed,
        json_ok=json_ok,
        schema_ok=json_ok and not schema_errors,
        schema_errors=schema_errors,
        repairs=repairs,
        accuracy=exactitud(esperado, parsed) if esperado is not None else None,
    )


@router.post("/structured/sample", response_model=StructuredResult)
async def structured_sample(req: StructuredRequest, ollama: AsyncClient = Depends(get_ollama)):
    try:
        Draft202012Validator.check_schema(req.esquema)
    except SchemaError as e:
        raise HTTPException(status_code=422, detail=f"Esquema inválido: {e.message}") from e

    opciones: dict = {"temperature": req.temperature, "num_predict": req.max_tokens}
    if req.seed is not None:
        opciones["seed"] = req.seed

    inicio = time.perf_counter()
    respuesta = await ollama.chat(
        model=req.model,
        messages=mensajes(req.esquema, req.text),
        think=False,
        format=req.esquema if req.mode == "restringido" else None,
        options=opciones,
    )
    latencia = time.perf_counter() - inicio
    raw = respuesta.message.content or ""
    eval_s = (respuesta.eval_duration or 0) / 1e9

    if req.mode == "libre":
        evaluaciones = {
            "prompt": evaluar(raw, req.esquema, req.expected, reparar=False),
            "postproceso": evaluar(raw, req.esquema, req.expected, reparar=True),
        }
    else:
        evaluaciones = {"restringido": evaluar(raw, req.esquema, req.expected, reparar=False)}

    return StructuredResult(
        raw=raw,
        latency_s=round(latencia, 2),
        output_tokens=respuesta.eval_count,
        tokens_per_second=round(respuesta.eval_count / eval_s, 1) if eval_s and respuesta.eval_count else None,
        evaluaciones=evaluaciones,
    )
