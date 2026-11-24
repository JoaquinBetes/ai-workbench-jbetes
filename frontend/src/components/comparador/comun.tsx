import { Play, Square } from "lucide-react";
import type { ReactNode } from "react";
import { Giro } from "../ascii/Texto";
import { TINTA } from "../../lib/tintas";

/** Serie categórica validada para fondo oscuro (dataviz): fósforo, azul, ámbar, magenta. */
export const SERIES = ["var(--s1)", "var(--s2)", "var(--s3)", "var(--s4)"];
export { SERIES_HEX } from "../../lib/tintas";
/** Los mismos tokens de index.css en hex, para recharts (no lee variables CSS). */
export const TINTA_HEX = { tinta: TINTA.tinta, senal: TINTA.senal, panel: TINTA.panel };

/** Panel de configuración de un modo del comparador, con el botón de correr abajo. */
export function PanelConfig({
  titulo = "Configuración",
  meta,
  children,
  pie,
}: {
  titulo?: string;
  meta?: ReactNode;
  children: ReactNode;
  pie: ReactNode;
}) {
  return (
    <aside className="panel enter flex min-h-0 flex-col" style={{ ["--delay" as string]: "90ms" }} aria-label={titulo}>
      <div className="panel-head">
        <span className="panel-title">{titulo}</span>
        {meta && <span className="panel-meta ml-auto">{meta}</span>}
      </div>
      <div className="min-h-0 flex-1 divide-y divide-line overflow-y-auto">{children}</div>
      <div className="space-y-2 border-t border-line p-3">{pie}</div>
    </aside>
  );
}

/** Botón principal de un experimento: correr, o detener con el progreso a la vista. */
export function BotonCorrer({
  corriendo,
  onCorrer,
  onDetener,
  texto,
  hecho,
  total,
  deshabilitado,
}: {
  corriendo: boolean;
  onCorrer: () => void;
  onDetener: () => void;
  texto: string;
  hecho?: number;
  total?: number;
  deshabilitado?: boolean;
}) {
  const fraccion = total ? (hecho ?? 0) / total : 0;
  return (
    <>
      {corriendo ? (
        <button type="button" onClick={onDetener} className="btn btn--danger w-full">
          <Square className="fill-current" style={{ width: 11, height: 11 }} aria-hidden />
          Detener
          {total !== undefined && (
            <span className="num ml-auto text-muted">
              {hecho}/{total}
            </span>
          )}
        </button>
      ) : (
        <button type="button" onClick={onCorrer} disabled={deshabilitado} className="btn btn--primary w-full">
          <Play className="fill-current" style={{ width: 12, height: 12 }} aria-hidden />
          {texto}
          <span className="ml-auto flex items-center gap-1 opacity-70">
            <kbd className="kbd border-transparent bg-transparent text-[var(--bg)]">↵</kbd>
          </span>
        </button>
      )}
      {corriendo && total ? (
        <div
          className="flex items-center justify-between gap-2"
          role="progressbar"
          aria-label="Progreso de la corrida"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={Math.round(fraccion * 100)}
        >
          <span className="mono text-label text-muted" aria-hidden>[</span>
          <span className="flex-1 overflow-hidden" aria-hidden>
            <span className="mono block whitespace-pre text-label leading-none">
              <span className="text-accent">{"#".repeat(Math.round(fraccion * 28))}</span>
              <span className="pista-punteada inline-block align-middle" style={{ width: `${28 - Math.round(fraccion * 28)}ch` }} />
            </span>
          </span>
          <span className="mono text-label text-muted" aria-hidden>]</span>
        </div>
      ) : null}
    </>
  );
}

/** Campo de prompt del comparador: Enter corre, Shift+Enter salto de línea. */
export function CampoPrompt({
  valor,
  onCambio,
  onCorrer,
  placeholder,
  etiqueta = "Prompt",
  filas = 4,
}: {
  valor: string;
  onCambio: (v: string) => void;
  onCorrer: () => void;
  placeholder: string;
  etiqueta?: string;
  filas?: number;
}) {
  return (
    <textarea
      value={valor}
      aria-label={etiqueta}
      onChange={(e) => onCambio(e.target.value)}
      onKeyDown={(e) => {
        if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
          e.preventDefault();
          onCorrer();
        }
      }}
      rows={filas}
      placeholder={placeholder}
      className="field prosa resize-none"
    />
  );
}

/** Estado de una columna o muestra: en espera, generando, listo, error. */
export function Estado({ estado, detalle }: { estado: "esperando" | "generando" | "listo" | "error"; detalle?: ReactNode }) {
  if (estado === "generando")
    return (
      <span className="tag tag--accent">
        <Giro />
        {detalle ?? "generando"}
      </span>
    );
  if (estado === "listo") return <span className="tag">{detalle ?? "listo"}</span>;
  if (estado === "error") return <span className="tag tag--danger">error</span>;
  return <span className="tag opacity-70">en espera</span>;
}
