// Datos para los gráficos de cordillera (ridgeline) en 3D.
import type { TokenLogprob } from "./api";
import { alternativas, mostrarToken, pct, prob } from "./probs";

const PUNTOS = 48;

/**
 * Para cada token de una respuesta, una cresta con la forma de su
 * distribución: la alternativa más probable al centro y las demás hacia los
 * costados, alternando (2.ª a la izquierda, 3.ª a la derecha…), suavizadas.
 * Un pico solo y alto es certeza; una loma baja y ancha es duda.
 */
const posicionCentrada = (rango: number, k: number) => {
  const centro = (k - 1) / 2;
  const lado = rango % 2 === 1 ? -1 : 1;
  return centro + lado * Math.ceil(rango / 2);
};
export function crestasDeTokens(tokens: TokenLogprob[], max = 160) {
  const paso = Math.max(1, Math.ceil(tokens.length / max));
  const filas = [];
  for (let i = 0; i < tokens.length; i += paso) {
    const t = tokens[i];
    const alts = alternativas(t);
    const k = Math.max(alts.length + (alts.length % 2 === 0 ? 1 : 0), 3);
    const sigma = 0.42;
    const valores = Array.from({ length: PUNTOS }, (_, j) => {
      const x = (j / (PUNTOS - 1)) * (k - 1);
      let y = 0;
      alts.forEach((a, r) => (y += a.p * Math.exp(-((x - posicionCentrada(r, k)) ** 2) / (2 * sigma * sigma))));
      return Math.min(1, y);
    });
    const elegido = alts.findIndex((a) => a.elegido);
    filas.push({
      indice: i,
      etiqueta: `#${i + 1} ${mostrarToken(t.token)} · ${pct(prob(t.logprob))}`,
      valores,
      marca: elegido >= 0 ? Math.round((Math.min(k - 1, Math.max(0, posicionCentrada(elegido, k))) / (k - 1)) * (PUNTOS - 1)) : null,
    });
  }
  return filas;
}

/**
 * Una cresta por serie (por ejemplo, por modelo) con la duda token a token
 * (1 − probabilidad), re-muestreada a un largo fijo y suavizada.
 */
export function crestaDeDuda(tokens: TokenLogprob[], puntos = 80) {
  if (!tokens.length) return Array(puntos).fill(0);
  const duda = tokens.map((t) => 1 - prob(t.logprob));
  const crudo = Array.from({ length: puntos }, (_, j) => {
    const x = (j / (puntos - 1)) * (duda.length - 1);
    const i = Math.floor(x);
    const f = x - i;
    return duda[i] * (1 - f) + (duda[Math.min(i + 1, duda.length - 1)] ?? 0) * f;
  });
  // media móvil corta: se lee la tendencia sin perder los picos
  return crudo.map((_, j) => {
    let s = 0, n = 0;
    for (let d = -2; d <= 2; d++) {
      const v = crudo[j + d];
      if (v !== undefined) {
        s += v * (d === 0 ? 2 : 1);
        n += d === 0 ? 2 : 1;
      }
    }
    return s / n;
  });
}
