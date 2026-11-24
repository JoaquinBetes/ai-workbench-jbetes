import { useState } from "react";
import { crearEscenaChip } from "../../lib/ascii";
import { num } from "../../lib/formato";
import LienzoAscii from "../ascii/LienzoAscii";
import { BarraTexto, Decodificar } from "../ascii/Texto";

// Una "ruleta" de ejemplo para la vista vacía del Playground: ocho tokens con
// probabilidades inventadas (a T = 1). Muestra en vivo qué hacen la
// temperatura, top-k y top-p con la distribución antes de sortear.
const CANDIDATOS: [string, number][] = [
  ["leña", 0.42],
  ["carbón", 0.28],
  ["amigos", 0.1],
  ["paciencia", 0.07],
  ["fuego", 0.05],
  ["tiempo", 0.04],
  ["amor", 0.025],
  ["vacío", 0.015],
];

function distribucion(temperatura: number, topK: number, topP: number) {
  const logits = CANDIDATOS.map(([, p]) => Math.log(p));
  let ps: number[];
  if (temperatura <= 0.01) {
    ps = logits.map((_, i) => (i === 0 ? 1 : 0));
  } else {
    const z = logits.map((l) => l / temperatura);
    const m = Math.max(...z);
    const e = z.map((x) => Math.exp(x - m));
    const s = e.reduce((a, b) => a + b, 0);
    ps = e.map((x) => x / s);
  }
  let acumulada = 0;
  return CANDIDATOS.map(([token], i) => {
    const fueraK = i >= topK;
    const fueraP = acumulada >= topP - 1e-9;
    acumulada += ps[i];
    return { token, p: ps[i], fuera: fueraK ? "top-k" : fueraP ? "top-p" : null };
  });
}

export default function ExploradorSampling({
  temperatura,
  topK,
  topP,
}: {
  temperatura: number;
  topK: number;
  topP: number;
}) {
  const [chip] = useState(() => crearEscenaChip(CANDIDATOS.map(([t]) => t)));
  const filas = distribucion(temperatura, topK, topP);
  const enJuego = filas.filter((f) => !f.fuera);
  const total = enJuego.reduce((s, f) => s + f.p, 0) || 1;
  const bits = -enJuego.reduce((s, f) => {
    const q = f.p / total;
    return q > 0 ? s + q * Math.log2(q) : s;
  }, 0);
  const max = Math.max(...filas.map((f) => f.p), 1e-9);

  return (
    <div className="enter mx-auto w-full max-w-[720px] pb-4 pt-2" style={{ ["--delay" as string]: "140ms" }}>
      <div className="panel overflow-hidden">
        <div className="h-[200px] border-b border-line bg-sunken">
          <LienzoAscii escena={chip} celda={12} fps={15} etiqueta="Un chip con pistas: entran señales por la izquierda y salen tokens por la derecha" />
        </div>
        <div className="px-5 pb-1 pt-5">
          <h2 className="display text-[32px] leading-[1.1] text-ink">
            <Decodificar texto="Cada token es un sorteo" duracion={600} />
          </h2>
          <p className="mt-3 max-w-[62ch] text-small leading-relaxed text-ink-2">
            El modelo no elige la palabra más probable: arma una ruleta con su vocabulario y tira. Temperatura, top-k y
            top-p cambian esa ruleta antes del sorteo. Mové los controles de la izquierda y mirá esta, con probabilidades
            de ejemplo.
          </p>
        </div>

        <div className="mx-5 my-4 border border-line bg-sunken">
          <div className="flex items-center justify-between border-b border-line px-4 py-2.5">
            <span className="mono text-small text-ink-2">
              El mejor asado se hace con<span className="caret" aria-hidden />
            </span>
            <span className="num text-label text-muted">T = {num(temperatura, 2)}</span>
          </div>
          <div className="grid grid-cols-[6rem_1fr_4.5rem_4.5rem] gap-3 px-4 pt-3 text-label text-muted max-sm:grid-cols-[6rem_1fr_4.5rem]" aria-hidden>
            <span className="dot">token</span>
            <span className="max-sm:hidden" />
            <span className="dot text-right">con T</span>
            <span className="dot text-right">se sortea</span>
          </div>
          <ol className="px-4 pb-3 pt-1" aria-label="Probabilidad de cada token candidato">
            {filas.map((f, i) => {
              const q = f.fuera ? 0 : f.p / total;
              return (
                <li key={f.token} className="grid grid-cols-[6rem_1fr_4.5rem_4.5rem] items-center gap-3 py-[3px] max-sm:grid-cols-[6rem_1fr_4.5rem]">
                  <span className={`truncate text-label ${f.fuera ? "text-muted line-through decoration-[var(--faint)]" : i === 0 ? "text-ink" : "text-ink-2"}`}>
                    {f.token}
                  </span>
                  <BarraTexto valor={f.p / max} largo={24} tono={f.fuera ? "muted" : i === 0 ? "accent" : "ink"} className="overflow-hidden max-sm:hidden" />
                  <span className={`num whitespace-nowrap text-right text-label ${f.fuera ? "text-muted" : "text-ink-2"}`}>{num(f.p * 100, 1)} %</span>
                  <span className="num whitespace-nowrap text-right text-label">
                    {f.fuera ? <span className="text-muted">fuera</span> : <span className="text-ink">{num(q * 100, 0)} %</span>}
                  </span>
                </li>
              );
            })}
          </ol>
          <div className="grid grid-cols-2 border-t border-line">
            <div className="px-4 py-2.5">
              <div className="label">en juego</div>
              <div className="num mt-0.5 text-small text-ink">
                {enJuego.length} de {filas.length} tokens
              </div>
            </div>
            <div className="border-l border-line px-4 py-2.5">
              <div className="label">entropía del sorteo</div>
              <div className="num mt-0.5 text-small text-ink">{num(bits, 2)} bits</div>
            </div>
          </div>
        </div>
      </div>
      <p className="hint mt-3">
        Escribí un prompt abajo: en la respuesta real cada token se puede inspeccionar, la duda del modelo queda
        subrayada en ámbar y el paisaje 3D muestra la distribución de cada paso.
      </p>
    </div>
  );
}
