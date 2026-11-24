import { useLayoutEffect, useRef, type ReactNode } from "react";

export type Opcion<T extends string> = {
  valor: T;
  etiqueta: ReactNode;
  icono?: ReactNode;
  tip?: string;
  disabled?: boolean;
};

const reducido = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches;

/**
 * Control segmentado con un indicador que se desliza (240 ms, solo transform).
 * El indicador se anima únicamente si el cambio lo hizo el puntero sobre este
 * mismo control; con teclado (o un atajo global) salta a su lugar.
 */
export default function Segmentado<T extends string>({
  opciones,
  valor,
  onChange,
  etiqueta,
  sm = false,
  block = false,
  className = "",
}: {
  opciones: Opcion<T>[];
  valor: T;
  onChange: (v: T) => void;
  etiqueta: string;
  sm?: boolean;
  block?: boolean;
  className?: string;
}) {
  const contenedor = useRef<HTMLDivElement>(null);
  const botones = useRef(new Map<T, HTMLButtonElement>());
  const indicador = useRef<HTMLSpanElement>(null);
  const previo = useRef<{ x: number; w: number } | null>(null);
  const punteroEn = useRef(0);

  // Coloca el indicador; si corresponde, lo anima desde donde estaba (FLIP).
  const ubicar = (animar: boolean) => {
    const b = botones.current.get(valor);
    const el = indicador.current;
    if (!el) return;
    if (!b) {
      // Ninguna opción elegida (por ejemplo, parámetros a mano en vez de un preset).
      el.style.opacity = "0";
      previo.current = null;
      return;
    }
    const x = b.offsetLeft;
    const w = b.offsetWidth;
    el.style.width = `${w}px`;
    el.style.transform = `translateX(${x}px)`;
    el.style.opacity = "1";
    const p = previo.current;
    previo.current = { x, w };
    if (animar && p && (p.x !== x || p.w !== w) && !reducido()) {
      el.animate(
        [
          { transform: `translateX(${p.x}px) scaleX(${p.w / w})`, transformOrigin: "left center" },
          { transform: `translateX(${x}px) scaleX(1)`, transformOrigin: "left center" },
        ],
        { duration: 240, easing: "cubic-bezier(.2,.8,.2,1)" },
      );
    }
  };

  useLayoutEffect(() => {
    ubicar(performance.now() - punteroEn.current < 800);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [valor]);

  // Si cambia el tamaño (cargan las fuentes, se achica la ventana), reubicar sin animar.
  useLayoutEffect(() => {
    if (!contenedor.current) return;
    const ro = new ResizeObserver(() => ubicar(false));
    ro.observe(contenedor.current);
    // Las fuentes cambian el ancho de las opciones sin cambiar el del contenedor.
    let vivo = true;
    document.fonts?.ready.then(() => vivo && ubicar(false));
    return () => {
      vivo = false;
      ro.disconnect();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [valor]);

  const mover = (delta: number) => {
    const habilitadas = opciones.filter((o) => !o.disabled);
    const i = habilitadas.findIndex((o) => o.valor === valor);
    const otra = habilitadas[(i + delta + habilitadas.length) % habilitadas.length];
    onChange(otra.valor);
    botones.current.get(otra.valor)?.focus();
  };

  return (
    <div
      ref={contenedor}
      role="tablist"
      aria-label={etiqueta}
      className={`seg ${sm ? "seg--sm" : ""} ${block ? "seg--block" : ""} ${className}`}
      onPointerDown={() => (punteroEn.current = performance.now())}
      onKeyDown={(e) => {
        if (e.key === "ArrowRight") {
          e.preventDefault();
          mover(1);
        } else if (e.key === "ArrowLeft") {
          e.preventDefault();
          mover(-1);
        }
      }}
    >
      <span ref={indicador} className="seg__ind" style={{ opacity: 0 }} aria-hidden />
      {opciones.map((o) => (
        <button
          key={o.valor}
          ref={(el) => {
            if (el) botones.current.set(o.valor, el);
            else botones.current.delete(o.valor);
          }}
          type="button"
          role="tab"
          aria-selected={o.valor === valor}
          tabIndex={o.valor === valor ? 0 : -1}
          disabled={o.disabled}
          data-tip={o.tip}
          className="seg__opt"
          onClick={() => onChange(o.valor)}
        >
          {o.icono}
          {o.etiqueta}
        </button>
      ))}
    </div>
  );
}
