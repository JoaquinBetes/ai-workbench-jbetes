// Números con formato argentino (coma decimal, punto de miles), siempre con la
// misma cantidad de decimales para que las columnas no "bailen".

const cache = new Map<number, Intl.NumberFormat>();

function formateador(decimales: number) {
  let f = cache.get(decimales);
  if (!f) {
    f = new Intl.NumberFormat("es-AR", { minimumFractionDigits: decimales, maximumFractionDigits: decimales });
    cache.set(decimales, f);
  }
  return f;
}

/** 94.237 → "94,2"; null o NaN → "—". */
export function num(v: number | null | undefined, decimales = 1): string {
  if (v === null || v === undefined || Number.isNaN(v)) return "—";
  return formateador(decimales).format(v);
}

/** Entero con separador de miles: 3482 → "3.482". */
export const entero = (v: number | null | undefined) => num(v, 0);

/** 0.874 → "87,4 %" (con espacio fino, como pide la norma en español). */
export function porcentaje(v: number | null | undefined, decimales = 1): string {
  if (v === null || v === undefined || Number.isNaN(v)) return "—";
  return `${num(v * 100, decimales)} %`;
}

/** Segundos legibles: 0.21 → "0,21 s", 12.4 → "12,4 s". */
export function segundos(v: number | null | undefined): string {
  if (v === null || v === undefined || Number.isNaN(v)) return "—";
  return `${num(v, v < 1 ? 2 : 1)} s`;
}

/** Nombre corto de un modelo para gráficos: "qwen3:8b" → "8b" si todos son qwen3. */
export const nombreCorto = (m: string) => m.replace(/^qwen3:/, "");
