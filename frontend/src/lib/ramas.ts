// Ramas de una respuesta (capítulo 2: la naturaleza probabilística).
//
// Una rama es una versión alternativa de una respuesta: copia los tokens de su
// rama madre hasta cierto punto, en ese punto FUERZA un token distinto (una de
// las alternativas que el modelo había considerado) y después deja que el
// modelo siga escribiendo desde ahí.
import type { Stats, TokenLogprob } from "./api";

export const ID_RAIZ = "original";

export type Rama = {
  id: string;
  padreId: string | null;
  /** Índice del token forzado (null en la respuesta original). */
  corte: number | null;
  /** Respuesta completa: heredados + forzado + generados. */
  tokens: TokenLogprob[];
  generando: boolean;
  /** Cómo la generó el backend: "raw-chatml" o "prefill". */
  metodo?: string;
  stats?: Stats;
  error?: string;
};

// crypto.randomUUID() solo existe en https o localhost; la app se sirve por
// http a través de Tailscale, así que usamos un id simple.
export const nuevoId = () => `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;

export const textoDe = (tokens: TokenLogprob[]) => tokens.map((t) => t.token).join("");

/** Primeros caracteres de lo que la rama generó por su cuenta (después del corte). */
export function resumenNuevo(rama: Rama, largo = 48) {
  const desde = rama.corte === null ? 0 : rama.corte;
  const texto = textoDe(rama.tokens.slice(desde)).replace(/\s+/g, " ").trim();
  return texto.length > largo ? `${texto.slice(0, largo)}…` : texto;
}

/** Profundidad de una rama en el árbol (la original es 0). */
export function profundidad(rama: Rama, todas: Rama[]): number {
  let d = 0;
  let actual: Rama | undefined = rama;
  while (actual?.padreId) {
    actual = todas.find((r) => r.id === actual!.padreId);
    d++;
  }
  return d;
}
