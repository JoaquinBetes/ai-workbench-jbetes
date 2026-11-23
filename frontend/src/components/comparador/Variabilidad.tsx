import { useEffect, useRef, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  LabelList,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { streamChat, type TokenLogprob } from "../../lib/api";
import { agrupar, entropiaRespuestas } from "../../lib/agrupar";
import { metricas } from "../../lib/probs";
import { useModelos } from "../../lib/useModelos";

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

function Kpi({ titulo, valor, detalle }: { titulo: string; valor: string; detalle?: string }) {
  return (
    <div className="rounded-xl bg-zinc-800/60 px-4 py-3">
      <div className="text-xs text-zinc-400">{titulo}</div>
      <div className="text-2xl font-semibold">{valor}</div>
      {detalle && <div className="text-[11px] text-zinc-500">{detalle}</div>}
    </div>
  );
}

export default function Variabilidad() {
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

  const validas = muestras.filter((m) => !m.error);
  const grupos = agrupar(validas, (m) => m.texto);
  const claveDe = new Map(grupos.flatMap((g) => g.items.map((m) => [m.n, g.clave] as const)));
  const entropia = entropiaRespuestas(grupos.map((g) => g.items.length));
  const pplPromedio =
    validas.length > 0
      ? validas.reduce((s, m) => s + (metricas(m.tokens)?.perplejidad ?? 0), 0) / validas.length
      : null;
  const datosHistograma = grupos.map((g, i) => ({
    clave: g.clave,
    etiqueta: recortar(g.ejemplo.replace(/\s+/g, " ")),
    veces: g.items.length,
    mayoritaria: i === 0,
  }));

  const mismasCondiciones = historial
    .filter((c) => c.prompt === prompt.trim() && c.modelo === modelo)
    .sort((a, b) => a.temperatura - b.temperatura);

  return (
    <div className="h-full space-y-4 overflow-y-auto pr-1">
      {/* Configuración */}
      <div className="space-y-3 rounded-xl border border-zinc-800 bg-zinc-900/50 p-4 text-sm">
        <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-xs text-zinc-300">
          <label className="flex items-center gap-2">
            Modelo
            <select
              value={modelo}
              onChange={(e) => setModelo(e.target.value)}
              className="rounded-md border border-zinc-700 bg-zinc-900 px-2 py-1"
            >
              {modelos.map((m) => (
                <option key={m.name} value={m.name}>
                  {m.name} · {m.parameters}
                </option>
              ))}
            </select>
          </label>
          <label className="flex items-center gap-2">
            Temperatura
            <input
              type="range"
              min={0}
              max={2}
              step={0.1}
              value={temperatura}
              onChange={(e) => setTemperatura(Number(e.target.value))}
              className="accent-indigo-500"
            />
            <span className="w-8 font-mono">{temperatura}</span>
          </label>
          <label className="flex items-center gap-2">
            Repeticiones
            <input
              type="range"
              min={2}
              max={30}
              step={1}
              value={cantidad}
              onChange={(e) => setCantidad(Number(e.target.value))}
              className="accent-indigo-500"
            />
            <span className="w-6 font-mono">{cantidad}</span>
          </label>
          <label className="flex items-center gap-2">
            Máx. tokens
            <input
              type="number"
              min={8}
              max={1024}
              step={8}
              value={maxTokens}
              onChange={(e) => setMaxTokens(Number(e.target.value))}
              className="w-16 rounded-md border border-zinc-700 bg-zinc-900 px-2 py-0.5 font-mono"
            />
          </label>
          <label
            className="flex cursor-pointer items-center gap-2"
            title="Cada muestra usa una semilla distinta (1, 2, 3…): si repetís la corrida, sale exactamente igual"
          >
            <input type="checkbox" checked={reproducible} onChange={(e) => setReproducible(e.target.checked)} />
            Semillas 1…N (reproducible)
          </label>
        </div>

        <div className="flex flex-wrap gap-1.5">
          {EJEMPLOS.map((e) => (
            <button
              key={e}
              onClick={() => setPrompt(e)}
              className="rounded-full border border-zinc-700 px-2.5 py-0.5 text-[11px] text-zinc-400 hover:border-zinc-500 hover:text-zinc-200"
            >
              {recortar(e, 48)}
            </button>
          ))}
        </div>

        <div className="flex gap-2">
          <textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                ejecutar();
              }
            }}
            rows={2}
            placeholder="Un prompt con respuesta corta funciona mejor para agrupar respuestas."
            className="flex-1 resize-none rounded-xl border border-zinc-700 bg-zinc-900 px-4 py-2 outline-none focus:border-indigo-500"
          />
          {corriendo ? (
            <button
              onClick={() => cancelar.current?.abort()}
              className="rounded-xl bg-rose-600 px-5 font-medium hover:bg-rose-500"
            >
              Detener ({muestras.length}/{cantidad})
            </button>
          ) : (
            <button onClick={ejecutar} className="rounded-xl bg-indigo-600 px-5 font-medium hover:bg-indigo-500">
              Ejecutar {cantidad} veces
            </button>
          )}
        </div>
        <p className="text-[11px] text-zinc-500">
          Dos respuestas cuentan como iguales si coinciden sin mayúsculas, puntuación ni espacios de más. Para respuestas
          largas casi siempre van a ser todas distintas: comparar por significado llega en los capítulos 3 y 6.
        </p>
      </div>

      {muestras.length > 0 && (
        <>
          {/* Indicadores */}
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <Kpi
              titulo="Respuestas distintas"
              valor={`${grupos.length} de ${validas.length}`}
              detalle="1 = el modelo siempre dice lo mismo"
            />
            <Kpi
              titulo="Acuerdo de la mayoritaria"
              valor={grupos.length ? `${Math.round((grupos[0].items.length / validas.length) * 100)}%` : "—"}
              detalle={grupos.length ? `"${recortar(grupos[0].ejemplo, 28)}"` : undefined}
            />
            <Kpi
              titulo="Entropía de respuestas"
              valor={`${entropia.toFixed(2)} bits`}
              detalle={`0 = siempre igual · máx. ${Math.log2(Math.max(validas.length, 1)).toFixed(2)} = todas distintas`}
            />
            <Kpi
              titulo="Perplejidad promedio"
              valor={pplPromedio !== null ? pplPromedio.toFixed(2) : "—"}
              detalle="Cuánto dudó, token a token"
            />
          </div>

          {/* Histograma + lista */}
          <div className="grid gap-4 xl:grid-cols-2">
            <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-4">
              <h3 className="mb-1 text-sm font-medium">Distribución de respuestas</h3>
              <p className="mb-3 text-[11px] text-zinc-500">
                En violeta, la mayoritaria (la que elegiría la autoconsistencia). Clic en una barra para ver sus muestras.
              </p>
              <div style={{ height: Math.max(140, datosHistograma.length * 30 + 20) }}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={datosHistograma} layout="vertical" margin={{ top: 0, right: 32, bottom: 0, left: 0 }}>
                    <XAxis type="number" hide allowDecimals={false} />
                    <YAxis
                      type="category"
                      dataKey="etiqueta"
                      width={180}
                      tick={{ fill: "#d4d4d8", fontSize: 12 }}
                      axisLine={false}
                      tickLine={false}
                    />
                    <Tooltip
                      cursor={{ fill: "rgba(255,255,255,0.04)" }}
                      contentStyle={{ background: "#18181b", border: "1px solid #3f3f46", fontSize: 12 }}
                      formatter={(v) => [`${v} de ${validas.length}`, "Veces"]}
                    />
                    <Bar
                      dataKey="veces"
                      radius={[0, 4, 4, 0]}
                      isAnimationActive={false}
                      onClick={(d) => {
                        const clave = (d as unknown as { clave: string }).clave;
                        setGrupoSel((g) => (g === clave ? null : clave));
                      }}
                      className="cursor-pointer"
                    >
                      {datosHistograma.map((d) => (
                        <Cell
                          key={d.clave}
                          fill={d.mayoritaria ? "#818cf8" : "#52525b"}
                          opacity={grupoSel && grupoSel !== d.clave ? 0.35 : 1}
                        />
                      ))}
                      <LabelList dataKey="veces" position="right" style={{ fill: "#a1a1aa", fontSize: 11 }} />
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-4">
              <h3 className="mb-3 text-sm font-medium">
                Muestras {grupoSel && <span className="text-xs font-normal text-zinc-400">(filtradas por grupo)</span>}
              </h3>
              <div className="max-h-80 space-y-1.5 overflow-y-auto pr-1">
                {muestras
                  .filter((m) => !grupoSel || claveDe.get(m.n) === grupoSel)
                  .map((m) => {
                    const ppl = metricas(m.tokens)?.perplejidad;
                    const esMayoritaria = grupos.length > 0 && claveDe.get(m.n) === grupos[0].clave;
                    return (
                      <div
                        key={m.n}
                        className={`flex gap-3 rounded-lg px-3 py-1.5 text-xs ${
                          esMayoritaria ? "bg-indigo-500/10" : "bg-zinc-800/50"
                        }`}
                      >
                        <span className="w-6 shrink-0 font-mono text-zinc-500">#{m.n}</span>
                        <span className="line-clamp-3 flex-1 whitespace-pre-wrap text-zinc-200">
                          {m.error ? <span className="text-rose-400">{m.error}</span> : m.texto.trim() || "(vacía)"}
                        </span>
                        <span className="shrink-0 text-right font-mono text-zinc-500">
                          {m.seed !== null && <div>seed {m.seed}</div>}
                          {ppl !== undefined && <div>PPL {ppl.toFixed(2)}</div>}
                        </span>
                      </div>
                    );
                  })}
              </div>
            </div>
          </div>
        </>
      )}

      {/* Historial */}
      {historial.length > 0 && (
        <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-4">
          <h3 className="mb-1 text-sm font-medium">Historial de corridas</h3>
          <p className="mb-3 text-[11px] text-zinc-500">
            Repetí el mismo prompt con otras temperaturas: el gráfico muestra cómo crece la variedad.
          </p>
          {mismasCondiciones.length >= 2 && (
            <div className="mb-2 flex gap-4 text-[11px] text-zinc-400">
              <span className="flex items-center gap-1.5">
                <span className="inline-block w-4 border-t-2 border-indigo-400" /> Respuestas distintas
              </span>
              <span className="flex items-center gap-1.5">
                <span className="inline-block w-4 border-t-2 border-dashed border-amber-500" /> Entropía (bits)
              </span>
            </div>
          )}
          {mismasCondiciones.length >= 2 && (
            <div className="mb-4 h-48">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={mismasCondiciones} margin={{ top: 8, right: 16, bottom: 4, left: 0 }}>
                  <CartesianGrid stroke="#27272a" vertical={false} />
                  <XAxis
                    dataKey="temperatura"
                    type="number"
                    domain={[0, 2]}
                    tick={{ fill: "#a1a1aa", fontSize: 11 }}
                    label={{ value: "Temperatura", position: "insideBottomRight", offset: -2, fill: "#71717a", fontSize: 11 }}
                  />
                  <YAxis tick={{ fill: "#a1a1aa", fontSize: 11 }} allowDecimals={false} />
                  <Tooltip contentStyle={{ background: "#18181b", border: "1px solid #3f3f46", fontSize: 12 }} />
                  <Line
                    type="monotone"
                    dataKey="distintas"
                    name="Respuestas distintas"
                    stroke="#818cf8"
                    strokeWidth={2}
                    dot={{ r: 4 }}
                    isAnimationActive={false}
                  />
                  <Line
                    type="monotone"
                    dataKey="entropia"
                    name="Entropía (bits)"
                    stroke="#f59e0b"
                    strokeWidth={2}
                    strokeDasharray="5 4"
                    dot={{ r: 4 }}
                    isAnimationActive={false}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="text-zinc-400">
                <tr className="border-b border-zinc-800">
                  <th className="py-1.5 pr-3 font-normal">#</th>
                  <th className="pr-3 font-normal">Modelo</th>
                  <th className="pr-3 font-normal">Temp.</th>
                  <th className="pr-3 font-normal">N</th>
                  <th className="pr-3 font-normal">Distintas</th>
                  <th className="pr-3 font-normal">Acuerdo</th>
                  <th className="pr-3 font-normal">Entropía</th>
                  <th className="font-normal">Mayoritaria</th>
                </tr>
              </thead>
              <tbody>
                {[...historial].reverse().map((c) => (
                  <tr key={c.id} className="border-b border-zinc-800/60 text-zinc-300">
                    <td className="py-1.5 pr-3 font-mono text-zinc-500">{c.id}</td>
                    <td className="pr-3">{c.modelo}</td>
                    <td className="pr-3 font-mono">{c.temperatura}</td>
                    <td className="pr-3 font-mono">{c.n}</td>
                    <td className="pr-3 font-mono">{c.distintas}</td>
                    <td className="pr-3 font-mono">{Math.round(c.acuerdo * 100)}%</td>
                    <td className="pr-3 font-mono">{c.entropia.toFixed(2)}</td>
                    <td className="text-zinc-400" title={c.prompt}>
                      {recortar(c.mayoritaria, 36)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
