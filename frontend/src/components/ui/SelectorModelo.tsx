import { Check, ChevronsUpDown } from "lucide-react";
import { useEffect, useId, useRef, useState } from "react";
import type { ModelInfo } from "../../lib/api";
import { num } from "../../lib/formato";
import { parametrosEnNumero } from "../../lib/useModelos";

// VRAM que le queda libre a Ollama en la RTX 3060 Ti (8 GB menos lo que usa el
// sistema y el contexto). Sirve para mostrar qué modelos entran holgados.
export const VRAM_UTIL_GB = 6.4;

/** Barra fina: cuánto de la VRAM útil ocupa el modelo. Ámbar si no entra holgado. */
export function BarraVram({ gb }: { gb: number }) {
  const x = Math.min(gb / VRAM_UTIL_GB, 1);
  const justo = gb > VRAM_UTIL_GB * 0.85;
  return (
    <span className="relative block h-[3px] w-14 overflow-hidden bg-line-2" aria-hidden>
      <span
        className="absolute inset-y-0 left-0"
        style={{ width: `${x * 100}%`, background: justo ? "var(--doubt)" : "var(--accent)" }}
      />
    </span>
  );
}

/**
 * Selector de modelo con ficha: nombre, parámetros, cuantización y cuánto ocupa
 * en la GPU. Popover que crece desde el botón; se maneja con flechas, Enter y Esc.
 */
export default function SelectorModelo({
  modelos,
  valor,
  onChange,
  etiqueta = "Modelo",
}: {
  modelos: ModelInfo[];
  valor: string;
  onChange: (m: string) => void;
  etiqueta?: string;
}) {
  const [abierto, setAbierto] = useState(false);
  const [activo, setActivo] = useState(0);
  const raiz = useRef<HTMLDivElement>(null);
  const lista = useRef<HTMLDivElement>(null);
  const id = useId();
  const ordenados = [...modelos].sort((a, b) => parametrosEnNumero(a.parameters) - parametrosEnNumero(b.parameters));
  const actual = modelos.find((m) => m.name === valor);

  useEffect(() => {
    if (!abierto) return;
    setActivo(Math.max(0, ordenados.findIndex((m) => m.name === valor)));
    const fuera = (e: PointerEvent) => {
      if (!raiz.current?.contains(e.target as Node)) setAbierto(false);
    };
    document.addEventListener("pointerdown", fuera);
    lista.current?.focus();
    return () => document.removeEventListener("pointerdown", fuera);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [abierto]);

  const elegir = (m: ModelInfo) => {
    onChange(m.name);
    setAbierto(false);
  };

  return (
    <div ref={raiz} className="relative">
      <span id={`${id}-l`} className="sr-only">
        {etiqueta}
      </span>
      <button
        type="button"
        aria-haspopup="listbox"
        aria-expanded={abierto}
        aria-labelledby={`${id}-l ${id}-v`}
        onClick={() => setAbierto((a) => !a)}
        className="field flex items-center gap-2 text-left"
      >
        <span id={`${id}-v`} className="mono min-w-0 flex-1 truncate text-ink">
          {valor || "Cargando modelos…"}
        </span>
        {actual && <span className="num text-label text-muted">{actual.parameters}</span>}
        <ChevronsUpDown className="h-3.5 w-3.5 text-muted" aria-hidden />
      </button>

      {abierto && (
        <div
          ref={lista}
          role="listbox"
          tabIndex={-1}
          aria-label={etiqueta}
          aria-activedescendant={`${id}-o${activo}`}
          className="popover mt-1.5 max-h-80 w-[min(380px,90vw)] overflow-y-auto p-1 outline-none"
          onKeyDown={(e) => {
            if (e.key === "ArrowDown") {
              e.preventDefault();
              setActivo((a) => Math.min(ordenados.length - 1, a + 1));
            } else if (e.key === "ArrowUp") {
              e.preventDefault();
              setActivo((a) => Math.max(0, a - 1));
            } else if (e.key === "Enter") {
              e.preventDefault();
              if (ordenados[activo]) elegir(ordenados[activo]);
            } else if (e.key === "Escape") {
              e.stopPropagation();
              setAbierto(false);
              raiz.current?.querySelector("button")?.focus();
            }
          }}
        >
          <div className="flex items-center justify-between px-2.5 pb-1.5 pt-2">
            <span className="label">Modelos en Ollama</span>
            <span className="label">VRAM útil {num(VRAM_UTIL_GB, 1)} GB</span>
          </div>
          {ordenados.map((m, i) => (
            <button
              key={m.name}
              id={`${id}-o${i}`}
              type="button"
              role="option"
              aria-selected={m.name === valor}
              data-active={i === activo}
              onPointerMove={() => setActivo(i)}
              onClick={() => elegir(m)}
              className="opt"
            >
              <Check className="opt__check h-3.5 w-3.5 flex-none" aria-hidden />
              <span className="min-w-0 flex-1">
                <span className="mono block truncate text-small text-ink">{m.name}</span>
                <span className="block truncate text-label text-muted">
                  {[m.parameters, m.quantization, m.family].filter(Boolean).join(" · ")}
                </span>
              </span>
              <span className="flex flex-col items-end gap-1.5">
                <span className="num text-label text-ink-2">{num(m.size_gb, 1)} GB</span>
                <BarraVram gb={m.size_gb} />
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
