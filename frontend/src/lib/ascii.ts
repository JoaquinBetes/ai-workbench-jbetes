// Motor de arte ASCII: escenas que se dibujan como una grilla de caracteres en
// un <canvas>. Cada escena es una función que, para cada cuadro, coloca
// caracteres con una tinta y una opacidad. El componente LienzoAscii se ocupa
// del tamaño, la pausa fuera de pantalla, el brillo de fósforo y el movimiento
// reducido.

/** Tintas con nombre que puede usar una escena (se leen de las variables CSS). */
export type Tinta = "ink" | "muted" | "accent" | "doubt" | "silk" | "pista";
export const TINTAS: Tinta[] = ["ink", "muted", "accent", "doubt", "silk", "pista"];

export type Pincel = (x: number, y: number, ch: string, alpha: number, tinta?: Tinta) => void;

export type Cuadro = {
  /** segundos desde que empezó la escena */
  t: number;
  /** reloj absoluto (performance.now), para los pulsos que disparan los tokens */
  ahora: number;
  cols: number;
  rows: number;
  /** relación ancho/alto de una celda (para círculos redondos) */
  aspecto: number;
  /** posición del puntero en celdas (puede caer fuera del lienzo), o null */
  puntero: { x: number; y: number } | null;
  poner: Pincel;
};

export type Escena = (c: Cuadro) => void;

// ------------------------------------------------------------------ pulsos
// Cada token que llega del modelo dispara un pulso: una señal que recorre una
// pista de la placa del fondo. Es la firma de la interfaz: la placa trabaja
// cuando el modelo trabaja.
const PULSOS: number[] = [];
export function emitirPulso() {
  PULSOS.push(performance.now());
  if (PULSOS.length > 240) PULSOS.splice(0, PULSOS.length - 240);
}
function pulsosRecientes(ahora: number, ventana: number) {
  const limite = ahora - ventana;
  while (PULSOS.length && PULSOS[0] < limite) PULSOS.shift();
  return PULSOS;
}

// ------------------------------------------------------------------ ruido y azar
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

/** Generador con semilla (LCG): la misma placa para el mismo tamaño. */
function azar(semilla: number) {
  let s = semilla >>> 0 || 1;
  return () => (s = (Math.imul(s, 1664525) + 1013904223) >>> 0) / 4294967296;
}

/** Matriz de Bayer 4×4 (0 a 1): tramado ordenado, como las imágenes de 1 bit. */
export const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5].map((v) => (v + 0.5) / 16);

/** Rampa de densidad clásica, de vacío a lleno. */
export const RAMPA = " .:-=+*#%@";
/** Glifos para el texto que se descifra. */
export const CIFRA = "#%&*+=<>?/\\|01$@!{}[]~^";

export const deRampa = (v: number, rampa = RAMPA) =>
  rampa[Math.max(0, Math.min(rampa.length - 1, Math.floor(v * rampa.length)))];

// ------------------------------------------------------------------ placa
// Una placa es un conjunto de pistas (caminos de celdas) y piezas fijas (chips,
// etiquetas). Las pistas se dibujan con caracteres de caja (─ │ ┌ ┐ └ ┘) y
// terminan en vías (o) o pads (▪).

const DX = [0, 1, 0, -1];
const DY = [-1, 0, 1, 0];
// brazos: arriba 1, derecha 2, abajo 4, izquierda 8
const CAJA: Record<number, string> = { 10: "─", 5: "│", 6: "┌", 12: "┐", 3: "└", 9: "┘", 2: "─", 8: "─", 1: "│", 4: "│" };

type Pista = { celdas: number[]; glifos: string[]; vel: number; fase: number; ambiente: boolean; sentido: 1 | -1; sale?: boolean };
type Fijo = { i: number; ch: string; alpha: number; tinta: Tinta };
type Placa = { cols: number; rows: number; pistas: Pista[]; fijos: Fijo[] };

class Armador {
  ocupado: Uint8Array;
  pistas: Pista[] = [];
  fijos: Fijo[] = [];
  constructor(public cols: number, public rows: number, public r: () => number) {
    this.ocupado = new Uint8Array(cols * rows);
  }
  libre(x: number, y: number) {
    return x >= 0 && y >= 0 && x < this.cols && y < this.rows && !this.ocupado[y * this.cols + x];
  }
  marcar(x: number, y: number, w = 1, h = 1) {
    for (let j = y; j < y + h; j++)
      for (let i = x; i < x + w; i++) if (i >= 0 && j >= 0 && i < this.cols && j < this.rows) this.ocupado[j * this.cols + i] = 1;
  }
  fijo(x: number, y: number, ch: string, alpha: number, tinta: Tinta) {
    if (x < 0 || y < 0 || x >= this.cols || y >= this.rows) return;
    this.fijos.push({ i: y * this.cols + x, ch, alpha, tinta });
  }
  texto(x: number, y: number, s: string, alpha: number, tinta: Tinta) {
    for (let k = 0; k < s.length; k++) if (s[k] !== " ") this.fijo(x + k, y, s[k], alpha, tinta);
  }
  /**
   * Traza una pista desde (x, y) yendo en `dir`. `segmentos` fuerza los giros
   * ([dir, largo], ...); sin segmentos, camina al azar con algún giro.
   * `pegada` indica que el primer extremo sale de un pin (no lleva vía).
   */
  trazar(x: number, y: number, dir: number, opciones: { largo?: number; segmentos?: [number, number][]; pegada?: boolean; minimo?: number } = {}) {
    const celdas: number[] = [];
    const dirs: number[] = [];
    const plan: number[] = [];
    if (opciones.segmentos) for (const [d, n] of opciones.segmentos) for (let k = 0; k < n; k++) plan.push(d);
    const largo = opciones.segmentos ? plan.length : opciones.largo ?? 30;
    let d = dir;
    let tramo = 0;
    for (let paso = 0; paso < largo; paso++) {
      if (opciones.segmentos) d = plan[paso];
      if (!this.libre(x, y)) break;
      this.ocupado[y * this.cols + x] = 1;
      celdas.push(y * this.cols + x);
      dirs.push(d);
      tramo++;
      if (!opciones.segmentos && tramo > 3 && this.r() < 0.13) {
        const nd = (d + (this.r() < 0.5 ? 1 : 3)) % 4;
        if (this.libre(x + DX[nd], y + DY[nd])) {
          d = nd;
          dirs[dirs.length - 1] = d;
          tramo = 0;
        }
      }
      x += DX[d];
      y += DY[d];
    }
    if (celdas.length < (opciones.minimo ?? 5)) {
      for (const c of celdas) this.ocupado[c] = 0;
      return null;
    }
    const glifos = celdas.map((_, k) => {
      let brazos = 1 << dirs[k];
      if (k > 0) brazos |= 1 << ((dirs[k - 1] + 2) % 4);
      else if (opciones.pegada) brazos |= 1 << ((dirs[0] + 2) % 4);
      return CAJA[brazos] ?? "+";
    });
    if (!opciones.pegada) glifos[0] = "o";
    glifos[glifos.length - 1] = this.r() < 0.5 ? "o" : "▪";
    const pista: Pista = {
      celdas,
      glifos,
      vel: 6 + this.r() * 10,
      fase: this.r() * 200,
      ambiente: this.r() < 0.3,
      sentido: 1,
    };
    this.pistas.push(pista);
    return pista;
  }
  /** Un chip visto desde arriba: cuerpo con borde, pines arriba y abajo, y su nombre. */
  chip(x: number, y: number, w: number, h: number, nombre: string, doble = false) {
    const b = doble ? { h: "═", v: "║", a: "╔", b: "╗", c: "╚", d: "╝" } : { h: "─", v: "│", a: "┌", b: "┐", c: "└", d: "┘" };
    const pines: { x: number; y: number; dir: number }[] = [];
    for (let i = 0; i < w; i++) {
      const borde = i === 0 || i === w - 1;
      const pin = !borde && i % 2 === 1;
      this.fijo(x + i, y, i === 0 ? b.a : i === w - 1 ? b.b : pin ? "┴" : b.h, 0.55, "pista");
      this.fijo(x + i, y + h - 1, i === 0 ? b.c : i === w - 1 ? b.d : pin ? "┬" : b.h, 0.55, "pista");
      if (pin) {
        pines.push({ x: x + i, y: y - 1, dir: 0 });
        pines.push({ x: x + i, y: y + h, dir: 2 });
      }
    }
    for (let j = 1; j < h - 1; j++) {
      this.fijo(x, y + j, b.v, 0.55, "pista");
      this.fijo(x + w - 1, y + j, b.v, 0.55, "pista");
    }
    this.texto(x + Math.floor((w - nombre.length) / 2), y + Math.floor(h / 2), nombre, 0.5, "silk");
    this.fijo(x + 1, y + 1, "•", 0.5, "silk"); // marca del pin 1
    this.marcar(x - 1, y - 1, w + 2, h + 2);
    for (const p of pines) this.ocupado[p.y * this.cols + p.x] = 0;
    return pines;
  }
  placa(): Placa {
    return { cols: this.cols, rows: this.rows, pistas: this.pistas, fijos: this.fijos };
  }
}

const NOMBRES = ["ATTN", "SOFTMAX", "KV CACHE", "EMBED", "DECODER", "LOGITS", "TOP-K", "SAMPLER", "TOKENIZER", "MLP"];

function armarFondo(cols: number, rows: number): Placa {
  const r = azar(cols * 7919 + rows * 104729);
  const a = new Armador(cols, rows, r);
  // chips: uno cada ~2600 celdas, con pistas que salen de cada pin
  const nChips = Math.max(1, Math.min(7, Math.floor((cols * rows) / 2600)));
  for (let k = 0, intentos = 0; k < nChips && intentos < 60; intentos++) {
    const nombre = NOMBRES[Math.floor(r() * NOMBRES.length)];
    const w = Math.max(nombre.length + 4, 11 + Math.floor(r() * 8)) | 1;
    const h = 5 + Math.floor(r() * 2);
    const x = 3 + Math.floor(r() * Math.max(1, cols - w - 6));
    const y = 3 + Math.floor(r() * Math.max(1, rows - h - 6));
    let ok = true;
    for (let j = y - 3; j < y + h + 3 && ok; j++) for (let i = x - 3; i < x + w + 3; i++) if (!a.libre(i, j)) { ok = false; break; }
    if (!ok) continue;
    const pines = a.chip(x, y, w, h, nombre);
    for (const p of pines) a.trazar(p.x, p.y, p.dir, { largo: 8 + Math.floor(r() * 26), pegada: true, minimo: 2 });
    k++;
  }
  // buses: tandas de pistas paralelas con un giro, anidadas para no cruzarse
  const nBuses = Math.max(1, Math.floor((cols * rows) / 3500));
  for (let k = 0; k < nBuses; k++) {
    const n = 3 + Math.floor(r() * 4);
    const x0 = Math.floor(r() * cols * 0.6);
    const y0 = 2 + Math.floor(r() * (rows - n - 4));
    const l1 = 12 + Math.floor(r() * 30);
    const baja = r() < 0.5;
    const l2 = 4 + Math.floor(r() * 10);
    for (let j = 0; j < n; j++) {
      const giro = baja ? l1 - j * 2 : l1 - (n - 1 - j) * 2;
      a.trazar(x0, y0 + j, 1, { segmentos: [[1, giro], [baja ? 2 : 0, l2 + (baja ? j : n - 1 - j)], [1, 6 + Math.floor(r() * 10)]], minimo: 4 });
    }
  }
  // pistas sueltas hasta cubrir ~13 % de la placa
  const meta = cols * rows * 0.13;
  let cubierto = 0;
  for (let intentos = 0; intentos < 900 && cubierto < meta; intentos++) {
    const x = Math.floor(r() * cols), y = Math.floor(r() * rows);
    const p = a.trazar(x, y, Math.floor(r() * 4), { largo: 10 + Math.floor(r() * 40) });
    if (p) cubierto += p.celdas.length;
  }
  return a.placa();
}

/** Dibuja la placa, el brillo del puntero y los pulsos (de ambiente y de tokens). */
function dibujarPlaca(
  placa: Placa,
  { t, ahora, cols, aspecto, puntero, poner }: Cuadro,
  o: { base: number; radio: number; velToken: number; brillo?: number },
) {
  const px = puntero?.x ?? -999, py = puntero?.y ?? -999;
  for (const f of placa.fijos) poner(f.i % cols, Math.floor(f.i / cols), f.ch, f.alpha * (o.brillo ?? 1), f.tinta);
  for (const p of placa.pistas) {
    for (let k = 0; k < p.celdas.length; k++) {
      const c = p.celdas[k];
      const x = c % cols, y = Math.floor(c / cols);
      poner(x, y, p.glifos[k], o.base, "pista");
      if (puntero) {
        const d = Math.hypot((x - px) * aspecto, y - py);
        if (d < o.radio) poner(x, y, p.glifos[k], (1 - d / o.radio) * 0.55, "muted");
      }
    }
  }
  const cola = (p: Pista, cabeza: number, fuerza: number) => {
    for (let k = 0; k < 6; k++) {
      const i = Math.floor(cabeza) - k * p.sentido;
      if (i < 0 || i >= p.celdas.length) continue;
      const c = p.celdas[i];
      poner(c % cols, Math.floor(c / cols), p.glifos[i], fuerza * (k === 0 ? 1 : 0.55 / k), "accent");
    }
  };
  for (const p of placa.pistas) {
    if (!p.ambiente) continue;
    const ciclo = p.celdas.length + 40;
    cola(p, (t * p.vel + p.fase) % ciclo, 0.55);
  }
  if (!placa.pistas.length) return;
  for (const ts of pulsosRecientes(ahora, 4000)) {
    const p = placa.pistas[Math.floor(ts * 7.31) % placa.pistas.length];
    const cabeza = ((ahora - ts) / 1000) * o.velToken;
    if (cabeza < p.celdas.length + 6) cola(p, cabeza, 0.95);
  }
}

// ------------------------------------------------------------------ escenas

/**
 * Fondo vivo de toda la app: una placa de circuito dibujada en ASCII, con
 * chips que llevan nombres de las piezas de un modelo (ATTN, SOFTMAX, KV
 * CACHE…). Algunas pistas llevan señales todo el tiempo; cada token que genera
 * el modelo dispara un pulso más. Alrededor del puntero, el cobre se aviva.
 */
export function crearEscenaFondo(): Escena {
  let placa: Placa | null = null;
  return (c) => {
    if (!placa || placa.cols !== c.cols || placa.rows !== c.rows) placa = armarFondo(c.cols, c.rows);
    dibujarPlaca(placa, c, { base: 0.42, radio: 11, velToken: 34 });
  };
}

/**
 * El modelo como chip: un encapsulado grande en el centro con pistas que entran
 * por la izquierda (el prompt) y salen por la derecha (los tokens). Las señales
 * que salen llevan letras: son los tokens que el chip va sorteando.
 */
export function crearEscenaChip(palabras = ["leña", "carbón", "amigos", "paciencia", "fuego"]): Escena {
  let placa: Placa | null = null;
  let chipBox = { x: 0, y: 0, w: 0, h: 0 };
  const letras = palabras.join(" ");
  return (c) => {
    const { cols, rows, t, poner } = c;
    if (!placa || placa.cols !== cols || placa.rows !== rows) {
      const a = new Armador(cols, rows, azar(cols * 31 + rows));
      const w = Math.min(Math.max(19, Math.floor(cols * 0.26)) | 1, cols - 6);
      const h = Math.max(5, Math.min(rows - 4, Math.floor(rows * 0.62)));
      const x = Math.floor((cols - w) / 2), y = Math.floor((rows - h) / 2);
      chipBox = { x, y, w, h };
      // cuerpo con borde doble y pines a los costados
      for (let i = 0; i < w; i++) {
        a.fijo(x + i, y, i === 0 ? "╔" : i === w - 1 ? "╗" : "═", 0.9, "muted");
        a.fijo(x + i, y + h - 1, i === 0 ? "╚" : i === w - 1 ? "╝" : "═", 0.9, "muted");
      }
      for (let j = 1; j < h - 1; j++) {
        a.fijo(x, y + j, "╢", 0.9, "muted");
        a.fijo(x + w - 1, y + j, "╟", 0.9, "muted");
      }
      a.marcar(x, y, w, h);
      // entradas (izquierda) y salidas (derecha), cada una con un escalón hacia
      // afuera; los pines de los extremos doblan antes, así las pistas no se cruzan
      for (let j = 1; j < h - 1; j++) {
        const escalon = Math.round((j - (h - 1) / 2) * 1.1);
        const vertical = escalon < 0 ? 0 : 2;
        const antes = 2 + Math.min(j - 1, h - 2 - j) * 2;
        a.trazar(x - 1, y + j, 3, { segmentos: [[3, antes], [vertical, Math.abs(escalon)], [3, cols]], pegada: true, minimo: 3 });
        const sal = a.trazar(x + w, y + j, 1, { segmentos: [[1, antes], [vertical, Math.abs(escalon)], [1, cols]], pegada: true, minimo: 3 });
        if (sal) sal.sale = true;
      }
      placa = a.placa();
    }
    const { x, y, w, h } = chipBox;
    for (const f of placa.fijos) poner(f.i % cols, Math.floor(f.i / cols), f.ch, f.alpha, f.tinta);
    // la pastilla: ruido de silicio que trabaja
    for (let j = 1; j < h - 1; j++) {
      for (let i = 2; i < w - 2; i++) {
        const n = ruido(i * 0.5, j * 0.9, t * 1.6);
        if (n > 0.55) poner(x + i, y + j, n > 0.7 ? "▓" : n > 0.62 ? "▒" : "░", 0.18 + (n - 0.55) * 1.2, "pista");
      }
    }
    const nombre = "SAMPLER";
    const ny = y + Math.floor(h / 2);
    const nx = x + Math.floor((w - nombre.length) / 2);
    for (let k = 0; k < nombre.length; k++) poner(nx + k, ny, nombre[k], 0.95, "silk");
    poner(x + 1, y + 1, "•", 0.9, "silk");
    // pistas y señales: las de entrada van hacia el chip; las de salida llevan letras
    for (const p of placa.pistas) for (let k = 0; k < p.celdas.length; k++) {
      const cc = p.celdas[k];
      poner(cc % cols, Math.floor(cc / cols), p.glifos[k], 0.5, "pista");
    }
    placa.pistas.forEach((p, n) => {
      const sale = !!p.sale;
      const L = p.celdas.length;
      const ciclo = L + 14;
      const vel = sale ? 16 : 12;
      const pos = (t * vel + n * 9.3) % ciclo;
      // las entradas se recorren desde el borde hacia el chip
      const idx = sale ? Math.floor(pos) : L - 1 - Math.floor(pos);
      if (idx < 0 || idx >= L) return;
      for (let k = 0; k < 5; k++) {
        const i = sale ? idx - k : idx + k;
        if (i < 0 || i >= L) continue;
        const cc = p.celdas[i];
        const ch = sale && k === 0 ? letras[(Math.floor(t * vel / ciclo) * 3 + n) % letras.length] : p.glifos[i];
        poner(cc % cols, Math.floor(cc / cols), ch === " " ? "•" : ch, k === 0 ? 1 : 0.5 / k, "accent");
      }
    });
  };
}

/**
 * Globo de "ciberespacio": una esfera que gira, con continentes de ruido,
 * paralelos y meridianos, nodos que titilan y un satélite en órbita.
 */
export const escenaGlobo: Escena = ({ t, cols, rows, aspecto, poner }) => {
  const cx = cols / 2, cy = rows / 2;
  const R = Math.min(rows * 0.44, cols * aspecto * 0.34);
  const giro = t * 0.35;
  const incl = 0.38;
  const ci = Math.cos(incl), si = Math.sin(incl);
  const cg = Math.cos(giro), sg = Math.sin(giro);
  const paso = Math.PI / 9;
  const nodos: [number, number][] = [[0.6, -1.0], [0.3, 0.4], [-0.4, 1.9], [0.9, 2.6], [-0.2, -2.3], [0.1, 3.9]];
  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < cols; x++) {
      const X = (x + 0.5 - cx) * aspecto, Y = y + 0.5 - cy;
      const d2 = X * X + Y * Y;
      if (d2 > R * R) continue;
      const Z = Math.sqrt(R * R - d2);
      let nx = X / R, ny = Y / R, nz = Z / R;
      // deshacer la inclinación y el giro para saber qué punto del globo se ve
      const ny1 = ny * ci + nz * si, nz1 = -ny * si + nz * ci;
      ny = ny1; nz = nz1;
      const nx2 = nx * cg - nz * sg, nz2 = nx * sg + nz * cg;
      nx = nx2; nz = nz2;
      const lat = Math.asin(-ny), lon = Math.atan2(nx, nz);
      const luz = Math.max(0, (X / R) * -0.45 + (Y / R) * -0.35 + (Z / R) * 0.82);
      const tierra = ruido(lon * 1.6 + 10, lat * 2.4 + 10, 1.5) + ruido(lon * 4, lat * 5, 3) * 0.25;
      const enLat = Math.abs(((lat + 10 * paso) % paso) - paso / 2) > paso / 2 - 0.035;
      const enLon = Math.abs(((lon + 20 * paso) % paso) - paso / 2) > paso / 2 - 0.035 * (1 / Math.max(0.2, Math.cos(lat)));
      const borde = Math.sqrt(d2) > R - 0.55;
      if (borde) poner(x, y, "o", 0.35 + luz * 0.3, "muted");
      else if (tierra > 0.64) poner(x, y, deRampa(0.3 + luz * 0.7, ":-=+*#%@"), 0.4 + luz * 0.6);
      else if (enLat || enLon) poner(x, y, enLat && enLon ? "+" : enLat ? "-" : "|", 0.25 + luz * 0.45, "muted");
      else if (BAYER[(y & 3) * 4 + (x & 3)] < luz * 0.7) poner(x, y, ".", 0.2 + luz * 0.3, "muted");
    }
  }
  // nodos de la red: titilan cuando están del lado visible
  nodos.forEach(([la, lo], k) => {
    const cl = Math.cos(la);
    let px = cl * Math.sin(lo), py = -Math.sin(la), pz = cl * Math.cos(lo);
    const px2 = px * cg + pz * sg, pz2 = -px * sg + pz * cg;
    px = px2; pz = pz2;
    const py3 = py * ci - pz * si, pz3 = py * si + pz * ci;
    py = py3; pz = pz3;
    if (pz < 0.1) return;
    const sx = Math.round(cx + (px * R) / aspecto - 0.5), sy = Math.round(cy + py * R - 0.5);
    const on = Math.sin(t * 3 + k * 1.7) > -0.2;
    poner(sx, sy, on ? "@" : "o", on ? 1 : 0.5, "accent");
  });
  // satélite en órbita inclinada, con estela
  for (let k = 0; k < 14; k++) {
    const a = t * 0.9 - k * 0.06;
    const ox = Math.cos(a) * R * 1.32, oz = Math.sin(a) * R * 1.32;
    const oy = Math.sin(a) * R * 0.32;
    if (oz < 0 && ox * ox + oy * oy < R * R) continue; // detrás del globo
    poner(Math.round(cx + ox / aspecto), Math.round(cy - oy), k === 0 ? "*" : ".", k === 0 ? 1 : 0.6 - k * 0.04, k === 0 ? "accent" : "muted");
  }
};

/**
 * Un ojo tramado, como una foto de 1 bit: el iris busca al puntero y cada
 * tanto parpadea. Es el inspector: mira el token que elijas.
 */
export const escenaOjo: Escena = ({ t, cols, rows, aspecto, puntero, poner }) => {
  const cx = cols / 2, cy = rows / 2;
  const W = Math.min(cols * aspecto * 0.46, rows * 1.25);
  const A = W * 0.5;
  // parpadeo: cada ~5 s, se cierra 160 ms
  const ciclo = t % 5.2;
  const parpado = ciclo > 4.95 ? Math.abs(Math.cos(((ciclo - 4.95) / 0.25) * Math.PI)) : 1;
  const abre = A * parpado;
  // hacia dónde mira
  let mx = 0, my = 0;
  if (puntero) {
    const dx = (puntero.x - cx) * aspecto, dy = puntero.y - cy;
    const d = Math.hypot(dx, dy) || 1;
    const k = Math.min(1, d / (W * 1.5));
    mx = (dx / d) * W * 0.3 * k;
    my = (dy / d) * A * 0.32 * k;
  } else {
    mx = Math.sin(t * 0.4) * W * 0.18;
    my = Math.sin(t * 0.27) * A * 0.12;
  }
  const rIris = A * 0.78, rPupila = rIris * 0.42;
  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < cols; x++) {
      const X = (x + 0.5 - cx) * aspecto, Y = y + 0.5 - cy;
      const u = X / W;
      if (Math.abs(u) > 1.08) continue;
      const borde = Math.max(0, 1 - u * u);
      const arriba = -abre * borde, abajo = abre * borde * 0.92;
      // párpados: una línea gruesa arriba y una fina abajo
      if (Math.abs(Y - arriba) < 0.6 && Math.abs(u) < 1.02) {
        poner(x, y, Math.abs(u) > 0.92 ? "." : "=", 0.9);
        continue;
      }
      if (Math.abs(Y - (arriba - 1.2)) < 0.5 && Math.abs(u) < 0.8 && ((x * 7) % 5 === 0)) {
        poner(x, y, "'", 0.5, "muted");
        continue;
      }
      if (Math.abs(Y - abajo) < 0.5 && Math.abs(u) < 0.95) {
        poner(x, y, "-", 0.55, "muted");
        continue;
      }
      if (Y < arriba || Y > abajo) continue;
      const dx = X - mx, dy = Y - my;
      const d = Math.hypot(dx, dy);
      if (d < rPupila) {
        // brillo: un punto de luz arriba a la izquierda de la pupila
        if (Math.hypot(dx + rPupila * 0.35, dy + rPupila * 0.4) < rPupila * 0.3) poner(x, y, "@", 1, "accent");
        continue;
      }
      if (d < rIris) {
        const ang = Math.atan2(dy, dx);
        const fibra = 0.5 + 0.5 * Math.sin(ang * 16 + ruido(ang * 3, d * 0.6) * 4);
        const v = 0.3 + fibra * 0.45 + (1 - d / rIris) * 0.15;
        poner(x, y, deRampa(v, ".:+*#%@"), 0.45 + v * 0.5, d > rIris * 0.88 ? "ink" : "muted");
        continue;
      }
      // blanco del ojo: tramado ralo, más denso hacia los bordes (sombra)
      const sombra = Math.min(1, Math.abs(u) * 1.1 + Math.max(0, -Y / abre) * 0.4);
      if (ruido(x * 0.9, y * 1.7, 2) < 0.25 + sombra * 0.55) poner(x, y, sombra > 0.6 ? ":" : ".", 0.25 + sombra * 0.35, "muted");
    }
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
      const cx = 2 + ct;
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
    poner(i % cols, Math.floor(i / cols), deRampa(v * 0.999, rampa), 0.3 + v * 0.7, v > 0.82 ? "accent" : "ink");
  }
};

/**
 * Lluvia de muestras: columnas de dígitos que se re-sortean y de a poco se
 * asientan en el valor más frecuente. Es la variabilidad: muchas tiradas que
 * convergen.
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
      const cabeza = y === rows - alto;
      poner(x, y, ch, fijo ? Math.min(1, alpha + 0.2) : cabeza ? 0.95 : alpha * 0.8, fijo ? "ink" : cabeza ? "accent" : "muted");
    }
  }
  if (fase > 0.75) {
    const msg = "moda = 7";
    const x0 = Math.floor(cols / 2 - msg.length / 2);
    for (let i = 0; i < msg.length; i++) poner(x0 + i, 1, msg[i], 0.95, "accent");
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
