import { Shuffle } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { streamChat, type TokenLogprob } from "../../lib/api";
import { agrupar, entropiaRespuestas } from "../../lib/agrupar";
import { escribiendo, useComandos } from "../../lib/comandos";
import { num, porcentaje } from "../../lib/formato";
import { metricas } from "../../lib/probs";
import { useModelos } from "../../lib/useModelos";
import { Deslizador, Interruptor, Lectura, Seccion } from "../ui/Controles";
import SelectorModelo from "../ui/SelectorModelo";
import { EJE, GRILLA, TipGrafico, Vacio } from "../ui/Vista";
import { BotonCorrer, CampoPrompt, PanelConfig } from "./comun";

type Muestra = { n: number; seed: number | null; texto: string; tokens: TokenLogprob[]; error?: string };

type Corrida = {
  id: number;
  prompt: string;
  modelo: string;
  temperatura: number;
  n: number;
  distintas: number;
  acuerdo: number;
  entropia: number;
  mayoritaria: string;
};

const EJEMPLOS = [
  "Decime un número del 1 al 10. Respondé solo el número.",
  "¿Cuál es la capital de Australia? Respondé solo el nombre.",
  "Inventá un nombre para un gato. Respondé solo el nombre.",
  "¿Cuántas letras r tiene la palabra ferrocarril? Respondé solo el número.",
];

const recortar = (t: string, n = 42) => (t.length > n ? `${t.slice(0, n)}…` : t);

// Tonos para los grupos que no son el mayoritario: grises de la tinta, del más al menos frecuente.
const tonoGrupo = (i: number) =>
  i === 0 ? "var(--accent)" : `color-mix(in oklab, var(--ink) ${Math.max(18, 52 - i * 8)}%, transparent)`;

/** Un gráfico de línea chico contra la temperatura (uno por medida: nunca dos ejes). */
function Tendencia({ datos, clave, titulo, formato }: { datos: Corrida[]; clave: "distintas" | "entropia"; titulo: string; formato: (v: number) => string }) {
  return (
    <div className="p-4">
      <div className="panel-title">{titulo}</div>
      <div className="hint">contra la temperatura</div>
      <div className="mt-2 h-40">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={datos} margin={{ top: 8, right: 12, bottom: 0, left: -18 }}>
            <CartesianGrid {...GRILLA} />
            <XAxis dataKey="temperatura" type="number" domain={[0, 2]} ticks={[0, 0.5, 1, 1.5, 2]} tickFormatter={(v) => num(v, 1)} {...EJE} />
            <YAxis allowDecimals={clave === "entropia"} tickFormatter={(v) => num(v, clave === "entropia" ? 1 : 0)} {...EJE} />
            <Tooltip content={<TipGrafico formato={formato} nombres={{ [clave]: titulo }} formatoEtiqueta={(v) => `T = ${num(Number(v), 2)}`} />} />
            <Line
              type="monotone"
              dataKey={clave}
              stroke="#dafa9c"
              strokeWidth={2}
              dot={{ r: 4, fill: "#dafa9c", stroke: "#191919", strokeWidth: 2 }}
              activeDot={{ r: 5 }}
              isAnimationActive={false}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

export default function Variabilidad({ activa = true }: { activa?: boolean }) {
  const { modelos, preferido } = useModelos();
  const [modelo, setModelo] = useState("");
  const [temperatura, setTemperatura] = useState(1);
  const [cantidad, setCantidad] = useState(10);
  const [maxTokens, setMaxTokens] = useState(64);
  const [reproducible, setReproducible] = useState(true);
  const [prompt, setPrompt] = useState("");
  const [muestras, setMuestras] = useState<Muestra[]>([]);
  const [corriendo, setCorriendo] = useState(false);
  const [grupoSel, setGrupoSel] = useState<string | null>(null);
  const [historial, setHistorial] = useState<Corrida[]>([]);
  const cancelar = useRef<AbortController | null>(null);

  useEffect(() => {
    if (!modelo && preferido) setModelo(preferido);
  }, [preferido, modelo]);

  async function ejecutar() {
    if (!prompt.trim() || !modelo || corriendo) return;
    setMuestras([]);
    setGrupoSel(null);
    setCorriendo(true);
    cancelar.current = new AbortController();
    const resultado: Muestra[] = [];

    // Mismo modelo para todas: queda cargado en la GPU y cada muestra es rápida.
    for (let i = 0; i < cantidad; i++) {
      if (cancelar.current.signal.aborted) break;
      // Con semilla fija todas las muestras serían idénticas: usamos 1..N
      // (reproducible) o ninguna (cada corrida distinta).
      const muestra: Muestra = { n: i + 1, seed: reproducible ? i + 1 : null, texto: "", tokens: [] };
      try {
        for await (const ev of streamChat(
          {
            model: modelo,
            messages: [{ role: "user", content: prompt.trim() }],
            temperature: temperatura,
            seed: muestra.seed,
            think: false,
            top_logprobs: 1,
            max_tokens: maxTokens,
          },
          cancelar.current.signal,
        )) {
          if (ev.type === "token") {
            muestra.texto += ev.content;
            muestra.tokens.push(...ev.logprobs);
          } else if (ev.type === "error") muestra.error = ev.message;
        }
      } catch (e) {
        if ((e as Error).name === "AbortError") break;
        muestra.error = (e as Error).message;
      }
      resultado.push(muestra);
      setMuestras([...resultado]);
    }

    const validas = resultado.filter((m) => !m.error);
    const gs = agrupar(validas, (m) => m.texto);
    if (gs.length) {
      setHistorial((prev) => [
        ...prev,
        {
          id: prev.length + 1,
          prompt: prompt.trim(),
          modelo,
          temperatura,
          n: validas.length,
          distintas: gs.length,
          acuerdo: gs[0].items.length / validas.length,
          entropia: entropiaRespuestas(gs.map((g) => g.items.length)),
          mayoritaria: gs[0].ejemplo,
        },
      ]);
    }
    setCorriendo(false);
  }

  const detener = () => cancelar.current?.abort();

  useEffect(() => {
    if (!activa) return;
    const alTeclear = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !escribiendo(e) && !document.querySelector(".overlay")) cancelar.current?.abort();
    };
    window.addEventListener("keydown", alTeclear);
    return () => window.removeEventListener("keydown", alTeclear);
  }, [activa]);

  useComandos(
    "variabilidad",
    activa
      ? [
          { id: "var-correr", titulo: `Ejecutar el prompt ${cantidad} veces`, grupo: "Variabilidad", ejecutar: ejecutar },
          ...(corriendo ? [{ id: "var-detener", titulo: "Detener las muestras", grupo: "Variabilidad", atajo: ["Esc"], ejecutar: detener }] : []),
        ]
      : [],
  );

  const validas = muestras.filter((m) => !m.error);
  const grupos = agrupar(validas, (m) => m.texto);
  const indiceGrupo = new Map(grupos.flatMap((g, i) => g.items.map((m) => [m.n, i] as const)));
  const entropia = entropiaRespuestas(grupos.map((g) => g.items.length));
  const pplPromedio =
    validas.length > 0 ? validas.reduce((s, m) => s + (metricas(m.tokens)?.perplejidad ?? 0), 0) / validas.length : null;
  const mismasCondiciones = historial
    .filter((c) => c.prompt === prompt.trim() && c.modelo === modelo)
    .sort((a, b) => a.temperatura - b.temperatura);
  const maxGrupo = grupos[0]?.items.length ?? 1;

  return (
    <div className="grid h-full min-h-0 grid-cols-[18.5rem_minmax(0,1fr)] gap-3">
      <PanelConfig
        meta={`${cantidad} muestras`}
        pie={
          <BotonCorrer
            corriendo={corriendo}
            onCorrer={ejecutar}
            onDetener={detener}
            texto={`Ejecutar ${cantidad} veces`}
            hecho={muestras.length}
            total={cantidad}
            deshabilitado={!prompt.trim() || !modelo}
          />
        }
      >
        <Seccion titulo="Modelo">
          <SelectorModelo modelos={modelos} valor={modelo} onChange={setModelo} />
        </Seccion>
        <Seccion titulo="Muestreo">
          <Deslizador etiqueta="Temperatura" valor={temperatura} min={0} max={2} paso={0.1} decimales={1} onChange={setTemperatura} />
          <Deslizador etiqueta="Repeticiones" valor={cantidad} min={2} max={30} paso={1} onChange={setCantidad} />
          <Deslizador etiqueta="Máximo de tokens" valor={maxTokens} min={8} max={512} paso={8} onChange={setMaxTokens} />
          <Interruptor valor={reproducible} onChange={setReproducible}>
            Semillas 1…N (reproducible)
          </Interruptor>
        </Seccion>
        <Seccion titulo="Prompt">
          <div className="flex flex-wrap gap-1.5">
            {EJEMPLOS.map((e) => (
              <button key={e} type="button" className="chip" aria-pressed={prompt === e} onClick={() => setPrompt(e)}>
                {recortar(e, 30)}
              </button>
            ))}
          </div>
          <CampoPrompt valor={prompt} onCambio={setPrompt} onCorrer={ejecutar} placeholder="Un prompt con respuesta corta funciona mejor para agrupar." />
          <p className="hint">
            Dos respuestas cuentan como iguales si coinciden sin mayúsculas, puntuación ni espacios de más. Comparar por
            significado llega en los capítulos 3 y 6.
          </p>
        </Seccion>
      </PanelConfig>

      <section className="min-h-0 space-y-3 overflow-y-auto pr-1" aria-label="Resultados">
        {muestras.length === 0 && !corriendo ? (
          <div className="panel h-full min-h-80">
            <Vacio icono={<Shuffle />} titulo="Un prompt, muchas veces">
              Vas a ver cuántas respuestas distintas da el modelo con la misma pregunta, y cuál elegiría la
              autoconsistencia.
            </Vacio>
          </div>
        ) : (
          <>
            {/* Grilla de muestras: se llena a medida que llegan; el color dice a qué grupo cayó cada una. */}
            <div className="panel rise-in">
              <div className="panel-head">
                <span className="panel-title">Muestras</span>
                <span className="panel-meta ml-auto">
                  {muestras.length} de {cantidad}
                </span>
              </div>
              <div className="flex flex-wrap gap-1.5 p-4">
                {Array.from({ length: cantidad }, (_, i) => {
                  const m = muestras[i];
                  const g = m ? indiceGrupo.get(m.n) : undefined;
                  const actual = corriendo && i === muestras.length;
                  return (
                    <span
                      key={i}
                      data-tip={m ? (m.error ? "Error" : recortar(m.texto.trim() || "(vacía)", 40)) : undefined}
                      className={`num grid h-8 w-10 place-items-center rounded-[4px] border text-label transition-colors duration-200 ${
                        m ? "border-transparent" : actual ? "border-[var(--accent-line)] text-accent" : "border-line text-muted"
                      }`}
                      style={
                        m
                          ? m.error
                            ? { background: "color-mix(in oklab, var(--danger) 30%, transparent)", color: "var(--ink)" }
                            : { background: tonoGrupo(g ?? 9), color: g === 0 ? "var(--accent-ink)" : "var(--ink)" }
                          : undefined
                      }
                    >
                      {actual ? <span className="spin" aria-hidden /> : i + 1}
                    </span>
                  );
                })}
              </div>
            </div>

            {validas.length > 0 && (
              <div className="panel rise-in grid grid-cols-2 divide-x divide-line lg:grid-cols-4">
                <Lectura etiqueta="Respuestas distintas" valor={`${grupos.length}`} unidad={`de ${validas.length}`} detalle="1 = siempre dice lo mismo" />
                <Lectura
                  etiqueta="Acuerdo de la mayoritaria"
                  valor={porcentaje(grupos[0].items.length / validas.length, 0)}
                  tono="accent"
                  detalle={`“${recortar(grupos[0].ejemplo.replace(/\s+/g, " "), 26)}”`}
                />
                <Lectura
                  etiqueta="Entropía de respuestas"
                  valor={num(entropia, 2)}
                  unidad="bits"
                  detalle={`máx. ${num(Math.log2(Math.max(validas.length, 1)), 2)} = todas distintas`}
                />
                <Lectura etiqueta="Perplejidad promedio" valor={num(pplPromedio, 2)} detalle="cuánto dudó, token a token" />
              </div>
            )}

            {grupos.length > 0 && (
              <div className="grid gap-3 xl:grid-cols-2">
                <div className="panel rise-in">
                  <div className="panel-head">
                    <span className="panel-title">Distribución de respuestas</span>
                    <span className="panel-meta ml-auto">clic para filtrar</span>
                  </div>
                  <ol className="space-y-1 p-3">
                    {grupos.map((g, i) => (
                      <li key={g.clave}>
                        <button
                          type="button"
                          aria-pressed={grupoSel === g.clave}
                          onClick={() => setGrupoSel((s) => (s === g.clave ? null : g.clave))}
                          className={`grid w-full grid-cols-[minmax(0,11rem)_1fr_3rem] items-center gap-3 rounded-md px-2 py-1.5 text-left transition-[background-color,opacity] hover:bg-raised ${
                            grupoSel && grupoSel !== g.clave ? "opacity-40" : ""
                          }`}
                        >
                          <span className="truncate text-label text-ink-2">{recortar(g.ejemplo.replace(/\s+/g, " "), 40)}</span>
                          <span className="relative h-2 overflow-hidden rounded-full bg-line">
                            <span
                              className="absolute inset-y-0 left-0 w-full origin-left rounded-full"
                              style={{ transform: `scaleX(${g.items.length / maxGrupo})`, background: tonoGrupo(i), transition: "transform 200ms var(--ease)" }}
                            />
                          </span>
                          <span className="num text-right text-label text-ink">{g.items.length}</span>
                        </button>
                      </li>
                    ))}
                  </ol>
                  <p className="hint border-t border-line px-4 py-2.5">En lima, la mayoritaria: la que elegiría la autoconsistencia.</p>
                </div>

                <div className="panel rise-in flex flex-col">
                  <div className="panel-head">
                    <span className="panel-title">Respuestas</span>
                    {grupoSel && (
                      <button type="button" className="btn btn--sm btn--quiet ml-auto" onClick={() => setGrupoSel(null)}>
                        Ver todas
                      </button>
                    )}
                  </div>
                  <ul className="max-h-80 divide-y divide-line overflow-y-auto">
                    {muestras
                      .filter((m) => !grupoSel || grupos[indiceGrupo.get(m.n) ?? -1]?.clave === grupoSel)
                      .map((m) => {
                        const ppl = metricas(m.tokens)?.perplejidad;
                        const g = indiceGrupo.get(m.n);
                        return (
                          <li key={m.n} className="grid grid-cols-[2.25rem_1fr_auto] gap-3 px-4 py-2">
                            <span className="num flex items-center gap-1.5 self-start pt-px text-label text-muted">
                              <span className="h-2 w-2 rounded-[2px]" style={{ background: m.error ? "var(--danger)" : tonoGrupo(g ?? 9) }} aria-hidden />
                              {m.n}
                            </span>
                            <span className="line-clamp-3 whitespace-pre-wrap text-label text-ink-2">
                              {m.error ? <span className="text-danger">{m.error}</span> : m.texto.trim() || "(vacía)"}
                            </span>
                            <span className="num text-right text-label text-muted">
                              {m.seed !== null && <div>seed {m.seed}</div>}
                              {ppl !== undefined && <div>ppl {num(ppl, 2)}</div>}
                            </span>
                          </li>
                        );
                      })}
                  </ul>
                </div>
              </div>
            )}
          </>
        )}

        {historial.length > 0 && (
          <div className="panel rise-in">
            <div className="panel-head">
              <span className="panel-title">Historial de corridas</span>
              <span className="panel-meta ml-auto">repetí el prompt con otras temperaturas</span>
            </div>
            {mismasCondiciones.length >= 2 && (
              <div className="grid border-b border-line md:grid-cols-2 md:divide-x md:divide-line">
                <Tendencia datos={mismasCondiciones} clave="distintas" titulo="Respuestas distintas" formato={(v) => num(v, 0)} />
                <Tendencia datos={mismasCondiciones} clave="entropia" titulo="Entropía (bits)" formato={(v) => num(v, 2)} />
              </div>
            )}
            <div className="overflow-x-auto">
              <table className="w-full text-left text-label">
                <thead className="text-muted">
                  <tr className="border-b border-line">
                    {["#", "Modelo", "Temp.", "N", "Distintas", "Acuerdo", "Entropía", "Mayoritaria"].map((h) => (
                      <th key={h} className="px-4 py-2 font-normal">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {[...historial].reverse().map((c) => (
                    <tr key={c.id} className="border-b border-line text-ink-2 last:border-b-0">
                      <td className="num px-4 py-2 text-muted">{c.id}</td>
                      <td className="mono px-4">{c.modelo}</td>
                      <td className="num px-4">{num(c.temperatura, 1)}</td>
                      <td className="num px-4">{c.n}</td>
                      <td className="num px-4">{c.distintas}</td>
                      <td className="num px-4">{porcentaje(c.acuerdo, 0)}</td>
                      <td className="num px-4">{num(c.entropia, 2)}</td>
                      <td className="px-4 text-muted" title={c.prompt}>
                        {recortar(c.mayoritaria, 36)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
