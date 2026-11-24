import type { Agregados, CorridaResumen, IdMetrica, ResultadoEval } from "../../lib/evaluacion";

/** Un modelo evaluado: su corrida, su color y sus respuestas por número de caso. */
export type Serie = {
  corrida_id: number;
  modelo: string;
  /** índice en SERIES: el color sigue al modelo */
  slot: number;
  estado: CorridaResumen["estado"];
  error?: string | null;
  resultados: Record<number, ResultadoEval>;
  agregados: Agregados | null;
};

export type CasoTabla = { orden: number; pregunta: string; referencia: string };

/** Lo que se está mirando: los casos de un conjunto y los modelos que los respondieron. */
export type Tabla = {
  conjunto: string;
  casos: CasoTabla[];
  series: Serie[];
  /** de dónde vino: la corrida de recién o el historial */
  origen: "vivo" | "historial";
};

/** Las tres primeras métricas son sí o no; el resto, puntajes de 0 a 1. */
export const BINARIAS = new Set<IdMetrica>(["exacta", "normalizada", "contiene"]);

/** El valor de una métrica como número de 0 a 1 (sí = 1, no = 0). */
export function valorMetrica(r: ResultadoEval | undefined, m: IdMetrica): number | null {
  if (!r) return null;
  const v = r[m];
  if (v === null || v === undefined) return null;
  return typeof v === "boolean" ? (v ? 1 : 0) : v;
}

/** Los promedios mientras la corrida avanza (el backend manda los definitivos al terminar). */
export function agregarParcial(resultados: ResultadoEval[]): Agregados | null {
  if (!resultados.length) return null;
  const media = (vals: (number | null)[]) => {
    const v = vals.filter((x): x is number => x !== null);
    return v.length ? v.reduce((a, b) => a + b, 0) / v.length : null;
  };
  const por = (m: IdMetrica) => media(resultados.map((r) => valorMetrica(r, m)));
  return {
    casos: resultados.length,
    exacta: por("exacta"),
    normalizada: por("normalizada"),
    contiene: por("contiene"),
    edicion: por("edicion"),
    rouge_l: por("rouge_l"),
    bleu: por("bleu"),
    semantica: por("semantica"),
    perplejidad: media(resultados.map((r) => r.perplejidad)),
    latencia: media(resultados.map((r) => r.latencia)),
    tokens: resultados.reduce((a, r) => a + (r.tokens ?? 0), 0),
  };
}
