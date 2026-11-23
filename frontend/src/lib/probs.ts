// Cálculos sobre las probabilidades de los tokens (capítulo 2: Sampling).
import type { TokenLogprob } from "./api";

export const prob = (logprob: number) => Math.exp(logprob);

export const pct = (p: number, decimales = 1) => `${(p * 100).toFixed(decimales)}%`;

/** Alternativas de un token, ordenadas, incluyendo siempre al token elegido. */
export function alternativas(t: TokenLogprob) {
  const lista = t.top.map((a) => ({ token: a.token, p: prob(a.logprob), elegido: a.token === t.token }));
  if (!lista.some((a) => a.elegido)) lista.push({ token: t.token, p: prob(t.logprob), elegido: true });
  return lista.sort((a, b) => b.p - a.p);
}

/**
 * Entropía (en bits) de la distribución del próximo token, estimada con las
 * top-k alternativas renormalizadas. 0 = el modelo está seguro; más alto = duda.
 * Es una aproximación: la distribución real tiene ~150.000 tokens posibles.
 */
export function entropia(t: TokenLogprob) {
  const ps = t.top.map((a) => prob(a.logprob));
  const total = ps.reduce((s, p) => s + p, 0);
  if (!total) return 0;
  return -ps.reduce((s, p) => {
    const q = p / total;
    return q > 0 ? s + q * Math.log2(q) : s;
  }, 0);
}

export type Metricas = {
  tokens: number;
  confianzaPromedio: number;
  perplejidad: number;
  indiceMasDudoso: number;
};

/**
 * Perplejidad = exp(-promedio de los logprobs). Se puede leer como
 * "entre cuántas opciones dudó el modelo, en promedio, en cada paso".
 */
export function metricas(tokens: TokenLogprob[]): Metricas | null {
  if (!tokens.length) return null;
  const sumaLog = tokens.reduce((s, t) => s + t.logprob, 0);
  let indiceMasDudoso = 0;
  tokens.forEach((t, i) => {
    if (t.logprob < tokens[indiceMasDudoso].logprob) indiceMasDudoso = i;
  });
  return {
    tokens: tokens.length,
    confianzaPromedio: tokens.reduce((s, t) => s + prob(t.logprob), 0) / tokens.length,
    perplejidad: Math.exp(-sumaLog / tokens.length),
    indiceMasDudoso,
  };
}

/** Rojo (dudoso) → verde (seguro). */
export function colorProbabilidad(p: number) {
  return `hsla(${Math.round(p * 120)}, 75%, 45%, 0.35)`;
}

/** Transparente (seguro) → violeta intenso (mucha duda entre alternativas). */
export function colorIncertidumbre(bits: number, k: number) {
  const max = Math.log2(Math.max(k, 2));
  const x = Math.min(bits / max, 1);
  return `hsla(275, 80%, 60%, ${(x * 0.6).toFixed(2)})`;
}

/** Hace visibles los espacios y saltos de línea dentro de un token. */
export function mostrarToken(token: string) {
  return token.replace(/ /g, "·").replace(/\n/g, "⏎").replace(/\t/g, "⇥") || "∅";
}
