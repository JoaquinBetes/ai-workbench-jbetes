"""Chat con streaming de tokens (Server-Sent Events).

El frontend recibe un evento por cada fragmento que genera el modelo.
Si se piden logprobs, cada token viene con su probabilidad y las
alternativas más probables: la base del explorador de tokens del capítulo 2.

Formato de cada evento (una línea `data: {...}` seguida de una línea vacía):
  {"type": "meta",     "method": "..."}                    cómo se generó (solo en /chat/continue)
  {"type": "thinking", "content": "..."}                  razonamiento (si think=True)
  {"type": "token",    "content": "...", "logprobs": [..]} texto de la respuesta
  {"type": "done",     "stats": {...}}                     métricas al terminar
  {"type": "error",    "message": "..."}                   si algo falla
"""

import json
from collections.abc import AsyncIterator
from typing import Literal

from fastapi import APIRouter, Depends
from fastapi.responses import StreamingResponse
from ollama import AsyncClient
from pydantic import BaseModel, Field

from ..ollama_client import get_ollama

router = APIRouter(tags=["chat"])


class Message(BaseModel):
    role: Literal["system", "user", "assistant"]
    content: str


class ChatRequest(BaseModel):
    model: str
    messages: list[Message]
    temperature: float = Field(0.7, ge=0, le=2)
    top_p: float = Field(0.9, ge=0, le=1)
    top_k: int = Field(40, ge=1, le=200)
    seed: int | None = None
    think: bool = False
    top_logprobs: int = Field(5, ge=0, le=20, description="0 = sin logprobs")
    max_tokens: int | None = Field(None, ge=1, le=8192, description="Tope de tokens a generar")


class ContinueRequest(ChatRequest):
    prefix: str = Field(..., description="Lo que el asistente ya 'dijo'; la generación sigue desde acá")
    thinking: str | None = Field(None, description="Razonamiento previo, si la respuesta original lo tenía")


def _sse(evento: dict) -> str:
    return f"data: {json.dumps(evento, ensure_ascii=False)}\n\n"


def _logprobs(chunk) -> list[dict]:
    salida = []
    for lp in getattr(chunk, "logprobs", None) or []:
        salida.append({
            "token": lp.token,
            "logprob": lp.logprob,
            "top": [{"token": t.token, "logprob": t.logprob} for t in (lp.top_logprobs or [])],
        })
    return salida


def _stats(chunk) -> dict:
    eval_s = (chunk.eval_duration or 0) / 1e9
    return {
        "prompt_tokens": chunk.prompt_eval_count,
        "output_tokens": chunk.eval_count,
        "tokens_per_second": round(chunk.eval_count / eval_s, 1) if eval_s and chunk.eval_count else None,
        "time_to_first_token_s": round(((chunk.load_duration or 0) + (chunk.prompt_eval_duration or 0)) / 1e9, 3),
        "load_s": round((chunk.load_duration or 0) / 1e9, 2),
        "total_s": round((chunk.total_duration or 0) / 1e9, 2),
    }


def _opciones(req: ChatRequest) -> dict:
    opciones = {"temperature": req.temperature, "top_p": req.top_p, "top_k": req.top_k}
    if req.seed is not None:
        opciones["seed"] = req.seed
    if req.max_tokens is not None:
        opciones["num_predict"] = req.max_tokens
    return opciones


def _respuesta_sse(eventos: AsyncIterator[str]) -> StreamingResponse:
    return StreamingResponse(
        eventos,
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )


async def _eventos_chat(stream) -> AsyncIterator[str]:
    async for chunk in stream:
        msg = chunk.message
        if msg.thinking:
            yield _sse({"type": "thinking", "content": msg.thinking})
        if msg.content:
            yield _sse({"type": "token", "content": msg.content, "logprobs": _logprobs(chunk)})
        if chunk.done:
            yield _sse({"type": "done", "stats": _stats(chunk)})


@router.post("/chat/stream")
async def chat_stream(req: ChatRequest, ollama: AsyncClient = Depends(get_ollama)):
    async def eventos():
        try:
            stream = await ollama.chat(
                model=req.model,
                messages=[m.model_dump() for m in req.messages],
                stream=True,
                think=req.think,
                options=_opciones(req),
                logprobs=req.top_logprobs > 0,
                top_logprobs=req.top_logprobs or None,
            )
            async for evento in _eventos_chat(stream):
                yield evento
        except Exception as e:  # el error se manda al frontend en lugar de cortar la conexión
            yield _sse({"type": "error", "message": str(e)})

    return _respuesta_sse(eventos())


# --- Continuar una respuesta desde un prefijo (ramas del capítulo 2) ----------

FIN_CHATML = ["<|im_end|>", "<|im_start|>"]


def armar_prompt_chatml(messages: list[Message], prefix: str, thinking: str | None) -> str:
    """Arma a mano el texto que el modelo ve, en formato ChatML (el de Qwen).

    Termina con el turno del asistente ABIERTO y con el prefijo ya escrito:
    así el modelo no empieza una respuesta nueva, sino que sigue la que le dimos.
    """
    partes = [f"<|im_start|>{m.role}\n{m.content}<|im_end|>\n" for m in messages]
    partes.append("<|im_start|>assistant\n")
    partes.append(f"<think>\n{thinking.strip()}\n</think>\n\n" if thinking else "<think>\n\n</think>\n\n")
    partes.append(prefix)
    return "".join(partes)


@router.post("/chat/continue")
async def chat_continue(req: ContinueRequest, ollama: AsyncClient = Depends(get_ollama)):
    """Sigue generando la respuesta del asistente a partir de `prefix`.

    Si el modelo usa la plantilla ChatML, se arma el prompt a mano y se llama a
    /api/generate en modo raw (control total sobre lo que ve el modelo).
    Si no, se manda el prefijo como último mensaje del asistente (prefill)
    y se confía en que la plantilla del modelo lo deje abierto.
    """

    async def eventos():
        try:
            info = await ollama.show(req.model)
            if "<|im_start|>" in (info.template or ""):
                yield _sse({"type": "meta", "method": "raw-chatml"})
                stream = await ollama.generate(
                    model=req.model,
                    prompt=armar_prompt_chatml(req.messages, req.prefix, req.thinking),
                    raw=True,
                    stream=True,
                    options={**_opciones(req), "stop": FIN_CHATML},
                    logprobs=req.top_logprobs > 0,
                    top_logprobs=req.top_logprobs or None,
                )
                async for chunk in stream:
                    if chunk.response:
                        yield _sse({"type": "token", "content": chunk.response, "logprobs": _logprobs(chunk)})
                    if chunk.done:
                        yield _sse({"type": "done", "stats": _stats(chunk)})
            else:
                yield _sse({"type": "meta", "method": "prefill"})
                mensajes = [m.model_dump() for m in req.messages] + [{"role": "assistant", "content": req.prefix}]
                stream = await ollama.chat(
                    model=req.model,
                    messages=mensajes,
                    stream=True,
                    think=False,
                    options=_opciones(req),
                    logprobs=req.top_logprobs > 0,
                    top_logprobs=req.top_logprobs or None,
                )
                async for evento in _eventos_chat(stream):
                    yield evento
        except Exception as e:
            yield _sse({"type": "error", "message": str(e)})

    return _respuesta_sse(eventos())
