import { useState } from "react";
import { METRICAS } from "../../lib/evaluacion";
import { entero, num, porcentaje, segundos } from "../../lib/formato";
import { SERIES, SERIES_HEX } from "../comparador/comun";
import { Barras } from "../graficos3d";
import { Giro } from "../ascii/Texto";
import Segmentado from "../ui/Segmentado";
import { agregarParcial, type Serie } from "./comun";

/**
 * Promedio de cada métrica por modelo. Las de sí o no son la proporción de
 * casos que la cumplen; las otras, el puntaje medio. Todas van de 0 a 100: el
 * mejor de cada columna se enciende.
 */
export default function Resumen({ series, totalCasos }: { series: Serie[]; totalCasos: number }) {
  const [forma, setForma] = useState<"tabla" | "barras">("tabla");
  // Mientras corre, los promedios se calculan acá con lo que ya llegó.
  const filas = series.map((s) => ({ ...s, agregados: s.agregados ?? agregarParcial(Object.values(s.resultados)) }));
  const conDatos = filas.filter((s) => s.agregados);
  const mejor = Object.fromEntries(
    METRICAS.map((m) => {
      const vals = conDatos.map((s) => s.agregados![m.id]).filter((v): v is number => v !== null);
      return [m.id, vals.length > 1 ? Math.max(...vals) : null];
    }),
  );

  return (
    <section className="panel rise-in" aria-labelledby="eval-resumen">
      <div className="panel-head">
        <h2 id="eval-resumen" className="panel-title">
          Resumen por modelo
        </h2>
        <span className="panel-meta max-sm:hidden">promedio de los {totalCasos} casos, de 0 a 100</span>
        <Segmentado
          className="ml-auto"
          sm
          etiqueta="Forma del resumen"
          valor={forma}
          onChange={setForma}
          opciones={[
            { valor: "tabla", etiqueta: "Tabla" },
            { valor: "barras", etiqueta: "Barras 3D", disabled: !conDatos.length },
          ]}
        />
      </div>
      {forma === "barras" && conDatos.length ? (
        <Barras
          titulo="Métricas por modelo, en barras 3D"
          alto={380}
          columnas={METRICAS.map((m) => m.corto)}
          series={conDatos.map((s) => ({ etiqueta: s.modelo, color: SERIES_HEX[s.slot] }))}
          valores={conDatos.map((s) => METRICAS.map((m) => s.agregados![m.id]))}
          textos={conDatos.map((s) => METRICAS.map((m) => `${s.modelo} · ${m.nombre}: ${porcentaje(s.agregados![m.id], 0)}`))}
        />
      ) : (
        <div className="relative overflow-x-auto" tabIndex={0} role="region" aria-label="Tabla del resumen por modelo">
          <table className="w-full min-w-[760px] text-left text-label">
            <thead className="text-muted">
              <tr className="border-b border-line">
                <th scope="col" className="px-4 py-2 font-normal">
                  Modelo
                </th>
                {METRICAS.map((m) => (
                  <th key={m.id} scope="col" className="px-3 py-2 text-right font-normal">
                    <span data-tip={m.ayuda} data-tip-pos="bottom" className="cursor-help underline decoration-dotted decoration-[var(--ink-3)] underline-offset-4">
                      {m.corto}
                    </span>
                  </th>
                ))}
                <th scope="col" className="px-3 py-2 text-right font-normal">
                  <span
                    data-tip="Qué tan sorprendido estuvo el modelo por su propia respuesta. Cerca de 1: muy seguro."
                    data-tip-pos="bottom"
                    className="cursor-help underline decoration-dotted decoration-[var(--ink-3)] underline-offset-4"
                  >
                    perplejidad
                  </span>
                </th>
                <th scope="col" className="px-3 py-2 text-right font-normal">
                  latencia
                </th>
                <th scope="col" className="px-4 py-2 text-right font-normal">
                  tokens
                </th>
              </tr>
            </thead>
            <tbody>
              {filas.map((s) => {
                const a = s.agregados;
                const hechos = Object.keys(s.resultados).length;
                return (
                  <tr key={s.corrida_id} className="border-b border-line text-ink-2 last:border-b-0">
                    <th scope="row" className="px-4 py-2.5 font-normal">
                      <span className="flex items-center gap-2">
                        <span className="h-2.5 w-2.5 flex-none" style={{ background: SERIES[s.slot] }} aria-hidden />
                        <span className="mono truncate text-ink">{s.modelo}</span>
                        {s.estado === "corriendo" && (
                          <span className="tag tag--accent">
                            <Giro /> {hechos}/{totalCasos}
                          </span>
                        )}
                        {s.estado === "cancelada" && <span className="tag tag--doubt">cortada</span>}
                        {s.estado === "error" && <span className="tag tag--danger">error</span>}
                      </span>
                    </th>
                    {METRICAS.map((m) => {
                      const v = a?.[m.id] ?? null;
                      const top = v !== null && mejor[m.id] !== null && v === mejor[m.id];
                      return (
                        <td key={m.id} className="px-3 py-2.5 text-right">
                          <span className={`num block ${top ? "text-accent" : v === null ? "text-muted" : "text-ink"}`}>
                            {v === null ? "—" : num(v * 100, 0)}
                          </span>
                          <span className="mt-1 ml-auto block h-[2px] w-12 bg-[var(--line)]" aria-hidden>
                            <span className={`block h-full ${top ? "bg-accent" : "bg-[var(--ink-3)]"}`} style={{ width: `${(v ?? 0) * 100}%` }} />
                          </span>
                        </td>
                      );
                    })}
                    <td className="num px-3 text-right">{num(a?.perplejidad, 2)}</td>
                    <td className="num px-3 text-right">{segundos(a?.latencia)}</td>
                    <td className="num px-4 text-right">{a ? entero(a.tokens) : "—"}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
