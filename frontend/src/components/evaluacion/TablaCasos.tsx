import { ChevronRight } from "lucide-react";
import { Fragment, useId, useState } from "react";
import { METRICAS, type IdMetrica, type ResultadoEval } from "../../lib/evaluacion";
import { num, segundos } from "../../lib/formato";
import { Giro } from "../ascii/Texto";
import { SERIES } from "../comparador/comun";
import { BINARIAS, valorMetrica, type CasoTabla, type Serie } from "./comun";

const recortar = (t: string, n: number) => (t.length > n ? `${t.slice(0, n - 1)}…` : t);

/** El valor de una métrica en una celda: sí/no, o de 0 a 100 con una barra fina. */
function Valor({ r, metrica, compacto = false }: { r: ResultadoEval; metrica: IdMetrica; compacto?: boolean }) {
  const v = valorMetrica(r, metrica);
  if (v === null) return <span className="num text-muted">—</span>;
  if (BINARIAS.has(metrica)) return <span className={v ? "text-accent" : "text-muted"}>{v ? "sí" : "no"}</span>;
  if (compacto) return <span className="num text-ink">{num(v * 100, 0)}</span>;
  return (
    <span className="inline-flex items-center gap-2">
      <span className="num w-7 text-right text-ink">{num(v * 100, 0)}</span>
      <span className="block h-[2px] w-10 bg-[var(--line)]" aria-hidden>
        <span className="block h-full bg-[var(--ink-3)]" style={{ width: `${v * 100}%` }} />
      </span>
    </span>
  );
}

/** Todas las métricas de una respuesta, para la fila abierta. */
function Detalle({ serie, r }: { serie: Serie; r: ResultadoEval | undefined }) {
  return (
    <div className="well min-w-0 px-3 py-2.5">
      <div className="flex items-center gap-2">
        <span className="h-2.5 w-2.5 flex-none" style={{ background: SERIES[serie.slot] }} aria-hidden />
        <span className="mono truncate text-label text-ink">{serie.modelo}</span>
        {r && (
          <span className="num ml-auto text-label text-muted">
            {segundos(r.latencia)} · {r.tokens ?? "—"} tok
          </span>
        )}
      </div>
      {r ? (
        <>
          <p className="prosa mt-2 whitespace-pre-wrap break-words text-small text-ink">{r.respuesta || <span className="text-muted">(respuesta vacía)</span>}</p>
          <dl className="mt-2.5 grid grid-cols-2 gap-x-5 gap-y-1 text-label">
            {METRICAS.map((m) => (
              <div key={m.id} className="flex items-baseline justify-between gap-2">
                <dt className="text-muted">{m.corto}</dt>
                <dd>
                  <Valor r={r} metrica={m.id} compacto />
                </dd>
              </div>
            ))}
            <div className="flex items-baseline justify-between gap-2">
              <dt className="text-muted">perplejidad</dt>
              <dd className="num text-ink">{num(r.perplejidad, 2)}</dd>
            </div>
          </dl>
        </>
      ) : (
        <p className="hint mt-2">Todavía no respondió este caso.</p>
      )}
    </div>
  );
}

/**
 * Los casos del conjunto, uno por fila: la pregunta, la referencia y, por cada
 * modelo, la métrica elegida y el principio de su respuesta. Abrir una fila
 * muestra las respuestas completas con todas sus métricas.
 */
export default function TablaCasos({ casos, series, metrica, onMetrica }: { casos: CasoTabla[]; series: Serie[]; metrica: IdMetrica; onMetrica: (m: IdMetrica) => void }) {
  const id = useId();
  const [abiertas, setAbiertas] = useState<Set<number>>(() => new Set());
  const alternar = (orden: number) =>
    setAbiertas((prev) => {
      const s = new Set(prev);
      if (s.has(orden)) s.delete(orden);
      else s.add(orden);
      return s;
    });
  const columnas = 3 + series.length;

  return (
    <section className="panel rise-in" aria-labelledby={`${id}-t`}>
      <div className="panel-head">
        <h2 id={`${id}-t`} className="panel-title">
          Casos
        </h2>
        <span className="panel-meta">{casos.length}</span>
        {series.length > 0 && (
          <span className="ml-auto flex items-center gap-2">
            <label htmlFor={`${id}-m`} className="label max-sm:sr-only">
              Mostrar
            </label>
            <select id={`${id}-m`} className="field h-[30px] w-auto py-0 text-label" value={metrica} onChange={(e) => onMetrica(e.target.value as IdMetrica)}>
              {METRICAS.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.nombre}
                </option>
              ))}
            </select>
          </span>
        )}
      </div>
      <div className="relative overflow-x-auto" tabIndex={0} role="region" aria-label="Tabla de casos">
        <table className="w-full table-fixed text-left text-label" style={{ minWidth: 520 + series.length * 170 }}>
          <colgroup>
            <col style={{ width: 64 }} />
            <col />
            <col style={{ width: series.length ? "17%" : "35%" }} />
            {series.map((s) => (
              <col key={s.corrida_id} style={{ width: 170 }} />
            ))}
          </colgroup>
          <thead className="text-muted">
            <tr className="border-b border-line">
              <th scope="col" className="w-16 px-4 py-2 font-normal">
                #
              </th>
              <th scope="col" className="px-3 py-2 font-normal">
                Pregunta
              </th>
              <th scope="col" className="px-3 py-2 font-normal">
                Referencia
              </th>
              {series.map((s) => (
                <th key={s.corrida_id} scope="col" className="px-3 py-2 font-normal">
                  <span className="flex items-center gap-2">
                    <span className="h-2 w-2 flex-none" style={{ background: SERIES[s.slot] }} aria-hidden />
                    <span className="mono truncate text-ink-2">{s.modelo}</span>
                  </span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {casos.map((c) => {
              const abierta = abiertas.has(c.orden);
              const detalle = `${id}-d${c.orden}`;
              return (
                <Fragment key={c.orden}>
                  <tr className={`border-b border-line align-top text-ink-2 ${abierta ? "bg-raised" : ""}`}>
                    <td className="px-2 py-1.5">
                      <button
                        type="button"
                        className="btn btn--quiet btn--sm gap-1 px-2"
                        aria-expanded={abierta}
                        aria-controls={abierta ? detalle : undefined}
                        aria-label={`${abierta ? "Cerrar" : "Abrir"} el caso ${c.orden + 1}`}
                        onClick={() => alternar(c.orden)}
                        disabled={!series.length}
                      >
                        <ChevronRight aria-hidden className={`h-3.5 w-3.5 transition-transform duration-150 ${abierta ? "rotate-90" : ""}`} />
                        <span className="num">{c.orden + 1}</span>
                      </button>
                    </td>
                    <td className="prosa px-3 py-2.5 text-small text-ink">{c.pregunta}</td>
                    <td className="prosa break-words px-3 py-2.5 text-small text-ink">{c.referencia}</td>
                    {series.map((s) => {
                      const r = s.resultados[c.orden];
                      const siguiente = s.estado === "corriendo" && !r && Object.keys(s.resultados).length === c.orden;
                      return (
                        <td key={s.corrida_id} className="px-3 py-2.5">
                          {r ? (
                            <>
                              <Valor r={r} metrica={metrica} />
                              <span className="prosa mt-0.5 block truncate text-label text-muted" title={r.respuesta}>
                                {recortar(r.respuesta, 60) || "(vacía)"}
                              </span>
                            </>
                          ) : siguiente ? (
                            <span className="inline-flex items-center gap-1.5 text-muted">
                              <Giro /> respondiendo
                            </span>
                          ) : (
                            <span className="text-muted">—</span>
                          )}
                        </td>
                      );
                    })}
                  </tr>
                  {abierta && (
                    <tr id={detalle} className="border-b border-line bg-raised">
                      <td colSpan={columnas} className="px-4 pb-4 pt-1">
                        <div className="grid gap-2" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 260px), 1fr))" }}>
                          {series.map((s) => (
                            <Detalle key={s.corrida_id} serie={s} r={s.resultados[c.orden]} />
                          ))}
                        </div>
                      </td>
                    </tr>
                  )}
                </Fragment>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}
