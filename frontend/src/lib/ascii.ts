// Motor de arte ASCII: escenas que se dibujan como una grilla de caracteres en
// un <canvas>. Cada escena es una función pura que, para cada cuadro, coloca
// caracteres con un color y una opacidad. El componente LienzoAscii se ocupa
// del tamaño, la pausa fuera de pantalla y el movimiento reducido.

/** Colores con nombre que puede usar una escena (se leen de las variables CSS). */
export type Tinta = "ink" | "muted" | "accent" | "doubt";
export const TINTAS: Tinta[] = ["ink", "muted", "accent", "doubt"];

export type Pincel = (x: number, y: number, ch: string, alpha: number, tinta?: Tinta) => void;

export type Cuadro = {
  /** segundos desde que empezó la escena */
  t: number;
  cols: number;
  rows: number;
  /** relación ancho/alto de una celda (para círculos redondos) */
  aspecto: number;
  /** posición del puntero en celdas, o null si no está encima */
  puntero: { x: number; y: number } | null;
  poner: Pincel;
};

export type Escena = (c: Cuadro) => void;

// ------------------------------------------------------------------ ruido
// Ruido de valor 3D, suave y barato. Alcanza para nubes, olas y niebla.
const P = new Uint8Array(512);
{
  const p = Array.from({ length: 256 }, (_, i) => i);
  let s = 1337;
  for (let i = 255; i > 0; i--) {
    s = (s * 16807) % 2147483647;
    const j = s % (i + 1);
    [p[i], p[j]] = [p[j], p[i]];
  }
  for (let i = 0; i < 512; i++) P[i] = p[i & 255];
}
const suave = (t: number) => t * t * (3 - 2 * t);
const h3 = (x: number, y: number, z: number) => P[P[P[x & 255] + (y & 255)] + (z & 255)] / 255;

export function ruido(x: number, y: number, z = 0) {
  const xi = Math.floor(x), yi = Math.floor(y), zi = Math.floor(z);
  const xf = suave(x - xi), yf = suave(y - yi), zf = suave(z - zi);
  const l = (a: number, b: number, t: number) => a + (b - a) * t;
  const x00 = l(h3(xi, yi, zi), h3(xi + 1, yi, zi), xf);
  const x10 = l(h3(xi, yi + 1, zi), h3(xi + 1, yi + 1, zi), xf);
  const x01 = l(h3(xi, yi, zi + 1), h3(xi + 1, yi, zi + 1), xf);
  const x11 = l(h3(xi, yi + 1, zi + 1), h3(xi + 1, yi + 1, zi + 1), xf);
  return l(l(x00, x10, yf), l(x01, x11, yf), zf);
}

/** Rampa de densidad clásica, de vacío a lleno. */
export const RAMPA = " .:-=+*#%@";
/** Katakana de media anchura: la voz japonesa del arte de texto. */
export const KANA = "ｱｲｳｴｵｶｷｸｹｺｻｼｽｾｿﾀﾁﾂﾃﾄﾅﾆﾇﾈﾉﾊﾋﾌﾍﾎﾏﾐﾑﾒﾓﾔﾕﾖﾗﾘﾙﾚﾛﾜﾝ";
/** Glifos para el cifrado de texto que se decodifica. */
export const CIFRA = "ｱｶｻﾀﾅﾊﾏﾔﾗﾜ#%&*+=<>?/\\|01";

export const deRampa = (v: number, rampa = RAMPA) =>
  rampa[Math.max(0, Math.min(rampa.length - 1, Math.floor(v * rampa.length)))];

// ------------------------------------------------------------------ escenas

/**
 * Fondo vivo de toda la app: una niebla de puntos que deriva muy despacio y
 * se aviva alrededor del puntero, como tinta que se corre en papel mojado.
 */
export const escenaFondo: Escena = ({ t, cols, rows, puntero, poner }) => {
  const rampa = " ··::";
  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < cols; x++) {
      const n = ruido(x * 0.055, y * 0.11, t * 0.06) * 0.7 + ruido(x * 0.17 + 40, y * 0.3, t * 0.12) * 0.3;
      let v = (n - 0.52) * 3.2;
      let a = 0.1;
      if (puntero) {
        const dx = (x - puntero.x) * 0.5;
        const dy = y - puntero.y;
        const d = Math.sqrt(dx * dx + dy * dy);
        if (d < 9) {
          const onda = Math.max(0, 1 - d / 9);
          v += onda * 0.9;
          a += onda * 0.32;
        }
      }
      if (v <= 0.05) continue;
      poner(x, y, deRampa(Math.min(v, 0.99), rampa), a);
    }
  }
};

/**
 * Monte Fuji con mar y nubes, a la manera de un grabado ukiyo-e pero hecho de
 * caracteres. Todo se mide en "filas" (x por el aspecto de la celda), así las
 * formas no se deforman con el tamaño del lienzo. El sol es un disco bermellón.
 */
export const escenaFuji: Escena = ({ t, cols, rows, aspecto, poner }) => {
  const H = rows;
  const W = cols * aspecto;
  const horizonte = 0.76 * H;
  const cimaX = 0.34 * W, cimaY = 0.1 * H;
  const L = 0.15 * W;
  const A = (horizonte - cimaY) * 1.12;
  const solX = 0.8 * W, solY = 0.33 * H, solR = 0.19 * H;
  const ladera = (X: number) => {
    const lado = Math.max(0, Math.abs(X - cimaX) - 0.018 * W);
    return cimaY + A * (1 - Math.exp(-lado / L));
  };
  for (let y = 0; y < rows; y++) {
    const Y = y + 0.5;
    for (let x = 0; x < cols; x++) {
      const X = (x + 0.5) * aspecto;
      const u = X / W;
      // mar
      if (Y >= horizonte) {
        const prof = (Y - horizonte) / (H - horizonte);
        const ola = Math.sin(X * 1.1 - t * 1.4 + prof * 7) + ruido(X * 0.35, prof * 5, t * 0.4) * 1.6;
        const reflejo = Math.abs(X - solX) < solR * (0.9 - prof * 0.5) && Math.sin(X * 3 + t * 3 + y * 2) > -0.1;
        if (reflejo && prof < 0.8) {
          poner(x, y, prof < 0.35 ? "=" : "-", 0.7 - prof * 0.45, "accent");
          continue;
        }
        if (ola > 1.35) poner(x, y, prof < 0.3 ? "~" : "^", 0.5 + prof * 0.3);
        else if (ola > 0.75) poner(x, y, "-", 0.26 + prof * 0.2);
        else if (ola > 0.3) poner(x, y, ".", 0.16);
        continue;
      }
      // monte: superficie bajo la ladera
      const borde = ladera(X);
      if (Y >= borde) {
        const izq = X < cimaX;
        const desdeBorde = Y - borde;
        const limiteNieve = (horizonte - cimaY) * 0.42;
        const dedo = 0.1 * H * (0.5 + 1.1 * ruido(X * 0.55, 1.3));
        const nieve = Y < cimaY + limiteNieve && desdeBorde < dedo;
        if (desdeBorde < 0.9) poner(x, y, izq ? "/" : "\\", 0.95);
        else if (nieve) poner(x, y, izq ? ":" : ".", 0.9);
        else {
          const rayado = (x + (izq ? y : -y) * 2) % 4 === 0;
          poner(x, y, rayado ? (izq ? "/" : "\\") : ".", izq ? 0.4 : 0.22);
        }
        continue;
      }
      // colinas bajas delante del monte
      const colina = horizonte - 0.1 * H + Math.sin(X * 0.22 + 1.2) * 0.035 * H + Math.sin(X * 0.61) * 0.015 * H;
      if (Y > colina) {
        poner(x, y, Y - colina < 1 ? "_" : ":", 0.3);
        continue;
      }
      // nubes: bandas horizontales que derivan (pasan por delante del sol)
      const banda = Math.sin(Y * 2.1) * 0.5 + 0.5;
      const nube = ruido(u * 5 - t * 0.05, Y * 0.55, 2.3);
      const esNube = Y > 0.08 * H && Y < 0.6 * H && nube > 0.6 && banda > 0.4;
      const dSol = Math.hypot(X - solX, Y - solY);
      if (esNube) {
        poner(x, y, nube > 0.7 ? "=" : "-", dSol < solR ? 0.75 : 0.42);
      } else if (dSol < solR) {
        poner(x, y, dSol < solR * 0.72 ? "@" : "o", 0.85, "accent");
      } else if (ruido(x * 0.9, y * 1.7, 9) > 0.985) {
        poner(x, y, "·", 0.4);
      }
    }
  }
};

/**
 * Ensō: el círculo zen de un solo trazo de pincel. Se dibuja, queda, se
 * desvanece y vuelve a empezar (ciclo de 8 s).
 */
export const escenaEnso: Escena = ({ t, cols, rows, aspecto, poner }) => {
  const ciclo = 8;
  const fase = (t % ciclo) / ciclo;
  const avance = Math.min(1, fase / 0.4);
  const desvanece = fase > 0.82 ? 1 - (fase - 0.82) / 0.18 : 1;
  const cx = cols / 2, cy = rows / 2;
  const R = Math.min(rows * 0.38, (cols * aspecto) * 0.38);
  const inicio = -Math.PI * 0.55;
  const total = Math.PI * 1.88;
  const rampa = ".:-=+*#%@";
  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < cols; x++) {
      const dx = (x - cx) * aspecto;
      const dy = y - cy;
      const d = Math.sqrt(dx * dx + dy * dy);
      let ang = Math.atan2(dy, dx) - inicio;
      ang = ((ang % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2);
      const s = ang / total;
      if (s > 1 || s > avance) continue;
      // el trazo es grueso al empezar y se abre en cerdas al final
      const grosor = (1 - s) * 2.6 + 0.9 + Math.sin(s * 20) * 0.25;
      const borde = Math.abs(d - R);
      if (borde > grosor) continue;
      const cerdas = s > 0.75 ? ruido(ang * 30, d * 2) : 1;
      if (cerdas < 0.35) continue;
      const tinta = (1 - borde / grosor) * (0.6 + 0.4 * (1 - s));
      poner(x, y, deRampa(tinta, rampa), (0.35 + tinta * 0.65) * desvanece);
    }
  }
  // el sello bermellón (hanko) abajo a la derecha
  const sx = Math.round(cx + R / aspecto + 2);
  const sy = Math.round(cy + R * 0.7);
  if (avance >= 1 && sx + 1 < cols && sy + 1 < rows) {
    poner(sx, sy, "工", 0.9 * desvanece, "accent");
  }
};

/**
 * Toro que gira (el clásico "donut" de Andy Sloane), iluminado con la rampa.
 * Representa la comparación: el mismo objeto visto desde distintos ángulos.
 */
export const escenaToro: Escena = ({ t, cols, rows, aspecto, poner }) => {
  const A = t * 0.7, B = t * 0.35;
  const cA = Math.cos(A), sA = Math.sin(A), cB = Math.cos(B), sB = Math.sin(B);
  const zbuf = new Float32Array(cols * rows);
  const lum = new Float32Array(cols * rows).fill(-1);
  const escala = Math.min(rows * 0.9, cols * aspecto * 0.55);
  for (let th = 0; th < 6.283; th += 0.07) {
    const ct = Math.cos(th), st = Math.sin(th);
    for (let ph = 0; ph < 6.283; ph += 0.02) {
      const cp = Math.cos(ph), sp = Math.sin(ph);
      const cx = 2 + ct; // R2 + R1 cos
      const cy = st;
      const x = cx * (cB * cp + sA * sB * sp) - cy * cA * sB;
      const y = cx * (sB * cp - sA * cB * sp) + cy * cA * cB;
      const z = 5 + cA * cx * sp + cy * sA;
      const ooz = 1 / z;
      const xp = Math.floor(cols / 2 + (escala * ooz * x) / aspecto);
      const yp = Math.floor(rows / 2 - escala * ooz * y * 0.95);
      if (xp < 0 || xp >= cols || yp < 0 || yp >= rows) continue;
      const L = cp * ct * sB - cA * ct * sp - sA * st + cB * (cA * st - ct * sA * sp);
      const i = yp * cols + xp;
      if (ooz > zbuf[i]) {
        zbuf[i] = ooz;
        lum[i] = L;
      }
    }
  }
  const rampa = ".,-~:;=!*#$@";
  for (let i = 0; i < lum.length; i++) {
    if (lum[i] < 0 && zbuf[i] === 0) continue;
    const v = Math.max(0, lum[i]) / 1.42;
    poner(i % cols, Math.floor(i / cols), deRampa(v * 0.999, rampa), 0.3 + v * 0.7);
  }
};

/**
 * Lluvia de muestras: columnas de caracteres que se re-sortean, y que de a
 * poco se asientan en el valor más frecuente. Es la variabilidad: muchas
 * tiradas que convergen.
 */
export const escenaMuestras: Escena = ({ t, cols, rows, poner }) => {
  const ciclo = 6;
  const fase = (t % ciclo) / ciclo;
  const asentado = Math.max(0, (fase - 0.15) / 0.6);
  const objetivo = "7";
  for (let x = 1; x < cols - 1; x += 3) {
    const semilla = ruido(x * 0.37, 1.7) * 10;
    const alto = Math.floor(rows * (0.35 + ruido(x * 0.21, 4) * 0.55));
    for (let y = rows - alto; y < rows; y++) {
      const fijo = ruido(x * 0.5, y * 0.5, 3) < asentado;
      const cambio = Math.floor(t * 9 + semilla + y * 0.7);
      const ch = fijo ? objetivo : String((cambio * 7 + x + y) % 10);
      const alpha = 0.25 + ((y - (rows - alto)) / alto) * 0.6;
      poner(x, y, ch, fijo ? Math.min(1, alpha + 0.2) : alpha * 0.8, fijo ? "ink" : "muted");
    }
  }
  if (fase > 0.75) {
    const msg = "moda = 7";
    const y = 1;
    const x0 = Math.floor(cols / 2 - msg.length / 2);
    for (let i = 0; i < msg.length; i++) poner(x0 + i, y, msg[i], 0.9, "accent");
  }
};

/**
 * Cubo de caracteres que gira: aristas dibujadas con la rampa según la
 * profundidad. Las llaves { } de un JSON, vistas como un sólido.
 */
export const escenaCubo: Escena = ({ t, cols, rows, aspecto, poner }) => {
  const A = t * 0.6, B = t * 0.4;
  const v: [number, number, number][] = [];
  for (const x of [-1, 1]) for (const y of [-1, 1]) for (const z of [-1, 1]) v.push([x, y, z]);
  const aristas: [number, number][] = [
    [0, 1], [0, 2], [0, 4], [1, 3], [1, 5], [2, 3], [2, 6], [3, 7], [4, 5], [4, 6], [5, 7], [6, 7],
  ];
  const rot = ([x, y, z]: [number, number, number]) => {
    const x1 = x * Math.cos(A) - z * Math.sin(A);
    const z1 = x * Math.sin(A) + z * Math.cos(A);
    const y1 = y * Math.cos(B) - z1 * Math.sin(B);
    const z2 = y * Math.sin(B) + z1 * Math.cos(B);
    return [x1, y1, z2] as const;
  };
  const escala = Math.min(rows * 0.3, cols * aspecto * 0.22);
  const proy = (p: readonly [number, number, number]) => {
    const f = 3.2 / (3.2 + p[2]);
    return [cols / 2 + (p[0] * escala * f) / aspecto, rows / 2 + p[1] * escala * f * 0.95, p[2]] as const;
  };
  const pts = v.map((p) => proy(rot(p)));
  for (const [a, b] of aristas) {
    const [x0, y0, z0] = pts[a];
    const [x1, y1, z1] = pts[b];
    const pasos = Math.ceil(Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0)) * 1.5) + 1;
    for (let i = 0; i <= pasos; i++) {
      const k = i / pasos;
      const z = z0 + (z1 - z0) * k;
      const cerca = 1 - (z + 1.8) / 3.6;
      poner(Math.round(x0 + (x1 - x0) * k), Math.round(y0 + (y1 - y0) * k), deRampa(cerca, ".:+*#@"), 0.3 + cerca * 0.7);
    }
  }
  for (const [x, y, z] of pts) {
    const cerca = 1 - (z + 1.8) / 3.6;
    poner(Math.round(x), Math.round(y), cerca > 0.5 ? "{" : "}", 0.95, cerca > 0.55 ? "accent" : "ink");
  }
};
