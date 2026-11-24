import type { ReactNode } from "react";
import type { Escena } from "../../lib/ascii";
import LienzoAscii from "../ascii/LienzoAscii";
import { Decodificar } from "../ascii/Texto";
import { TINTA } from "../../lib/tintas";

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
          <span className="tag tag--accent self-center max-sm:hidden">{capitulo.toLowerCase()}</span>
        )}
        <h1 className="display truncate pb-1 text-[30px] leading-[1.1] text-ink max-sm:whitespace-normal">
          <Decodificar texto={titulo} />
          <span className="caret" aria-hidden />
        </h1>
        <p className="hint hidden truncate 2xl:block">{descripcion}</p>
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
  interactiva = false,
  marco = false,
  altoEscena = 180,
}: {
  icono?: ReactNode;
  titulo: string;
  children?: ReactNode;
  /** arte ASCII animado en lugar del ícono */
  escena?: Escena;
  etiquetaEscena?: string;
  /** si la escena sigue al puntero */
  interactiva?: boolean;
  /** en un panel propio (para cuando el vacío está sobre la placa del fondo) */
  marco?: boolean;
  altoEscena?: number;
}) {
  const contenido = (
    <>
      {escena ? (
        <div className="w-full max-w-[420px]" style={{ height: altoEscena }}>
          <LienzoAscii escena={escena} celda={12} fps={15} etiqueta={etiquetaEscena} interactivo={interactiva} />
        </div>
      ) : (
        icono && (
          <span className="grid h-10 w-10 place-items-center border border-line-2 bg-sunken text-muted [&>svg]:h-[18px] [&>svg]:w-[18px]">
            {icono}
          </span>
        )
      )}
      <p className={escena ? "display text-[24px] leading-tight text-ink" : "text-small text-ink"}>{titulo}</p>
      {children && <div className="hint max-w-[36ch]">{children}</div>}
    </>
  );
  return (
    <div className="flex h-full flex-col items-center justify-center gap-3 px-6 py-10 text-center">
      {marco ? (
        <div className="panel fade-in flex w-full max-w-[520px] flex-col items-center gap-3 px-6 pb-7 pt-4">{contenido}</div>
      ) : (
        contenido
      )}
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
  tick: { fill: TINTA.apagada, fontSize: 12, fontFamily: '"IBM Plex Mono", monospace' },
  axisLine: false,
  tickLine: false,
} as const;
export const GRILLA = { stroke: TINTA.pista, strokeDasharray: "2 3", vertical: false } as const;
