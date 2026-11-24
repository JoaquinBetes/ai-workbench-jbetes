import { useEffect, useRef } from "react";
import { TINTAS, type Escena, type Tinta } from "../../lib/ascii";
import { movimiento } from "../../lib/movimiento";


// Fuente con la que se dibujan las escenas (la misma monoespaciada de la interfaz).
const FUENTE = '"IBM Plex Mono", ui-monospace, monospace';

function leerColores(el: HTMLElement): Record<Tinta, string> {
  const css = getComputedStyle(el);
  const v = (n: string, f: string) => css.getPropertyValue(n).trim() || f;
  return {
    ink: v("--ink", "#8af7ad"),
    muted: v("--muted", "#72c993"),
    accent: v("--accent", "#5ff59a"),
    doubt: v("--doubt", "#ffb238"),
    silk: v("--silk", "#dce8d9"),
    pista: v("--pista", "#1d6a3b"),
  };
}

// Caracteres de caja: se dibujan con rectángulos que tocan los bordes de la
// celda, así las pistas quedan continuas (ninguna fuente lo garantiza).
// brazos: arriba, derecha, abajo, izquierda; 1 = simple, 2 = doble
const CAJA: Record<string, [number, number, number, number]> = {
  "─": [0, 1, 0, 1], "│": [1, 0, 1, 0], "┌": [0, 1, 1, 0], "┐": [0, 0, 1, 1], "└": [1, 1, 0, 0], "┘": [1, 0, 0, 1],
  "├": [1, 1, 1, 0], "┤": [1, 0, 1, 1], "┬": [0, 1, 1, 1], "┴": [1, 1, 0, 1], "┼": [1, 1, 1, 1],
  "═": [0, 2, 0, 2], "║": [2, 0, 2, 0], "╔": [0, 2, 2, 0], "╗": [0, 0, 2, 2], "╚": [2, 2, 0, 0], "╝": [2, 0, 0, 2],
  "╢": [2, 0, 2, 1], "╟": [2, 1, 2, 0],
};

function dibujarCaja(c: CanvasRenderingContext2D, ch: string, x0: number, w: number, h: number, g: number) {
  const brazos = CAJA[ch];
  const cx = Math.round(x0 + w / 2 - g / 2), cy = Math.round(h / 2 - g / 2);
  const sep = g * 2;
  const tramo = (dir: number, tipo: number) => {
    const offs = tipo === 2 ? [-sep / 2 - g / 2, sep / 2 - g / 2] : [0];
    for (const o of offs) {
      if (dir === 0) c.fillRect(cx + o, 0, g, cy + g);
      if (dir === 2) c.fillRect(cx + o, cy, g, h - cy);
      if (dir === 1) c.fillRect(cx, cy + o, x0 + w - cx, g);
      if (dir === 3) c.fillRect(x0, cy + o, cx - x0 + g, g);
    }
  };
  brazos.forEach((tipo, dir) => tipo && tramo(dir, tipo));
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
    // brillo de fósforo: lo encendido (tinta accent) se copia a un lienzo chico y
    // se suma encima agrandado; el reescalado hace de desenfoque, casi gratis.
    const halo = document.createElement("canvas");
    const hctx = halo.getContext("2d")!;
    const REDUCCION = 4;
    let barrido: CanvasPattern | null = null;

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
        ac.fillStyle = colores[t];
        if (CAJA[c]) {
          dibujarCaja(ac, c, i * cw * dpr, cw * dpr, ch * dpr, Math.max(1, Math.round(dpr)));
          continue;
        }
        ac.font = `${Math.round(ch * 0.86 * dpr)}px ${FUENTE}`;
        ac.textBaseline = "middle";
        ac.textAlign = "center";
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
      const fila = document.createElement("canvas");
      fila.width = 1;
      fila.height = Math.max(3, Math.round(3 * dpr));
      const fctx = fila.getContext("2d")!;
      fctx.fillStyle = "#000";
      fctx.fillRect(0, 0, 1, Math.max(1, Math.round(dpr)));
      barrido = ctx.createPattern(fila, "repeat");
      halo.width = Math.max(1, Math.ceil(cv.width / REDUCCION));
      halo.height = Math.max(1, Math.ceil(cv.height / REDUCCION));
      atlas.clear();
      indice.clear();
      colores = leerColores(cv);
    };

    // El reloj de la escena arranca a los 2,5 s (el primer cuadro ya tiene de
    // todo) y no corre mientras el movimiento está en pausa: al reanudar, la
    // escena sigue desde donde quedó.
    const t0 = performance.now() - 2500;
    let enPausa = 0;
    let pausaDesde: number | null = null;
    let quieto = false;
    const reloj = (ahora: number) => ((pausaDesde ?? ahora) - t0 - enPausa) / 1000;
    let ultimo = 0;
    const dibujar = (ahora: number) => {
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.clearRect(0, 0, cv.width, cv.height);
      hctx.clearRect(0, 0, halo.width, halo.height);
      let hayHalo = false;
      const ox = Math.floor((cv.width / dpr - cols * cw) / 2);
      const oy = Math.floor((cv.height / dpr - rows * ch) / 2);
      escenaRef.current({
        t: reloj(ahora),
        ahora,
        cols,
        rows,
        aspecto: cw / ch,
        puntero,
        poner: (x, y, c, alpha, tinta = "ink") => {
          if (x < 0 || y < 0 || x >= cols || y >= rows || alpha <= 0.01 || c === " ") return;
          const i = glifo(c);
          const a = Math.min(1, alpha);
          const dx = (ox + x * cw) * dpr, dy = (oy + y * ch) * dpr;
          ctx.globalAlpha = a;
          ctx.drawImage(atlas.get(tinta)!, i * cw * dpr, 0, cw * dpr, ch * dpr, dx, dy, cw * dpr, ch * dpr);
          if (tinta === "accent" && a > 0.3) {
            hayHalo = true;
            hctx.globalAlpha = a;
            hctx.fillStyle = colores.accent;
            hctx.fillRect(dx / REDUCCION, dy / REDUCCION + (ch * dpr) / REDUCCION / 4, (cw * dpr) / REDUCCION, (ch * dpr) / REDUCCION / 2);
          }
        },
      });
      if (hayHalo) {
        ctx.globalCompositeOperation = "lighter";
        ctx.imageSmoothingEnabled = true;
        ctx.globalAlpha = 0.55;
        ctx.drawImage(halo, 0, 0, cv.width, cv.height);
        ctx.globalAlpha = 0.3;
        ctx.drawImage(halo, -cw * dpr, -ch * dpr * 0.5, cv.width + cw * dpr * 2, cv.height + ch * dpr);
        ctx.globalCompositeOperation = "source-over";
      }
      // líneas de barrido: solo sobre el dibujo (destination-out le saca brillo
      // a una fila de cada tres), nunca sobre el texto de la interfaz
      if (barrido) {
        ctx.globalCompositeOperation = "destination-out";
        ctx.globalAlpha = 0.3;
        ctx.fillStyle = barrido;
        ctx.fillRect(0, 0, cv.width, cv.height);
        ctx.globalCompositeOperation = "source-over";
      }
      ctx.globalAlpha = 1;
    };

    // El IntersectionObserver a veces no avisa cuando un ancestro termina una
    // animación de clip-path; cada medio segundo se confirma a mano.
    let revisado = 0;
    const confirmarVisible = (ahora: number) => {
      if (visible || ahora - revisado < 500) return;
      revisado = ahora;
      const r = cv.getBoundingClientRect();
      visible = r.width > 0 && r.height > 0 && r.bottom > 0 && r.right > 0 && r.top < innerHeight && r.left < innerWidth;
    };
    const bucle = (ahora: number) => {
      if (!vivo) return;
      raf = requestAnimationFrame(bucle);
      confirmarVisible(ahora);
      if (!visible || document.hidden) return;
      if (!movimiento.activo() || pausadoRef.current) {
        if (pausaDesde === null) pausaDesde = ahora;
        if (!quieto) {
          dibujar(ahora);
          quieto = true;
        }
        return;
      }
      if (pausaDesde !== null) {
        enPausa += ahora - pausaDesde;
        pausaDesde = null;
      }
      quieto = false;
      if (ahora - ultimo < 1000 / fps) return;
      ultimo = ahora;
      dibujar(ahora);
    };

    const arrancar = () => {
      medir();
      raf = requestAnimationFrame(bucle);
    };

    // Esperar a la fuente: si no, el atlas se arma con la de reemplazo.
    document.fonts.load(`${ch}px ${FUENTE}`, "M@#").finally(() => vivo && arrancar());

    const ro = new ResizeObserver(() => {
      medir();
      quieto = false; // en pausa, se vuelve a dibujar el cuadro con el tamaño nuevo
    });
    ro.observe(cv);
    const io = new IntersectionObserver(([e]) => (visible = e.isIntersecting));
    io.observe(cv);

    const mover = (e: PointerEvent) => {
      const r = cv.getBoundingClientRect();
      // también fuera del lienzo: el ojo mira hacia el puntero aunque esté lejos
      puntero = { x: (e.clientX - r.left) / cw, y: (e.clientY - r.top) / ch };
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
