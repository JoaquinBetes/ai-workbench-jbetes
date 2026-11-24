"""Métricas de evaluación con referencia (capítulo 3, "Exact evaluation").

Todas comparan la respuesta del modelo con una respuesta de referencia:

- exacta:       igual carácter por carácter (sin espacios en los bordes).
- normalizada:  igual después de normalizar (minúsculas, sin tildes, sin puntuación,
                sin artículos): "La capital es Canberra." == "la capital es canberra".
- contiene:     la referencia normalizada aparece entera en la respuesta normalizada.
                Es la versión indulgente: un modelo que contesta "Es Canberra." acierta.
- edicion:      1 − distancia de Levenshtein / largo mayor, sobre el texto normalizado.
                Mide cuántas letras hay que cambiar para pasar de una a la otra.
- rouge_l:      F1 de la subsecuencia común más larga de palabras (ROUGE-L).
- bleu:         BLEU de una oración: precisión de n-gramas (hasta 4) con penalización
                por brevedad. Como las referencias son cortas, el orden máximo se adapta
                al largo y los órdenes mayores a 1 se suavizan sumando 1 arriba y abajo
                (Lin y Och, 2004): sin eso, una respuesta de dos palabras daría siempre 0.
- coseno:       similitud de coseno entre dos embeddings (la similitud semántica).
- perplejidad:  e elevado a la media de −logprob de los tokens generados: cuánto dudó
                el modelo al escribir su propia respuesta.

Las métricas léxicas fallan con las paráfrasis ("Canberra es la capital australiana"
contra "La capital de Australia es Canberra") y aciertan con respuestas parecidas pero
falsas ("…es Sídney"). La semántica corrige lo primero y no siempre lo segundo: por
eso se miran juntas.
"""

import math
import re
import unicodedata
from collections import Counter

ARTICULOS = {"el", "la", "los", "las", "un", "una", "unos", "unas", "lo", "the", "a", "an"}
_NO_PALABRA = re.compile(r"[^\w\s]", re.UNICODE)
_ESPACIOS = re.compile(r"\s+")


def normalizar(texto: str) -> str:
    """Minúsculas, sin tildes, sin puntuación y sin artículos (al estilo de SQuAD)."""
    t = unicodedata.normalize("NFD", texto.lower())
    t = "".join(c for c in t if unicodedata.category(c) != "Mn")
    t = _NO_PALABRA.sub(" ", t)
    palabras = [p for p in _ESPACIOS.split(t) if p and p not in ARTICULOS]
    return " ".join(palabras)


def palabras(texto: str) -> list[str]:
    return normalizar(texto).split()


def exacta(referencia: str, respuesta: str) -> bool:
    return referencia.strip() == respuesta.strip()


def normalizada(referencia: str, respuesta: str) -> bool:
    return normalizar(referencia) == normalizar(respuesta)


def contiene(referencia: str, respuesta: str) -> bool:
    ref = normalizar(referencia)
    return bool(ref) and f" {ref} " in f" {normalizar(respuesta)} "


def levenshtein(a: str, b: str) -> int:
    if len(a) < len(b):
        a, b = b, a
    previa = list(range(len(b) + 1))
    for i, ca in enumerate(a, 1):
        actual = [i]
        for j, cb in enumerate(b, 1):
            actual.append(min(previa[j] + 1, actual[j - 1] + 1, previa[j - 1] + (ca != cb)))
        previa = actual
    return previa[-1]


def edicion(referencia: str, respuesta: str) -> float:
    a, b = normalizar(referencia), normalizar(respuesta)
    largo = max(len(a), len(b))
    return 1.0 if largo == 0 else 1 - levenshtein(a, b) / largo


def _lcs(a: list[str], b: list[str]) -> int:
    previa = [0] * (len(b) + 1)
    for x in a:
        actual = [0]
        for j, y in enumerate(b, 1):
            actual.append(previa[j - 1] + 1 if x == y else max(previa[j], actual[j - 1]))
        previa = actual
    return previa[-1]


def rouge_l(referencia: str, respuesta: str) -> float:
    ref, res = palabras(referencia), palabras(respuesta)
    if not ref or not res:
        return 0.0
    comun = _lcs(ref, res)
    if comun == 0:
        return 0.0
    precision, recall = comun / len(res), comun / len(ref)
    return 2 * precision * recall / (precision + recall)


def _ngramas(tokens: list[str], n: int) -> Counter:
    return Counter(tuple(tokens[i : i + n]) for i in range(len(tokens) - n + 1))


def bleu(referencia: str, respuesta: str, orden_max: int = 4) -> float:
    ref, res = palabras(referencia), palabras(respuesta)
    if not ref or not res:
        return 0.0
    orden = max(1, min(orden_max, len(ref), len(res)))
    log_precisiones = 0.0
    for n in range(1, orden + 1):
        cand, refs = _ngramas(res, n), _ngramas(ref, n)
        coinciden = sum(min(c, refs[g]) for g, c in cand.items())
        total = sum(cand.values())
        if n == 1:
            if coinciden == 0:
                return 0.0
            p = coinciden / total
        else:
            p = (coinciden + 1) / (total + 1)  # suavizado de Lin y Och
        log_precisiones += math.log(p) / orden
    brevedad = 1.0 if len(res) >= len(ref) else math.exp(1 - len(ref) / len(res))
    return brevedad * math.exp(log_precisiones)


def coseno(a: list[float], b: list[float]) -> float:
    pa = math.sqrt(sum(x * x for x in a))
    pb = math.sqrt(sum(x * x for x in b))
    if pa == 0 or pb == 0:
        return 0.0
    return sum(x * y for x, y in zip(a, b, strict=True)) / (pa * pb)


def perplejidad(logprobs: list[float]) -> float | None:
    if not logprobs:
        return None
    return math.exp(-sum(logprobs) / len(logprobs))


def lexicas(referencia: str, respuesta: str) -> dict:
    """Todas las métricas que no necesitan un modelo, de una vez."""
    return {
        "exacta": exacta(referencia, respuesta),
        "normalizada": normalizada(referencia, respuesta),
        "contiene": contiene(referencia, respuesta),
        "edicion": round(edicion(referencia, respuesta), 4),
        "rouge_l": round(rouge_l(referencia, respuesta), 4),
        "bleu": round(bleu(referencia, respuesta), 4),
    }


METRICAS = ("exacta", "normalizada", "contiene", "edicion", "rouge_l", "bleu", "semantica")


def agregar(filas: list[dict]) -> dict:
    """Promedios de una corrida: los booleanos quedan como proporción de aciertos."""
    salida: dict = {"casos": len(filas)}
    for m in METRICAS:
        valores = [float(f[m]) for f in filas if f.get(m) is not None]
        salida[m] = round(sum(valores) / len(valores), 4) if valores else None
    perp = [f["perplejidad"] for f in filas if f.get("perplejidad") is not None]
    salida["perplejidad"] = round(sum(perp) / len(perp), 3) if perp else None
    lat = [f["latencia"] for f in filas if f.get("latencia") is not None]
    salida["latencia"] = round(sum(lat) / len(lat), 3) if lat else None
    salida["tokens"] = sum(f.get("tokens") or 0 for f in filas)
    return salida
