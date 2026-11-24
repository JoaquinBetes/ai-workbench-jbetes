import { ArrowUp, Square } from "lucide-react";
import { useId, useLayoutEffect, useRef, type ReactNode, type RefObject } from "react";
import { Giro } from "../ascii/Texto";

/**
 * Campo para escribirle al modelo. Panel con vías en las esquinas; mientras el
 * modelo escribe, una línea de exploración recorre el borde de arriba (estado,
 * no decoración: se detiene cuando termina).
 */
export default function Compositor({
  valor,
  onCambio,
  onEnviar,
  onDetener,
  generando = false,
  deshabilitado = false,
  placeholder,
  etiqueta,
  ejemplos = [],
  chip,
  entradaRef,
  textoEnviar = "Enviar",
}: {
  valor: string;
  onCambio: (v: string) => void;
  onEnviar: () => void;
  onDetener?: () => void;
  generando?: boolean;
  deshabilitado?: boolean;
  placeholder: string;
  etiqueta: string;
  ejemplos?: string[];
  chip?: ReactNode;
  entradaRef?: RefObject<HTMLTextAreaElement | null>;
  textoEnviar?: string;
}) {
  const propia = useRef<HTMLTextAreaElement>(null);
  const entrada = entradaRef ?? propia;
  const id = useId();

  useLayoutEffect(() => {
    const t = entrada.current;
    if (!t) return;
    t.style.height = "auto";
    t.style.height = `${Math.min(t.scrollHeight, 200)}px`;
  }, [valor, entrada]);

  const puedeEnviar = !!valor.trim() && !deshabilitado && !generando;

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (puedeEnviar) onEnviar();
      }}
    >
      <div className="panel focus-within:border-[var(--line-2)]">
        {generando && (
          <span className="absolute inset-x-0 -top-px z-[2] h-px overflow-hidden" aria-hidden>
            <span className="block h-full w-1/3 animate-[escaner_1.4s_linear_infinite] bg-[linear-gradient(90deg,transparent,var(--accent),transparent)]" />
          </span>
        )}
        <label htmlFor={id} className="label block px-4 pt-3">
          {etiqueta}
        </label>
        <textarea
          ref={entrada}
          id={id}
          rows={2}
          value={valor}
          placeholder={placeholder}
          onChange={(e) => onCambio(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
              e.preventDefault();
              if (puedeEnviar) onEnviar();
            } else if (e.key === "Escape" && generando && onDetener) {
              e.preventDefault();
              onDetener();
            }
          }}
          className="campo-compositor block min-h-[52px] w-full resize-none bg-transparent px-4 pt-1.5 text-body leading-relaxed text-ink placeholder:text-muted"
        />
        <div className="flex items-center gap-3 px-3 pb-3">
          {chip && (
            <span className="tag tag--ink">
              <span className={generando ? "live" : "live live--idle"} aria-hidden />
              {chip}
            </span>
          )}
          {generando && (
            <span className="flex items-center gap-2 text-label text-muted">
              <Giro /> escribiendo
            </span>
          )}
          <span className="ml-auto" />
          {generando && onDetener ? (
            <button type="button" onClick={onDetener} className="btn btn--danger btn--sm">
              <Square className="fill-current" style={{ width: 10, height: 10 }} aria-hidden />
              Detener
              <kbd className="kbd">Esc</kbd>
            </button>
          ) : (
            <button type="submit" disabled={!puedeEnviar} className="btn btn--primary btn--sm">
              <ArrowUp aria-hidden />
              {textoEnviar}
              <kbd className="kbd border-transparent bg-transparent text-[var(--bg)]">↵</kbd>
            </button>
          )}
        </div>
      </div>
      <div className="sin-barra mt-2.5 flex min-h-[28px] flex-wrap items-center gap-2 max-lg:flex-nowrap max-lg:overflow-x-auto" aria-label={ejemplos.length ? "Ejemplos de prompt" : "Atajos del campo"}>
        {ejemplos.length > 0 ? (
          ejemplos.map((ej) => (
            <button key={ej} type="button" className="chip" onClick={() => onCambio(ej)}>
              {ej}
            </button>
          ))
        ) : (
          <span className="flex flex-wrap items-center gap-4 text-label text-muted">
            <span className="flex items-center gap-1.5">
              <kbd className="kbd">↵</kbd> enviar
            </span>
            <span className="flex items-center gap-1.5">
              <kbd className="kbd">Shift</kbd>
              <kbd className="kbd">↵</kbd> salto de línea
            </span>
            <span className="flex items-center gap-1.5">
              <kbd className="kbd">/</kbd> volver al campo
            </span>
          </span>
        )}
      </div>
    </form>
  );
}
