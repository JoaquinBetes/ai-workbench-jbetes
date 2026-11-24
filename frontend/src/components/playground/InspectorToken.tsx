import { ArrowLeft, ArrowRight, GitBranch } from "lucide-react";
import type { TokenLogprob } from "../../lib/api";
import { num } from "../../lib/formato";
import { alternativas, duda, entropia, mostrarToken, pct, prob } from "../../lib/probs";
import { BarraTexto } from "../ascii/Texto";
import { Teclas } from "../ui/Controles";
import { Vacio } from "../ui/Vista";
import { escenaOjo } from "../../lib/ascii";

const CONTEXTO = 10; // tokens previos que se muestran para ubicar el token

export type EstadoToken = "original" | "heredado" | "forzado" | "generado";

const ETIQUETA_ESTADO: Record<EstadoToken, { texto: string; clase: string } | null> = {
  original: null,
  heredado: { texto: "Heredado de la rama madre", clase: "tag" },
  forzado: { texto: "Forzado por vos", clase: "tag tag--accent" },
  generado: { texto: "Generado en esta rama", clase: "tag" },
};

/** Alternativas que se pueden forzar, en el orden en que se numeran (1…9). */
export function alternativasForzables(t: TokenLogprob) {
  return alternativas(t).filter((a) => !a.elegido);
}

/** Medidor de media luna: la probabilidad del token elegido. */
function Medidor({ p }: { p: number }) {
  const R = 58;
  const L = Math.PI * R;
  const cx = 72;
  const cy = 72;
  const color = p >= 0.5 ? "var(--ink)" : "var(--doubt)";
  const arco = `M ${cx - R} ${cy} A ${R} ${R} 0 0 1 ${cx + R} ${cy}`;
  return (
    <div className="relative h-[80px] w-[144px]">
      <svg width="144" height="80" viewBox="0 0 144 80" aria-hidden>
        <path d={arco} fill="none" stroke="var(--line-2)" strokeWidth="5" strokeLinecap="butt" strokeDasharray="2 2" />
        <path
          d={arco}
          fill="none"
          stroke={color}
          strokeWidth="5"
          strokeLinecap="butt"
          strokeDasharray={`${Math.max(0.001, p * L)} ${L}`}
          style={{ transition: "stroke-dasharray 200ms var(--ease)" }}
        />
        {[0.25, 0.5, 0.75].map((x) => {
          const a = Math.PI * (1 - x);
          return (
            <line
              key={x}
              x1={cx + Math.cos(a) * (R + 6)}
              y1={cy - Math.sin(a) * (R + 6)}
              x2={cx + Math.cos(a) * (R + 10)}
              y2={cy - Math.sin(a) * (R + 10)}
              stroke="var(--muted)"
              strokeWidth="1"
            />
          );
        })}
      </svg>
      <div className="absolute inset-x-0 bottom-1 text-center">
        <div className="num text-[20px] leading-none text-ink">{pct(p)}</div>
        <div className="label mt-1">probabilidad</div>
      </div>
    </div>
  );
}

export default function InspectorToken({
  tokens,
  indice,
  onMover,
  estado = "original",
  onBifurcar,
  bloqueado = false,
}: {
  tokens: TokenLogprob[] | null;
  indice: number | null;
  onMover: (i: number) => void;
  estado?: EstadoToken;
  /** Crea una rama nueva forzando esta alternativa en este punto. */
  onBifurcar?: (alternativa: { token: string; logprob: number }) => void;
  bloqueado?: boolean;
}) {
  if (!tokens || indice === null || !tokens[indice]) {
    return (
      <Vacio escena={escenaOjo} interactiva etiquetaEscena="Un ojo tramado que sigue al puntero" titulo="Elegí un token de una respuesta">
        <p>Vas a ver entre qué opciones dudaba el modelo en ese paso y podés forzar otra.</p>
        <p className="mt-3 flex items-center justify-center gap-1.5">
          <Teclas teclas={["←", "→"]} /> para recorrer
        </p>
      </Vacio>
    );
  }

  const t = tokens[indice];
  const p = prob(t.logprob);
  const lista = alternativas(t);
  const max = lista[0]?.p ?? 1;
  const sumaTop = lista.reduce((s, a) => s + a.p, 0);
  const forzables = lista.filter((a) => !a.elegido);
  const previos = tokens.slice(Math.max(0, indice - CONTEXTO), indice).map((x) => x.token).join("");
  const bits = entropia(t);

  return (
    <div className="space-y-4 p-4">
      {/* Posición */}
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => onMover(Math.max(0, indice - 1))}
          className="btn btn--sm btn--icon"
          aria-label="Token anterior"
          data-tip="Token anterior  ←"
        >
          <ArrowLeft aria-hidden />
        </button>
        <span className="num text-label text-muted">
          token <span className="text-ink">{indice + 1}</span> de {tokens.length}
        </span>
        <button
          type="button"
          onClick={() => onMover(Math.min(tokens.length - 1, indice + 1))}
          className="btn btn--sm btn--icon"
          aria-label="Token siguiente"
          data-tip="Token siguiente  →"
        >
          <ArrowRight aria-hidden />
        </button>
        {ETIQUETA_ESTADO[estado] && (
          <span className={`${ETIQUETA_ESTADO[estado]!.clase} ml-auto`}>{ETIQUETA_ESTADO[estado]!.texto}</span>
        )}
      </div>

      {/* Contexto */}
      <div className="well mono overflow-hidden px-3 py-2.5 text-label leading-relaxed text-muted">
        <span className="opacity-60">…</span>
        <span className="whitespace-pre-wrap break-words">{previos}</span>
        <span className="bg-ink px-1 py-px text-[var(--bg)]">{mostrarToken(t.token)}</span>
      </div>

      {/* Lecturas */}
      <div className="grid grid-cols-[auto_1fr] items-center gap-4">
        <Medidor p={p} />
        <dl className="space-y-2.5">
          <div className="flex items-baseline justify-between gap-2">
            <dt className="label">Logprob</dt>
            <dd className="num text-small text-ink">{num(t.logprob, 3)}</dd>
          </div>
          <div className="flex items-baseline justify-between gap-2" data-tip="Entropía estimada con las alternativas mostradas" data-tip-pos="left">
            <dt className="label">Entropía</dt>
            <dd className="num text-small text-ink">{num(bits, 2)} bits</dd>
          </div>
          <div>
            <div className="flex items-baseline justify-between gap-2">
              <dt className="label">Duda</dt>
              <dd className="num text-small text-doubt">{num(duda(t) * 100, 0)} %</dd>
            </div>
            <div className="mt-1.5 h-[3px] overflow-hidden bg-line-2">
              <div className="h-full origin-left bg-doubt" style={{ transform: `scaleX(${duda(t)})` }} />
            </div>
          </div>
        </dl>
      </div>

      {/* Alternativas */}
      <div>
        <div className="mb-2 flex items-baseline justify-between">
          <h3 className="panel-title">Alternativas en este paso</h3>
          <span className="num text-label text-muted">suman {pct(sumaTop, 0)}</span>
        </div>
        <ol className="space-y-1">
          {lista.map((a) => {
            const n = forzables.indexOf(a) + 1;
            const puede = !a.elegido && onBifurcar && !bloqueado;
            return (
              <li key={a.token}>
                <div
                  className="group grid grid-cols-[20px_minmax(0,6.5rem)_1fr_auto] items-center gap-2.5 px-2 py-1.5"
                  style={a.elegido ? { background: "var(--raised)", outline: "1px solid var(--line-2)" } : undefined}
                >
                  <span className="num text-center text-label text-muted">{a.elegido ? <span className="text-accent">■</span> : n <= 9 ? n : ""}</span>
                  <span className={`mono truncate text-label ${a.elegido ? "text-ink" : "text-ink-2"}`}>{mostrarToken(a.token)}</span>
                  <BarraTexto valor={a.p / max} largo={10} tono={a.elegido ? "ink" : "muted"} className="overflow-hidden" />
                  <span className="flex items-center gap-2">
                    <span className="num w-[4.2rem] text-right text-label text-ink-2">{pct(a.p)}</span>
                    {!a.elegido && onBifurcar && (
                      <button
                        type="button"
                        disabled={!puede}
                        onClick={() => onBifurcar({ token: a.token, logprob: Math.log(a.p) })}
                        className="btn btn--sm btn--icon opacity-60 group-hover:opacity-100 focus-visible:opacity-100"
                        aria-label={`Forzar ${mostrarToken(a.token)} y seguir desde acá`}
                        data-tip={n <= 9 ? `Forzar y seguir  ·  tecla ${n}` : "Forzar y seguir"}
                        data-tip-pos="left"
                      >
                        <GitBranch aria-hidden />
                      </button>
                    )}
                  </span>
                </div>
              </li>
            );
          })}
        </ol>
        <p className="hint mt-3">
          El resto se reparte entre los ~150.000 tokens del vocabulario.
          {onBifurcar && " Forzá una alternativa y el modelo sigue escribiendo desde ahí, en una rama nueva."}
        </p>
      </div>
    </div>
  );
}
