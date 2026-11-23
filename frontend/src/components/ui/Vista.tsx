import type { ReactNode } from "react";

/** Encabezado de cada vista: capítulo del libro, título, una línea de contexto y acciones. */
export function EncabezadoVista({
  capitulo,
  titulo,
  descripcion,
  acciones,
}: {
  capitulo?: string | null;
  titulo: string;
  descripcion: string;
  acciones?: ReactNode;
}) {
  return (
    <div className="enter flex min-h-[60px] items-center gap-4 px-1" style={{ ["--delay" as string]: "60ms" }}>
      <div className="flex min-w-0 items-center gap-3">
        {capitulo && <span className="tag tag--accent">{capitulo}</span>}
        <h1 className="display truncate text-[22px] leading-none text-ink">{titulo}</h1>
        <p className="hint hidden truncate xl:block">{descripcion}</p>
      </div>
      {acciones && <div className="ml-auto flex flex-none items-center gap-2">{acciones}</div>}
    </div>
  );
}

/** Estado vacío de un panel: un ícono, una frase y, si hace falta, cómo empezar. */
export function Vacio({ icono, titulo, children }: { icono?: ReactNode; titulo: string; children?: ReactNode }) {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-3 px-6 py-10 text-center">
      {icono && (
        <span className="grid h-10 w-10 place-items-center rounded-lg border border-line-2 bg-raised text-muted [&>svg]:h-[18px] [&>svg]:w-[18px]">
          {icono}
        </span>
      )}
      <p className="text-small text-ink">{titulo}</p>
      {children && <div className="hint max-w-[30ch]">{children}</div>}
    </div>
  );
}

/** Tooltip de los gráficos de Recharts, con el mismo aspecto que el resto. */
export function TipGrafico({
  active,
  payload,
  label,
  formato,
  nombres,
  formatoEtiqueta,
}: {
  active?: boolean;
  payload?: { name?: string; value?: number | string; color?: string; dataKey?: string | number }[];
  label?: string | number;
  formato?: (v: number) => string;
  nombres?: Record<string, string>;
  formatoEtiqueta?: (l: string | number) => string;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div className="viz-tip">
      {label !== undefined && <div className="mb-1 text-muted">{formatoEtiqueta ? formatoEtiqueta(label) : label}</div>}
      {payload.map((p) => (
        <div key={String(p.dataKey ?? p.name)} className="flex items-center gap-2">
          {p.color && <span className="h-2 w-2 rounded-sm" style={{ background: p.color }} />}
          <span className="text-ink-2">{nombres?.[String(p.dataKey)] ?? p.name}</span>
          <span className="num ml-auto pl-3 text-ink">{formato ? formato(Number(p.value)) : p.value}</span>
        </div>
      ))}
    </div>
  );
}

/** Ejes de Recharts: discretos, del color de las líneas, con números en mono a 13 px. */
export const EJE = {
  tick: { fill: "var(--muted)", fontSize: 13, fontFamily: "var(--font-mono)" },
  axisLine: false,
  tickLine: false,
} as const;
export const GRILLA = { stroke: "var(--line)", vertical: false } as const;
