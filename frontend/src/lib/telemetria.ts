// Telemetría en vivo de la sesión: qué se está generando, a qué velocidad y
// cómo vienen las últimas respuestas. La alimenta el cliente de la API (cada
// token que llega por SSE) y la lee la barra de estado.
//
// Todo se calcula en el navegador: no hace falta tocar el backend.
import { useSyncExternalStore } from "react";
import { getHealth, type Health, type Stats } from "./api";

export type Corrida = {
  modelo: string;
  tokens: number;
  tokS: number | null;
  ttft: number | null;
  carga: number | null;
  fin: number;
};

type Activa = { id: number; modelo: string; inicio: number; tiempos: number[]; tokens: number };

export type Estado = {
  /** Generaciones en curso (puede haber más de una: ramas, comparador). */
  activas: { modelo: string; tokens: number; tokS: number | null }[];
  /** Velocidad instantánea (tokens en el último segundo) de la generación más reciente. */
  tokSVivo: number | null;
  historial: Corrida[];
  ultimoModelo: string | null;
  tokensSesion: number;
  salud: Health | null;
  saludError: boolean;
  /** Ida y vuelta al backend en la última consulta de salud, en ms. */
  latenciaMs: number | null;
};

let estado: Estado = {
  activas: [],
  tokSVivo: null,
  historial: [],
  ultimoModelo: null,
  tokensSesion: 0,
  salud: null,
  saludError: false,
  latenciaMs: null,
};

const oyentes = new Set<() => void>();
const activas = new Map<number, Activa>();
let siguienteId = 1;
let pendiente = false;

// Los tokens pueden llegar a ~100 por segundo: la barra se repinta como mucho
// cada 120 ms, que a la vista ya es "en vivo".
function avisar(ya = false) {
  if (ya) return publicar();
  if (pendiente) return;
  pendiente = true;
  setTimeout(publicar, 120);
}

function velocidad(a: Activa, ahora: number) {
  const recientes = a.tiempos.filter((t) => ahora - t <= 1000);
  a.tiempos = recientes;
  if (a.tokens < 3) return null;
  return recientes.length;
}

function publicar() {
  pendiente = false;
  const ahora = performance.now();
  const lista = [...activas.values()];
  const filas = lista.map((a) => ({ modelo: a.modelo, tokens: a.tokens, tokS: velocidad(a, ahora) }));
  const ultima = filas[filas.length - 1];
  estado = { ...estado, activas: filas, tokSVivo: ultima?.tokS ?? null };
  oyentes.forEach((o) => o());
  // Mientras haya algo generando, seguimos refrescando aunque no lleguen tokens
  // (así la velocidad cae a 0 si el modelo se traba).
  if (activas.size) avisar();
}

export const telemetria = {
  iniciar(modelo: string): number {
    const id = siguienteId++;
    activas.set(id, { id, modelo, inicio: performance.now(), tiempos: [], tokens: 0 });
    estado = { ...estado, ultimoModelo: modelo };
    avisar(true);
    return id;
  },
  token(id: number, cantidad = 1) {
    const a = activas.get(id);
    if (!a) return;
    const ahora = performance.now();
    for (let i = 0; i < cantidad; i++) a.tiempos.push(ahora);
    a.tokens += cantidad;
    avisar();
  },
  terminar(id: number, stats?: Partial<Stats> | null) {
    const a = activas.get(id);
    if (!a) return;
    activas.delete(id);
    const tokens = stats?.output_tokens ?? a.tokens;
    if (tokens > 0) {
      const corrida: Corrida = {
        modelo: a.modelo,
        tokens,
        tokS: stats?.tokens_per_second ?? null,
        ttft: stats?.time_to_first_token_s ?? null,
        carga: stats?.load_s ?? null,
        fin: Date.now(),
      };
      estado = {
        ...estado,
        historial: [...estado.historial, corrida].slice(-40),
        tokensSesion: estado.tokensSesion + tokens,
      };
    }
    avisar(true);
  },
};

// --- Salud del backend y de Ollama ------------------------------------------------

async function consultarSalud() {
  const t0 = performance.now();
  try {
    const salud = await getHealth();
    estado = { ...estado, salud, saludError: false, latenciaMs: Math.round(performance.now() - t0) };
  } catch {
    estado = { ...estado, saludError: true, latenciaMs: null };
  }
  oyentes.forEach((o) => o());
}

let sondeo: ReturnType<typeof setInterval> | null = null;

function suscribir(o: () => void) {
  oyentes.add(o);
  if (!sondeo) {
    consultarSalud();
    sondeo = setInterval(consultarSalud, 15000);
  }
  return () => {
    oyentes.delete(o);
  };
}

export function useTelemetria(): Estado {
  return useSyncExternalStore(suscribir, () => estado);
}
