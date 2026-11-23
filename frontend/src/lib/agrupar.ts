// Agrupar respuestas "iguales" (capítulo 2: inconsistencia y autoconsistencia).
//
// Criterio simple: dos respuestas son iguales si coinciden después de
// normalizarlas (minúsculas, sin puntuación ni espacios de más). Funciona bien
// con respuestas cortas; comparar por significado necesita embeddings o un LLM
// juez (capítulos 3 y 6).

export function normalizar(texto: string): string {
  return texto
    .toLowerCase()
    .replace(/<think>[\s\S]*?<\/think>/g, "")
    .replace(/[\p{P}\p{S}]/gu, " ") // puntuación y símbolos
    .replace(/\s+/g, " ")
    .trim();
}

export type Grupo<T> = {
  clave: string;
  /** Texto de ejemplo (la primera respuesta del grupo, sin normalizar). */
  ejemplo: string;
  items: T[];
};

/** Agrupa y ordena de más a menos frecuente. */
export function agrupar<T>(items: T[], texto: (item: T) => string): Grupo<T>[] {
  const mapa = new Map<string, Grupo<T>>();
  for (const item of items) {
    const original = texto(item).trim();
    const clave = normalizar(original) || "(vacía)";
    const grupo = mapa.get(clave) ?? { clave, ejemplo: original || "(vacía)", items: [] };
    grupo.items.push(item);
    mapa.set(clave, grupo);
  }
  return [...mapa.values()].sort((a, b) => b.items.length - a.items.length);
}

/**
 * Entropía (bits) de la distribución de respuestas: 0 = siempre la misma
 * respuesta; log2(N) = todas distintas. Es la misma idea que la entropía de un
 * token, pero a nivel de respuesta completa.
 */
export function entropiaRespuestas(tamanios: number[]): number {
  const total = tamanios.reduce((s, n) => s + n, 0);
  if (!total) return 0;
  const suma = tamanios.reduce((s, n) => {
    const p = n / total;
    return p > 0 ? s + p * Math.log2(p) : s;
  }, 0);
  return Math.abs(suma); // evita mostrar "-0"
}
