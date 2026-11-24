import type { ReactNode } from "react";
import type { Escena } from "../../lib/ascii";
import LienzoAscii from "../ascii/LienzoAscii";
import { Decodificar } from "../ascii/Texto";

const KANJI: Record<string, string> = { "Cap. 2": "第二章", "Cap. 3": "第三章", "Cap. 4": "第四章" };

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
    <div className="enter flex min-h-[64px] flex-wrap items-center gap-x-4 gap-y-2 px-1 py-2" style={{ ["--delay" as string]: "60ms" }}>
      <div className="flex min-w-0 flex-wrap items-baseline gap-x-3 gap-y-1">
        {capitulo && (
          <span className="tag tag--accent self-center max-sm:hidden">
            {capitulo.toLowerCase()}
            {KANJI[capitulo] && <span className="display text-muted">{KANJI[capitulo]}</span>}
          </span>
        )}
        <h1 className="display truncate pb-1 text-[26px] leading-[1.2] text-ink max-sm:whitespace-normal">
          <Decodificar texto={titulo} />
        </h1>
        <p className="hint hidden truncate xl:block">{descripcion}</p>
      </div>
      {acciones && <div className="ml-auto flex flex-none flex-wrap items-center gap-2 max-md:ml-0 max-md:w-full max-md:flex-auto">{acciones}</div>}
    </div>
  );
}

/** Estado vacío de un panel: un ícono, una frase y, si hace falta, cómo empezar. */
export function Vacio({
  icono,
  titulo,
  children,
  escena,
  etiquetaEscena,
}: {
  icono?: ReactNode;
  titulo: string;
  children?: ReactNode;
  /** arte ASCII animado en lugar del ícono */
  escena?: Escena;
  etiquetaEscena?: string;
}) {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-3 px-6 py-10 text-center">
      {escena ? (
        <div className="h-[180px] w-full max-w-[360px]">
          <LienzoAscii escena={escena} celda={12} fps={14} etiqueta={etiquetaEscena} />
        </div>
      ) : (
        icono && (
          <span className="grid h-10 w-10 place-items-center border border-line-2 bg-sunken text-muted [&>svg]:h-[18px] [&>svg]:w-[18px]">
            {icono}
          </span>
        )
      )}
      <p className={escena ? "display text-[22px] text-ink" : "text-small text-ink"}>{titulo}</p>
      {children && <div className="hint max-w-[36ch]">{children}</div>}
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
      {label !== undefined && <div className="mb-1 opacity-70">{formatoEtiqueta ? formatoEtiqueta(label) : label}</div>}
      {payload.map((p) => (
        <div key={String(p.dataKey ?? p.name)} className="flex items-center gap-2">
          {p.color && <span className="h-2 w-2" style={{ background: p.color }} />}
          <span>{nombres?.[String(p.dataKey)] ?? p.name}</span>
          <span className="num ml-auto pl-3">{formato ? formato(Number(p.value)) : p.value}</span>
        </div>
      ))}
    </div>
  );
}

/** Ejes de Recharts: discretos, del color de las líneas, con números en mono a 13 px. */
export const EJE = {
  tick: { fill: "#8c887c", fontSize: 13, fontFamily: "DotGothic16, monospace" },
  axisLine: false,
  tickLine: false,
} as const;
export const GRILLA = { stroke: "rgba(236,232,220,.1)", strokeDasharray: "2 3", vertical: false } as const;
