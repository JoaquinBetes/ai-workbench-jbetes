// Cliente de la evaluación con referencia (capítulo 3): conjuntos, corridas y mapa.
import { emitirPulso } from "./ascii";
import { telemetria } from "./telemetria";

export type CasoEval = { id?: number; orden?: number; pregunta: string; referencia: string };

export type ConjuntoResumen = { id: number; nombre: string; descripcion: string; curado: boolean; casos: number };
export type Conjunto = Omit<ConjuntoResumen, "casos"> & { casos: Required<CasoEval>[] };

/** Las métricas de una respuesta contra su referencia. */
export type Metricas = {
  exacta: boolean;
  normalizada: boolean;
  contiene: boolean;
  edicion: number;
  rouge_l: number;
  bleu: number;
  semantica: number | null;
  perplejidad: number | null;
};

export type ResultadoEval = Metricas & {
  orden: number;
  caso_id: number | null;
  pregunta: string;
  referencia: string;
  respuesta: string;
  tokens: number | null;
  latencia: number;
};

export type Agregados = {
  casos: number;
  exacta: number | null;
  normalizada: number | null;
  contiene: number | null;
  edicion: number | null;
  rouge_l: number | null;
  bleu: number | null;
  semantica: number | null;
  perplejidad: number | null;
  latencia: number | null;
  tokens: number;
};

export type CorridaResumen = {
  id: number;
  conjunto_id: number | null;
  conjunto_nombre: string;
  modelo: string;
  temperatura: number;
  max_tokens: number;
  system: string | null;
  modelo_embeddings: string | null;
  estado: "corriendo" | "lista" | "error" | "cancelada";
  error: string | null;
  agregados: Agregados | null;
  creada: string | null;
};

export type CorridaCompleta = CorridaResumen & { resultados: ResultadoEval[] };

export type PedidoEval = {
  conjunto_id: number;
  modelos: string[];
  temperatura: number;
  max_tokens: number;
  system: string | null;
  seed: number | null;
  modelo_embeddings: string | null;
};

export type EventoEval =
  | { type: "inicio"; casos: number; modelos: string[] }
  | { type: "modelo"; modelo: string; corrida_id: number }
  | ({ type: "caso"; corrida_id: number; modelo: string } & ResultadoEval)
  | { type: "semantica"; corrida_id: number; valores: Record<string, number> }
  | { type: "aviso"; message: string }
  | { type: "modelo_fin"; corrida_id: number; modelo: string; agregados: Agregados }
  | { type: "fin" }
  | { type: "error"; message: string };

export type PuntoMapa = {
  tipo: "referencia" | "respuesta";
  orden: number;
  texto: string;
  corrida_id?: number;
  modelo?: string;
  semantica?: number | null;
  x: number;
  y: number;
  z: number;
};

/** Las métricas que se promedian, en el orden en que se muestran. */
export const METRICAS = [
  { id: "exacta", nombre: "Exacta", corto: "exacta", ayuda: "Igual carácter por carácter." },
  { id: "normalizada", nombre: "Normalizada", corto: "norm.", ayuda: "Igual sin mayúsculas, tildes, puntuación ni artículos." },
  { id: "contiene", nombre: "Contiene", corto: "contiene", ayuda: "La referencia aparece entera dentro de la respuesta." },
  { id: "edicion", nombre: "Edición", corto: "edición", ayuda: "1 − distancia de Levenshtein: cuántas letras hay que cambiar." },
  { id: "rouge_l", nombre: "ROUGE-L", corto: "ROUGE-L", ayuda: "La secuencia de palabras en común más larga (F1)." },
  { id: "bleu", nombre: "BLEU", corto: "BLEU", ayuda: "Grupos de palabras compartidos, con penalización por brevedad." },
  { id: "semantica", nombre: "Semántica", corto: "semántica", ayuda: "Coseno entre los embeddings: si quieren decir lo mismo." },
] as const;

export type IdMetrica = (typeof METRICAS)[number]["id"];

async function json<T>(res: Response): Promise<T> {
  if (!res.ok) {
    let detalle = `HTTP ${res.status}`;
    try {
      const cuerpo = await res.json();
      if (typeof cuerpo.detail === "string") detalle = cuerpo.detail;
      else if (Array.isArray(cuerpo.detail)) detalle = "Revisá los casos: hay preguntas o referencias vacías.";
    } catch {
      /* respuesta sin JSON */
    }
    throw new Error(detalle);
  }
  return res.status === 204 ? (undefined as T) : res.json();
}

const conJson = (method: string, body?: unknown): RequestInit => ({
  method,
  headers: { "Content-Type": "application/json" },
  body: body === undefined ? undefined : JSON.stringify(body),
});

export const listarConjuntos = () => fetch("/api/eval/conjuntos").then(json<ConjuntoResumen[]>);
export const verConjunto = (id: number) => fetch(`/api/eval/conjuntos/${id}`).then(json<Conjunto>);
export const crearConjunto = (datos: { nombre: string; descripcion: string; casos: CasoEval[] }) =>
  fetch("/api/eval/conjuntos", conJson("POST", datos)).then(json<Conjunto>);
export const editarConjunto = (id: number, datos: { nombre: string; descripcion: string; casos: CasoEval[] }) =>
  fetch(`/api/eval/conjuntos/${id}`, conJson("PUT", datos)).then(json<Conjunto>);
export const borrarConjunto = (id: number) => fetch(`/api/eval/conjuntos/${id}`, conJson("DELETE")).then(json<void>);
export const duplicarConjunto = (id: number) =>
  fetch(`/api/eval/conjuntos/${id}/duplicar`, conJson("POST")).then(json<Conjunto>);

export const historialCorridas = () => fetch("/api/eval/corridas?limite=100").then(json<CorridaResumen[]>);
export const verCorrida = (id: number) => fetch(`/api/eval/corridas/${id}`).then(json<CorridaCompleta>);
export const borrarCorrida = (id: number) => fetch(`/api/eval/corridas/${id}`, conJson("DELETE")).then(json<void>);
export const mapaEmbeddings = (ids: number[]) =>
  fetch(`/api/eval/mapa?corridas=${ids.join(",")}`).then(json<{ puntos: PuntoMapa[]; modelo_embeddings: string | null }>);

/** Evalúa uno o más modelos sobre un conjunto; los eventos llegan a medida que responden. */
export async function* evaluar(pedido: PedidoEval, signal?: AbortSignal): AsyncGenerator<EventoEval> {
  const res = await fetch("/api/eval/corridas", { ...conJson("POST", pedido), signal });
  if (!res.ok || !res.body) await json(res);
  const lector = res.body!.getReader();
  const decodificador = new TextDecoder();
  let buffer = "";
  // La barra de estado muestra el modelo que está respondiendo, como en el resto del laboratorio.
  let enCurso: number | null = null;
  const cerrar = (tokens?: number) => {
    if (enCurso !== null) telemetria.terminar(enCurso, tokens !== undefined ? { output_tokens: tokens } : null);
    enCurso = null;
  };
  try {
    while (true) {
      const { value, done } = await lector.read();
      if (done) break;
      buffer += decodificador.decode(value, { stream: true });
      let corte: number;
      while ((corte = buffer.indexOf("\n\n")) >= 0) {
        const bloque = buffer.slice(0, corte);
        buffer = buffer.slice(corte + 2);
        const linea = bloque.split("\n").find((l) => l.startsWith("data: "));
        if (!linea) continue;
        const ev = JSON.parse(linea.slice(6)) as EventoEval;
        if (ev.type === "modelo") {
          cerrar();
          enCurso = telemetria.iniciar(ev.modelo);
        } else if (ev.type === "caso") {
          if (enCurso !== null) telemetria.token(enCurso, Math.max(1, ev.tokens ?? 1));
          emitirPulso(); // cada respuesta enciende una pista de la placa
        } else if (ev.type === "modelo_fin") {
          cerrar(ev.agregados.tokens);
        }
        yield ev;
      }
    }
  } finally {
    cerrar();
  }
}
