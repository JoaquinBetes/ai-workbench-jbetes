"""Evaluación con referencia (capítulo 3): conjuntos de casos, corridas y resultados.

Conjuntos
  GET    /eval/conjuntos                    lista (con la cantidad de casos)
  GET    /eval/conjuntos/{id}               un conjunto con sus casos
  POST   /eval/conjuntos                    crear uno propio
  PUT    /eval/conjuntos/{id}               reemplazar nombre, descripción y casos (no los curados)
  DELETE /eval/conjuntos/{id}               borrar (no los curados)
  POST   /eval/conjuntos/{id}/duplicar      copia editable (así se "editan" los curados)

Corridas
  POST   /eval/corridas                     evaluar uno o más modelos sobre un conjunto (SSE)
  GET    /eval/corridas                     historial con los promedios
  GET    /eval/corridas/{id}                una corrida con todos sus resultados
  DELETE /eval/corridas/{id}
  GET    /eval/mapa?corridas=1,2            embeddings proyectados a 3D (PCA) para el mapa

Una corrida por modelo. Los modelos van en secuencia (en 8 GB de VRAM no entran
juntos) y, dentro de cada modelo, primero se generan todas las respuestas y después
se calculan los embeddings en un solo lote: así el modelo de embeddings se carga una
vez por modelo y no se intercala con el que genera.

Eventos del SSE (una línea `data: {...}` y una línea vacía):
  {"type": "inicio",     "casos": n, "modelos": [...]}
  {"type": "modelo",     "modelo": "...", "corrida_id": 7}
  {"type": "caso",       "corrida_id": 7, "orden": 0, "respuesta": "...", "metricas": {...}}
  {"type": "semantica",  "corrida_id": 7, "valores": {"0": 0.91, ...}}
  {"type": "aviso",      "message": "..."}       (p. ej., falta el modelo de embeddings)
  {"type": "modelo_fin", "corrida_id": 7, "agregados": {...}}
  {"type": "fin"}
  {"type": "error",      "message": "..."}
"""

import asyncio
import hashlib
import json
import time
from collections.abc import AsyncIterator
from datetime import UTC, datetime

import numpy as np
from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import StreamingResponse
from ollama import AsyncClient
from pydantic import BaseModel, Field, field_validator
from sqlalchemy import delete, func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from ..config import settings
from ..db import Sesion, get_sesion
from ..eval import metricas
from ..eval.modelos import Caso, Conjunto, Corrida, EmbeddingTexto, Resultado
from ..ollama_client import get_ollama

router = APIRouter(prefix="/eval", tags=["evaluación"])

SYSTEM_POR_DEFECTO = "Respondé solo con la respuesta, en una línea y sin explicaciones."


# --- Conjuntos -------------------------------------------------------------------


class CasoEntrada(BaseModel):
    pregunta: str = Field(..., min_length=1, max_length=4000)
    referencia: str = Field(..., min_length=1, max_length=4000)

    @field_validator("pregunta", "referencia")
    @classmethod
    def sin_bordes(cls, v: str) -> str:
        v = v.strip()
        if not v:
            raise ValueError("no puede estar vacío")
        return v


class ConjuntoEntrada(BaseModel):
    nombre: str = Field(..., min_length=1, max_length=80)
    descripcion: str = Field("", max_length=500)
    casos: list[CasoEntrada] = Field(..., min_length=1, max_length=200)


def _resumen(c: Conjunto, n: int) -> dict:
    return {"id": c.id, "nombre": c.nombre, "descripcion": c.descripcion, "curado": c.curado, "casos": n}


def _completo(c: Conjunto) -> dict:
    return {
        **_resumen(c, len(c.casos)),
        "casos": [{"id": k.id, "orden": k.orden, "pregunta": k.pregunta, "referencia": k.referencia} for k in c.casos],
    }


async def _conjunto(sesion: AsyncSession, conjunto_id: int) -> Conjunto:
    c = await sesion.get(Conjunto, conjunto_id, options=[selectinload(Conjunto.casos)])
    if c is None:
        raise HTTPException(status_code=404, detail="Ese conjunto no existe.")
    return c


@router.get("/conjuntos")
async def listar_conjuntos(sesion: AsyncSession = Depends(get_sesion)):
    filas = await sesion.execute(
        select(Conjunto, func.count(Caso.id))
        .outerjoin(Caso)
        .group_by(Conjunto.id)
        .order_by(Conjunto.curado.desc(), Conjunto.id)
    )
    return [_resumen(c, n) for c, n in filas.all()]


@router.get("/conjuntos/{conjunto_id}")
async def ver_conjunto(conjunto_id: int, sesion: AsyncSession = Depends(get_sesion)):
    return _completo(await _conjunto(sesion, conjunto_id))


@router.post("/conjuntos", status_code=201)
async def crear_conjunto(datos: ConjuntoEntrada, sesion: AsyncSession = Depends(get_sesion)):
    c = Conjunto(nombre=datos.nombre.strip(), descripcion=datos.descripcion.strip(), curado=False)
    c.casos = [Caso(orden=i, pregunta=k.pregunta, referencia=k.referencia) for i, k in enumerate(datos.casos)]
    sesion.add(c)
    await sesion.commit()
    return _completo(await _conjunto(sesion, c.id))


@router.put("/conjuntos/{conjunto_id}")
async def editar_conjunto(conjunto_id: int, datos: ConjuntoEntrada, sesion: AsyncSession = Depends(get_sesion)):
    c = await _conjunto(sesion, conjunto_id)
    if c.curado:
        raise HTTPException(status_code=409, detail="Los conjuntos curados no se editan: duplicalo primero.")
    c.nombre, c.descripcion = datos.nombre.strip(), datos.descripcion.strip()
    c.casos = [Caso(orden=i, pregunta=k.pregunta, referencia=k.referencia) for i, k in enumerate(datos.casos)]
    await sesion.commit()
    sesion.expire_all()
    return _completo(await _conjunto(sesion, conjunto_id))


@router.delete("/conjuntos/{conjunto_id}", status_code=204)
async def borrar_conjunto(conjunto_id: int, sesion: AsyncSession = Depends(get_sesion)):
    c = await _conjunto(sesion, conjunto_id)
    if c.curado:
        raise HTTPException(status_code=409, detail="Los conjuntos curados no se borran.")
    await sesion.delete(c)
    await sesion.commit()


@router.post("/conjuntos/{conjunto_id}/duplicar", status_code=201)
async def duplicar_conjunto(conjunto_id: int, sesion: AsyncSession = Depends(get_sesion)):
    original = await _conjunto(sesion, conjunto_id)
    copia = Conjunto(nombre=f"{original.nombre} (copia)"[:80], descripcion=original.descripcion, curado=False)
    copia.casos = [Caso(orden=k.orden, pregunta=k.pregunta, referencia=k.referencia) for k in original.casos]
    sesion.add(copia)
    await sesion.commit()
    return _completo(await _conjunto(sesion, copia.id))


# --- Corridas --------------------------------------------------------------------


class CorridaEntrada(BaseModel):
    conjunto_id: int
    modelos: list[str] = Field(..., min_length=1, max_length=6)
    temperatura: float = Field(0.0, ge=0, le=2)
    max_tokens: int = Field(128, ge=8, le=2048)
    system: str | None = Field(SYSTEM_POR_DEFECTO, max_length=2000)
    seed: int | None = 42
    modelo_embeddings: str | None = Field(None, description="Vacío = sin similitud semántica")


def _sse(evento: dict) -> str:
    return f"data: {json.dumps(evento, ensure_ascii=False)}\n\n"


def _hash(texto: str) -> str:
    return hashlib.sha256(texto.encode("utf-8")).hexdigest()


async def _embeddings(ollama: AsyncClient, modelo: str, textos: list[str]) -> list[list[float]]:
    """Embeddings con caché en la base: cada texto se pide a Ollama una sola vez por modelo."""
    hashes = [_hash(t) for t in textos]
    async with Sesion() as sesion:
        filas = await sesion.execute(
            select(EmbeddingTexto.hash, EmbeddingTexto.vector).where(
                EmbeddingTexto.modelo == modelo, EmbeddingTexto.hash.in_(set(hashes))
            )
        )
        cache = {h: list(map(float, v)) for h, v in filas.all()}
        faltan = [i for i, h in enumerate(hashes) if h not in cache]
        if faltan:
            respuesta = await ollama.embed(model=modelo, input=[textos[i] for i in faltan])
            for i, vector in zip(faltan, respuesta.embeddings, strict=True):
                if hashes[i] not in cache:
                    cache[hashes[i]] = list(vector)
                    sesion.add(EmbeddingTexto(modelo=modelo, hash=hashes[i], texto=textos[i], vector=list(vector)))
            await sesion.commit()
    return [cache[h] for h in hashes]


def _fila(r: Resultado) -> dict:
    return {
        "id": r.id,
        "orden": r.orden,
        "caso_id": r.caso_id,
        "pregunta": r.pregunta,
        "referencia": r.referencia,
        "respuesta": r.respuesta,
        "exacta": r.exacta,
        "normalizada": r.normalizada,
        "contiene": r.contiene,
        "edicion": r.edicion,
        "rouge_l": r.rouge_l,
        "bleu": r.bleu,
        "semantica": r.semantica,
        "perplejidad": r.perplejidad,
        "tokens": r.tokens,
        "latencia": r.latencia,
    }


def _corrida(c: Corrida) -> dict:
    return {
        "id": c.id,
        "conjunto_id": c.conjunto_id,
        "conjunto_nombre": c.conjunto_nombre,
        "modelo": c.modelo,
        "temperatura": c.temperatura,
        "max_tokens": c.max_tokens,
        "system": c.system,
        "modelo_embeddings": c.modelo_embeddings,
        "estado": c.estado,
        "error": c.error,
        "agregados": c.agregados,
        "creada": c.creada.isoformat() if c.creada else None,
    }


async def _evaluar_modelo(ollama: AsyncClient, req: CorridaEntrada, conjunto: dict, modelo: str) -> AsyncIterator[str]:
    async with Sesion() as sesion:
        corrida = Corrida(
            conjunto_id=conjunto["id"],
            conjunto_nombre=conjunto["nombre"],
            modelo=modelo,
            temperatura=req.temperatura,
            max_tokens=req.max_tokens,
            system=req.system or None,
            modelo_embeddings=req.modelo_embeddings or None,
        )
        sesion.add(corrida)
        await sesion.commit()
        corrida_id = corrida.id
    yield _sse({"type": "modelo", "modelo": modelo, "corrida_id": corrida_id})

    opciones: dict = {"temperature": req.temperatura, "num_predict": req.max_tokens}
    if req.seed is not None:
        opciones["seed"] = req.seed
    filas: list[dict] = []
    try:
        for caso in conjunto["casos"]:
            mensajes = ([{"role": "system", "content": req.system}] if req.system else []) + [
                {"role": "user", "content": caso["pregunta"]}
            ]
            inicio = time.perf_counter()
            r = await ollama.chat(model=modelo, messages=mensajes, think=False, options=opciones, logprobs=True)
            latencia = round(time.perf_counter() - inicio, 3)
            respuesta = (r.message.content or "").strip()
            logprobs = [lp.logprob for lp in (r.logprobs or [])]
            perp = metricas.perplejidad(logprobs)
            fila = {
                "orden": caso["orden"],
                "caso_id": caso["id"],
                "pregunta": caso["pregunta"],
                "referencia": caso["referencia"],
                "respuesta": respuesta,
                **metricas.lexicas(caso["referencia"], respuesta),
                "semantica": None,
                "perplejidad": round(perp, 4) if perp is not None else None,
                "tokens": r.eval_count,
                "latencia": latencia,
            }
            filas.append(fila)
            yield _sse({"type": "caso", "corrida_id": corrida_id, "modelo": modelo, **fila})

        # Similitud semántica: un solo lote de embeddings (referencias en caché + respuestas).
        vectores: list[list[float] | None] = [None] * len(filas)
        if req.modelo_embeddings:
            try:
                refs = await _embeddings(ollama, req.modelo_embeddings, [f["referencia"] for f in filas])
                ress = await _embeddings(ollama, req.modelo_embeddings, [f["respuesta"] or " " for f in filas])
                for i, f in enumerate(filas):
                    f["semantica"] = round(metricas.coseno(refs[i], ress[i]), 4)
                    vectores[i] = ress[i]
                yield _sse({
                    "type": "semantica",
                    "corrida_id": corrida_id,
                    "valores": {str(f["orden"]): f["semantica"] for f in filas},
                })
            except Exception as e:
                yield _sse({
                    "type": "aviso",
                    "message": (
                        f"No se pudo calcular la similitud semántica con {req.modelo_embeddings}: {e}. "
                        f"¿Está bajado? En el servidor: ollama pull {req.modelo_embeddings}"
                    ),
                })

        agregados = metricas.agregar(filas)
        async with Sesion() as sesion:
            sesion.add_all(
                Resultado(corrida_id=corrida_id, embedding=vectores[i], **f) for i, f in enumerate(filas)
            )
            corrida = await sesion.get(Corrida, corrida_id)
            corrida.estado, corrida.agregados, corrida.terminada = "lista", agregados, datetime.now(UTC)
            await sesion.commit()
        yield _sse({"type": "modelo_fin", "corrida_id": corrida_id, "modelo": modelo, "agregados": agregados})
    except (asyncio.CancelledError, GeneratorExit):
        # El navegador cortó (botón Detener o se cerró la pestaña). La conexión ya está
        # cancelada, así que la corrida se marca en una tarea aparte, fuera de este alcance.
        asyncio.get_running_loop().create_task(_cerrar_corrida(corrida_id, "cancelada", None))
        raise
    except Exception as e:
        await _cerrar_corrida(corrida_id, "error", str(e))
        yield _sse({"type": "error", "message": f"{modelo}: {e}"})


async def _cerrar_corrida(corrida_id: int, estado: str, error: str | None) -> None:
    async with Sesion() as sesion:
        corrida = await sesion.get(Corrida, corrida_id)
        if corrida and corrida.estado == "corriendo":
            corrida.estado, corrida.error, corrida.terminada = estado, error, datetime.now(UTC)
            await sesion.commit()


@router.post("/corridas")
async def evaluar(req: CorridaEntrada, ollama: AsyncClient = Depends(get_ollama)):
    async with Sesion() as sesion:
        conjunto = _completo(await _conjunto(sesion, req.conjunto_id))

    async def eventos() -> AsyncIterator[str]:
        yield _sse({"type": "inicio", "casos": len(conjunto["casos"]), "modelos": req.modelos})
        for modelo in req.modelos:
            async for evento in _evaluar_modelo(ollama, req, conjunto, modelo):
                yield evento
        yield _sse({"type": "fin"})

    return StreamingResponse(
        eventos(), media_type="text/event-stream", headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"}
    )


@router.get("/corridas")
async def historial(
    conjunto_id: int | None = None, limite: int = Query(50, ge=1, le=500), sesion: AsyncSession = Depends(get_sesion)
):
    consulta = select(Corrida).order_by(Corrida.id.desc()).limit(limite)
    if conjunto_id is not None:
        consulta = consulta.where(Corrida.conjunto_id == conjunto_id)
    return [_corrida(c) for c in (await sesion.scalars(consulta)).all()]


@router.get("/corridas/{corrida_id}")
async def ver_corrida(corrida_id: int, sesion: AsyncSession = Depends(get_sesion)):
    c = await sesion.get(Corrida, corrida_id, options=[selectinload(Corrida.resultados)])
    if c is None:
        raise HTTPException(status_code=404, detail="Esa corrida no existe.")
    return {**_corrida(c), "resultados": [_fila(r) for r in c.resultados]}


@router.delete("/corridas/{corrida_id}", status_code=204)
async def borrar_corrida(corrida_id: int, sesion: AsyncSession = Depends(get_sesion)):
    await sesion.execute(delete(Corrida).where(Corrida.id == corrida_id))
    await sesion.commit()


# --- Mapa 3D de embeddings -----------------------------------------------------------


def proyectar(vectores: np.ndarray, dimensiones: int = 3) -> np.ndarray:
    """PCA: los vectores se normalizan (la similitud es de coseno), se centran y se
    proyectan sobre las direcciones de mayor varianza. Escala final: [-1, 1]."""
    if len(vectores) == 0:
        return np.zeros((0, dimensiones))
    normas = np.linalg.norm(vectores, axis=1, keepdims=True)
    unitarios = vectores / np.where(normas == 0, 1, normas)
    centrados = unitarios - unitarios.mean(axis=0)
    _, _, ejes = np.linalg.svd(centrados, full_matrices=False)
    puntos = centrados @ ejes[:dimensiones].T
    if puntos.shape[1] < dimensiones:  # menos puntos que dimensiones: se completa con ceros
        puntos = np.pad(puntos, ((0, 0), (0, dimensiones - puntos.shape[1])))
    escala = np.abs(puntos).max() or 1.0
    return puntos / escala


@router.get("/mapa")
async def mapa(corridas: str = Query(..., description="ids separados por comas"), sesion: AsyncSession = Depends(get_sesion)):
    try:
        ids = [int(x) for x in corridas.split(",") if x.strip()]
    except ValueError as e:
        raise HTTPException(status_code=422, detail="corridas: ids separados por comas") from e
    filas = (
        await sesion.execute(
            select(Resultado, Corrida.modelo, Corrida.modelo_embeddings)
            .join(Corrida)
            .where(Resultado.corrida_id.in_(ids), Resultado.embedding.is_not(None))
            .order_by(Resultado.corrida_id, Resultado.orden)
        )
    ).all()
    if not filas:
        return {"puntos": [], "modelo_embeddings": None}
    modelos_emb = {m for _, _, m in filas}
    if len(modelos_emb) > 1:
        raise HTTPException(status_code=422, detail="Esas corridas usan modelos de embeddings distintos: no se pueden mezclar.")
    modelo_emb = modelos_emb.pop()

    # Las referencias: una por caso (sacadas de la caché de embeddings).
    referencias = sorted({(r.orden, r.referencia) for r, _, _ in filas})
    cache = {
        h: list(map(float, v))
        for h, v in (
            await sesion.execute(
                select(EmbeddingTexto.hash, EmbeddingTexto.vector).where(
                    EmbeddingTexto.modelo == modelo_emb,
                    EmbeddingTexto.hash.in_([_hash(t) for _, t in referencias]),
                )
            )
        ).all()
    }
    referencias = [(o, t) for o, t in referencias if _hash(t) in cache]

    puntos: list[dict] = [{"tipo": "referencia", "orden": o, "texto": t} for o, t in referencias]
    vectores = [cache[_hash(t)] for _, t in referencias]
    for r, modelo, _ in filas:
        puntos.append({
            "tipo": "respuesta",
            "orden": r.orden,
            "corrida_id": r.corrida_id,
            "modelo": modelo,
            "texto": r.respuesta,
            "semantica": r.semantica,
        })
        vectores.append(list(map(float, r.embedding)))

    coords = proyectar(np.array(vectores, dtype=float))
    for p, (x, y, z) in zip(puntos, coords.tolist(), strict=True):
        p.update(x=round(x, 4), y=round(y, 4), z=round(z, 4))
    return {"puntos": puntos, "modelo_embeddings": modelo_emb}
