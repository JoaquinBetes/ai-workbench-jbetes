"""Salidas estructuradas (capítulo 2): extraer, reparar, validar y puntuar JSON.

Funciones puras (sin Ollama), para poder testearlas por separado.
"""

import json
import re
import unicodedata
from typing import Any

from jsonschema import Draft202012Validator

# --- Extracción y reparación (método "prompt + post-proceso") ----------------


def _bloque_balanceado(texto: str) -> str | None:
    """Devuelve el primer objeto {...} o lista [...] completo del texto,
    respetando llaves que aparezcan dentro de strings."""
    inicio = next((i for i, c in enumerate(texto) if c in "{["), None)
    if inicio is None:
        return None
    apertura = texto[inicio]
    cierre = "}" if apertura == "{" else "]"
    profundidad, en_string, escape = 0, False, False
    for i in range(inicio, len(texto)):
        c = texto[i]
        if en_string:
            if escape:
                escape = False
            elif c == "\\":
                escape = True
            elif c == '"':
                en_string = False
        elif c == '"':
            en_string = True
        elif c == apertura:
            profundidad += 1
        elif c == cierre:
            profundidad -= 1
            if profundidad == 0:
                return texto[inicio : i + 1]
    return texto[inicio:]  # quedó sin cerrar: devolvemos lo que hay


def _reparar(candidato: str) -> tuple[str, list[str]]:
    pasos = []
    reemplazos = {"“": '"', "”": '"', "‘": "'", "’": "'"}
    if any(c in candidato for c in reemplazos):
        for a, b in reemplazos.items():
            candidato = candidato.replace(a, b)
        pasos.append("comillas tipográficas → comillas normales")
    sin_comas = re.sub(r",\s*([}\]])", r"\1", candidato)
    if sin_comas != candidato:
        candidato = sin_comas
        pasos.append("quitó comas finales sobrantes")
    if '"' not in candidato and "'" in candidato:
        candidato = candidato.replace("'", '"')
        pasos.append("comillas simples → dobles")
    literales = re.sub(r"\bTrue\b", "true", re.sub(r"\bFalse\b", "false", re.sub(r"\bNone\b", "null", candidato)))
    if literales != candidato:
        candidato = literales
        pasos.append("True/False/None de Python → JSON")
    return candidato, pasos


def extraer_json(texto: str) -> tuple[Any | None, list[str]]:
    """Intenta rescatar un JSON de una respuesta con texto de más.
    Devuelve (objeto o None, lista de pasos que hizo falta aplicar)."""
    pasos: list[str] = []
    if "</think>" in texto:
        texto = texto.split("</think>")[-1]
        pasos.append("quitó el razonamiento <think>")
    bloque = re.search(r"```(?:json)?\s*\n?(.*?)```", texto, flags=re.S)
    if bloque:
        texto = bloque.group(1)
        pasos.append("sacó el JSON del bloque de código ```")
    candidato = _bloque_balanceado(texto)
    if candidato is None:
        return None, pasos + ["no encontró ningún { ni ["]
    if candidato.strip() != texto.strip():
        pasos.append("recortó el texto de antes y después del JSON")
    try:
        return json.loads(candidato), pasos
    except json.JSONDecodeError:
        pass
    reparado, arreglos = _reparar(candidato)
    try:
        return json.loads(reparado), pasos + arreglos
    except json.JSONDecodeError as e:
        return None, pasos + arreglos + [f"no se pudo reparar: {e.msg}"]


# --- Validación contra el esquema ---------------------------------------------


def errores_de_esquema(objeto: Any, esquema: dict, maximo: int = 5) -> list[str]:
    validador = Draft202012Validator(esquema)
    errores = []
    for err in sorted(validador.iter_errors(objeto), key=lambda e: list(e.path)):
        ruta = "/".join(str(p) for p in err.path) or "(raíz)"
        errores.append(f"{ruta}: {err.message}")
        if len(errores) >= maximo:
            break
    return errores


# --- Exactitud contra la respuesta esperada -------------------------------------


def _norm(valor: Any) -> Any:
    if isinstance(valor, str):
        sin_acentos = unicodedata.normalize("NFKD", valor)
        sin_acentos = "".join(c for c in sin_acentos if not unicodedata.combining(c))
        return re.sub(r"\s+", " ", sin_acentos.lower()).strip()
    return valor


def _hojas_iguales(esperado: Any, obtenido: Any) -> bool:
    if isinstance(esperado, bool) or isinstance(obtenido, bool):
        return esperado is obtenido
    if isinstance(esperado, (int, float)) and isinstance(obtenido, (int, float)):
        return abs(esperado - obtenido) <= 1e-6 * max(1, abs(esperado))
    a, b = _norm(esperado), _norm(obtenido)
    if isinstance(a, str) and isinstance(b, str):
        return a == b or (len(a) >= 4 and (a in b or b in a))  # "alfajores" ≈ "alfajor"
    return a == b


def _contar(esperado: Any, obtenido: Any) -> tuple[int, int]:
    """(aciertos, total) sobre las hojas del JSON esperado."""
    if isinstance(esperado, dict):
        aciertos = total = 0
        for clave, valor in esperado.items():
            sub = obtenido.get(clave) if isinstance(obtenido, dict) else None
            a, t = _contar(valor, sub)
            aciertos, total = aciertos + a, total + t
        return aciertos, total
    if isinstance(esperado, list):
        aciertos = total = 0
        for i, valor in enumerate(esperado):
            sub = obtenido[i] if isinstance(obtenido, list) and i < len(obtenido) else None
            a, t = _contar(valor, sub)
            aciertos, total = aciertos + a, total + t
        return aciertos, total
    return (1 if obtenido is not None and _hojas_iguales(esperado, obtenido) else 0), 1


def exactitud(esperado: Any, obtenido: Any) -> float:
    """Proporción de campos del esperado que el modelo acertó (0 a 1)."""
    aciertos, total = _contar(esperado, obtenido)
    return aciertos / total if total else 0.0
