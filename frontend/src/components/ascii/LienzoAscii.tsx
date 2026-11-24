import { useEffect, useRef } from "react";
import { TINTAS, type Escena, type Tinta } from "../../lib/ascii";

const reducido = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches;

// Fuente con la que se dibujan las escenas (la misma monoespaciada de la interfaz).
const FUENTE = '"M PLUS 1 Code Variable", "M PLUS 1 Code", ui-monospace, monospace';

function leerColores(el: HTMLElement): Record<Tinta, string> {
  const css = getComputedStyle(el);
  const v = (n: string, f: string) => css.getPropertyValue(n).trim() || f;
  return {
    ink: v("--ink", "#ece8dc"),
    muted: v("--muted", "#9a968a"),
    accent: v("--accent", "#c2583f"),
    doubt: v("--doubt", "#b98d3a"),
  };
}

/**
 * Lienzo de arte ASCII. Dibuja una Escena como grilla de caracteres.
 * - Se pausa fuera de pantalla y con la pestaña oculta.
 * - Con "reducir movimiento" dibuja un solo cuadro quieto.
 * - Cada carácter se pinta desde un atlas precalculado (drawImage es mucho
 *   más rápido que fillText por celda).
 */
export default function LienzoAscii({
  escena,
  celda = 14,
  fps = 15,
  className = "",
  etiqueta,
  interactivo = false,
  pausado = false,
}: {
  escena: Escena;
  /** alto de la celda en px (el ancho sale de la fuente, ~0,5) */
  celda?: number;
  fps?: number;
  className?: string;
  /** descripción para lectores de pantalla; si falta, es decorativo */
  etiqueta?: string;
  /** si sigue al puntero (el fondo) */
  interactivo?: boolean;
  pausado?: boolean;
}) {
  const lienzo = useRef<HTMLCanvasElement>(null);
  const escenaRef = useRef(escena);
  escenaRef.current = escena;
  const pausadoRef = useRef(pausado);
  pausadoRef.current = pausado;

  useEffect(() => {
    const cv = lienzo.current;
    if (!cv) return;
    const ctx = cv.getContext("2d");
    if (!ctx) return;

    let vivo = true;
    let raf = 0;
    let visible = true;
    let cols = 0, rows = 0, cw = 0, ch = celda, dpr = 1;
    let puntero: { x: number; y: number } | null = null;
    // atlas: un canvas por tinta, con cada carácter usado en su celda
    const atlas = new Map<Tinta, HTMLCanvasElement>();
    const indice = new Map<string, number>();
    let colores = leerColores(cv);

    const glifo = (c: string) => {
      let i = indice.get(c);
      if (i !== undefined) return i;
      i = indice.size;
      indice.set(c, i);
      for (const t of TINTAS) {
        let a = atlas.get(t);
        const necesita = (i + 1) * cw * dpr;
        if (!a || a.width < necesita) {
          const nuevo = document.createElement("canvas");
          nuevo.width = Math.max(necesita * 2, 64 * cw * dpr);
          nuevo.height = Math.ceil(ch * dpr);
          if (a) nuevo.getContext("2d")!.drawImage(a, 0, 0);
          atlas.set(t, nuevo);
          a = nuevo;
        }
        const ac = a.getContext("2d")!;
        ac.font = `${Math.round(ch * 0.86 * dpr)}px ${FUENTE}`;
        ac.textBaseline = "middle";
        ac.textAlign = "center";
        ac.fillStyle = colores[t];
        ac.fillText(c, (i + 0.5) * cw * dpr, (ch * dpr) / 2);
      }
      return i;
    };

    const medir = () => {
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      const r = cv.getBoundingClientRect();
      ctx.font = `${Math.round(ch * 0.86)}px ${FUENTE}`;
      cw = Math.ceil(ctx.measureText("M").width) || Math.ceil(ch * 0.5);
      cols = Math.max(1, Math.floor(r.width / cw));
      rows = Math.max(1, Math.floor(r.height / ch));
      cv.width = Math.round(r.width * dpr);
      cv.height = Math.round(r.height * dpr);
      atlas.clear();
      indice.clear();
      colores = leerColores(cv);
    };

    const t0 = performance.now();
    let ultimo = 0;
    const dibujar = (ahora: number) => {
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.clearRect(0, 0, cv.width, cv.height);
      const ox = Math.floor((cv.width / dpr - cols * cw) / 2);
      const oy = Math.floor((cv.height / dpr - rows * ch) / 2);
      escenaRef.current({
        t: reducido() ? 2.5 : (ahora - t0) / 1000,
        cols,
        rows,
        aspecto: cw / ch,
        puntero,
        poner: (x, y, c, alpha, tinta = "ink") => {
          if (x < 0 || y < 0 || x >= cols || y >= rows || alpha <= 0.01 || c === " ") return;
          const i = glifo(c);
          ctx.globalAlpha = Math.min(1, alpha);
          ctx.drawImage(
            atlas.get(tinta)!,
            i * cw * dpr, 0, cw * dpr, ch * dpr,
            (ox + x * cw) * dpr, (oy + y * ch) * dpr, cw * dpr, ch * dpr,
          );
        },
      });
      ctx.globalAlpha = 1;
    };

    const bucle = (ahora: number) => {
      if (!vivo) return;
      raf = requestAnimationFrame(bucle);
      if (!visible || document.hidden || pausadoRef.current) return;
      if (ahora - ultimo < 1000 / fps) return;
      ultimo = ahora;
      dibujar(ahora);
    };

    const arrancar = () => {
      medir();
      if (reducido()) dibujar(performance.now());
      else raf = requestAnimationFrame(bucle);
    };

    // Esperar a la fuente: si no, el atlas se arma con la de reemplazo.
    document.fonts.load(`${ch}px ${FUENTE}`, "Mｱ").finally(() => vivo && arrancar());

    const ro = new ResizeObserver(() => {
      medir();
      if (reducido()) dibujar(performance.now());
    });
    ro.observe(cv);
    const io = new IntersectionObserver(([e]) => (visible = e.isIntersecting));
    io.observe(cv);

    const mover = (e: PointerEvent) => {
      const r = cv.getBoundingClientRect();
      const x = e.clientX - r.left, y = e.clientY - r.top;
      puntero = x >= 0 && y >= 0 && x <= r.width && y <= r.height ? { x: x / cw, y: y / ch } : null;
    };
    const salir = () => (puntero = null);
    if (interactivo) {
      window.addEventListener("pointermove", mover, { passive: true });
      document.addEventListener("pointerleave", salir);
    }

    return () => {
      vivo = false;
      cancelAnimationFrame(raf);
      ro.disconnect();
      io.disconnect();
      window.removeEventListener("pointermove", mover);
      document.removeEventListener("pointerleave", salir);
    };
  }, [celda, fps, interactivo]);

  return (
    <canvas
      ref={lienzo}
      className={`block h-full w-full ${className}`}
      role={etiqueta ? "img" : undefined}
      aria-label={etiqueta}
      aria-hidden={etiqueta ? undefined : true}
    />
  );
}
