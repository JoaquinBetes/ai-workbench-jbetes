import { Trash2 } from "lucide-react";
import { useId, useState } from "react";
import type { CorridaResumen } from "../../lib/evaluacion";
import { num, porcentaje } from "../../lib/formato";
import { escenaDiana } from "../../lib/ascii";
import { Vacio } from "../ui/Vista";

const fecha = new Intl.DateTimeFormat("es-AR", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit", hourCycle: "h23" });

const ESTADOS: Record<CorridaResumen["estado"], { texto: string; clase: string }> = {
  lista: { texto: "lista", clase: "tag--accent" },
  corriendo: { texto: "corriendo", clase: "tag--ink" },
  cancelada: { texto: "cortada", clase: "tag--doubt" },
  error: { texto: "error", clase: "tag--danger" },
};

/**
 * Las corridas guardadas en Postgres. Se pueden abrir varias del mismo
 * conjunto juntas, para comparar modelos (o el mismo modelo con otra
 * temperatura) caso por caso.
 */
export default function Historial({
  corridas,
  cargando,
  error,
  onAbrir,
  onBorrar,
}: {
  corridas: CorridaResumen[];
  cargando: boolean;
  error: string | null;
  onAbrir: (ids: number[]) => void;
  onBorrar: (id: number) => void;
}) {
  const id = useId();
  const [elegidas, setElegidas] = useState<number[]>([]);
  const [confirmando, setConfirmando] = useState<number | null>(null);
  const vivas = elegidas.filter((e) => corridas.some((c) => c.id === e));
  const conjuntos = new Set(corridas.filter((c) => vivas.includes(c.id)).map((c) => c.conjunto_id ?? `x${c.conjunto_nombre}`));
  const mezcla = conjuntos.size > 1;

  const alternar = (c: number) => setElegidas((prev) => (prev.includes(c) ? prev.filter((x) => x !== c) : prev.length >= 4 ? prev : [...prev, c]));

  if (!corridas.length)
    return (
      <div className="panel h-full">
        <Vacio escena={escenaDiana} etiquetaEscena="Dardos que caen sobre una diana" titulo={cargando ? "Leyendo el historial…" : "Todavía no hay corridas"}>
          {error ?? "Cada evaluación queda guardada acá, con sus respuestas y sus métricas, para volver a mirarla o compararla con otra."}
        </Vacio>
      </div>
    );

  return (
    <section className="panel rise-in" aria-labelledby={`${id}-t`}>
      <div className="panel-head flex-wrap">
        <h2 id={`${id}-t`} className="panel-title">
          Historial
        </h2>
        <span className="panel-meta">{corridas.length} corridas</span>
        <span className="ml-auto flex items-center gap-3">
          <span className="label" role="status">
            {mezcla ? "Elegí corridas de un mismo conjunto" : vivas.length ? `${vivas.length} de 4 elegidas` : "Elegí hasta 4 para compararlas"}
          </span>
          <button type="button" className="btn btn--primary btn--sm" disabled={!vivas.length || mezcla} onClick={() => onAbrir(vivas)}>
            Ver {vivas.length > 1 ? "juntas" : "corrida"}
          </button>
        </span>
      </div>
      <div className="relative overflow-x-auto" tabIndex={0} role="region" aria-label="Tabla del historial">
        <table className="w-full min-w-[820px] text-left text-label">
          <thead className="text-muted">
            <tr className="border-b border-line">
              <th scope="col" className="w-10 px-4 py-2 font-normal">
                <span className="sr-only">Elegir</span>
              </th>
              {["Fecha", "Conjunto", "Modelo", "Temp.", "Casos", "Contiene", "ROUGE-L", "Semántica", "Estado"].map((h) => (
                <th key={h} scope="col" className={`px-3 py-2 font-normal ${["Temp.", "Casos", "Contiene", "ROUGE-L", "Semántica"].includes(h) ? "text-right" : ""}`}>
                  {h}
                </th>
              ))}
              <th scope="col" className="w-20 px-2 py-2 font-normal">
                <span className="sr-only">Borrar</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {corridas.map((c) => {
              const elegida = vivas.includes(c.id);
              const a = c.agregados;
              const e = ESTADOS[c.estado];
              return (
                <tr key={c.id} className={`border-b border-line text-ink-2 last:border-b-0 ${elegida ? "bg-raised" : ""}`}>
                  <td className="px-3 py-0.5">
                    <label className="area-check">
                      <input
                      type="checkbox"
                      className="check"
                      checked={elegida}
                      disabled={!elegida && vivas.length >= 4}
                      onChange={() => alternar(c.id)}
                      aria-label={`Elegir la corrida de ${c.modelo} sobre ${c.conjunto_nombre}`}
                      />
                    </label>
                  </td>
                  <td className="num whitespace-nowrap px-3 text-muted">{c.creada ? fecha.format(new Date(c.creada)) : "—"}</td>
                  <td className="px-3">{c.conjunto_nombre}</td>
                  <td className="mono px-3 text-ink">{c.modelo}</td>
                  <td className="num px-3 text-right">{num(c.temperatura, 1)}</td>
                  <td className="num px-3 text-right">{a?.casos ?? "—"}</td>
                  <td className="num px-3 text-right">{porcentaje(a?.contiene, 0)}</td>
                  <td className="num px-3 text-right">{a?.rouge_l != null ? num(a.rouge_l * 100, 0) : "—"}</td>
                  <td className="num px-3 text-right">{a?.semantica != null ? num(a.semantica * 100, 0) : "—"}</td>
                  <td className="px-3">
                    <span className={`tag ${e.clase}`} title={c.error ?? undefined}>
                      {e.texto}
                    </span>
                  </td>
                  <td className="px-2">
                    {confirmando === c.id ? (
                      <button
                        type="button"
                        className="btn btn--danger btn--sm"
                        onClick={() => {
                          setConfirmando(null);
                          onBorrar(c.id);
                        }}
                        onBlur={() => setConfirmando(null)}
                        autoFocus
                      >
                        Borrar
                      </button>
                    ) : (
                      <button
                        type="button"
                        className="btn btn--quiet btn--icon btn--sm"
                        onClick={() => setConfirmando(c.id)}
                        aria-label={`Borrar la corrida de ${c.modelo} sobre ${c.conjunto_nombre}`}
                      >
                        <Trash2 aria-hidden />
                      </button>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}
