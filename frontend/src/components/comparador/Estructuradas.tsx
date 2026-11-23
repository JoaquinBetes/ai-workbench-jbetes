import { useEffect, useRef, useState } from "react";
import { Bar, BarChart, CartesianGrid, LabelList, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import {
  muestraEstructurada,
  type EvaluacionEstructurada,
  type MetodoEstructurado,
  type ResultadoEstructurado,
} from "../../lib/api";
import { useModelos } from "../../lib/useModelos";
import { EJEMPLOS_ESQUEMAS } from "./ejemplosEsquemas";

const METODOS: { id: MetodoEstructurado; nombre: string; color: string; ayuda: string }[] = [
  { id: "prompt", nombre: "Solo prompt", color: "#2a78d6", ayuda: "La respuesta se acepta solo si ya es JSON puro." },
  {
    id: "postproceso",
    nombre: "Prompt + post-proceso",
    color: "#eb6834",
    ayuda: "La misma respuesta, pero el backend extrae y repara el JSON si hace falta.",
  },
  {
    id: "restringido",
    nombre: "Sampling restringido",
    color: "#1baf7a",
    ayuda: "Ollama solo deja generar tokens que mantienen el JSON válido.",
  },
];

type Muestra = {
  modo: "libre" | "restringido";
  n: number;
  seed: number;
  resultado?: ResultadoEstructurado;
  error?: string;
};

const json = (v: unknown) => JSON.stringify(v, null, 2);

function parsear(texto: string): { valor: unknown; error: string | null } {
  if (!texto.trim()) return { valor: undefined, error: null };
  try {
    return { valor: JSON.parse(texto), error: null };
  } catch (e) {
    return { valor: undefined, error: (e as Error).message };
  }
}

function Chip({ ok, texto }: { ok: boolean; texto: string }) {
  return (
    <span
      className={`rounded px-1.5 py-0.5 text-[10px] ${ok ? "bg-emerald-500/15 text-emerald-300" : "bg-rose-500/15 text-rose-300"}`}
    >
      {ok ? "✓" : "✗"} {texto}
    </span>
  );
}

export default function Estructuradas() {
  const { modelos, preferido } = useModelos();
  const [modelo, setModelo] = useState("");
  const [ejemploId, setEjemploId] = useState(EJEMPLOS_ESQUEMAS[0].id);
  const [esquemaTexto, setEsquemaTexto] = useState(json(EJEMPLOS_ESQUEMAS[0].esquema));
  const [texto, setTexto] = useState(EJEMPLOS_ESQUEMAS[0].texto);
  const [esperadoTexto, setEsperadoTexto] = useState(json(EJEMPLOS_ESQUEMAS[0].esperado));
  const [repeticiones, setRepeticiones] = useState(5);
  const [temperatura, setTemperatura] = useState(0.7);
  const [libre, setLibre] = useState(true);
  const [restringido, setRestringido] = useState(true);
  const [muestras, setMuestras] = useState<Muestra[]>([]);
  const [corriendo, setCorriendo] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const cancelar = useRef<AbortController | null>(null);

  useEffect(() => {
    if (!modelo && preferido) setModelo(preferido);
  }, [preferido, modelo]);

  function elegirEjemplo(id: string) {
    const ej = EJEMPLOS_ESQUEMAS.find((e) => e.id === id);
    setEjemploId(id);
    if (!ej) return; // "personalizado": se deja lo que haya escrito
    setEsquemaTexto(json(ej.esquema));
    setTexto(ej.texto);
    setEsperadoTexto(json(ej.esperado));
  }

  const esquema = parsear(esquemaTexto);
  const esperado = parsear(esperadoTexto);
  const modos = [...(libre ? (["libre"] as const) : []), ...(restringido ? (["restringido"] as const) : [])];
  const total = modos.length * repeticiones;

  async function ejecutar() {
    if (corriendo || !modelo || !texto.trim() || !modos.length) return;
    if (esquema.error || !esquema.valor) return setError("El esquema no es un JSON válido.");
    if (esperado.error) return setError("La respuesta esperada no es un JSON válido (o dejala vacía).");
    setError(null);
    setMuestras([]);
    setCorriendo(true);
    cancelar.current = new AbortController();
    const acumuladas: Muestra[] = [];

    try {
      for (const modo of modos) {
        for (let i = 0; i < repeticiones; i++) {
          // Mismas semillas en los dos modos: comparación pareada.
          const muestra: Muestra = { modo, n: i + 1, seed: i + 1 };
          try {
            muestra.resultado = await muestraEstructurada(
              {
                model: modelo,
                schema: esquema.valor as object,
                text: texto,
                mode: modo,
                temperature: temperatura,
                seed: muestra.seed,
                expected: esperado.valor,
              },
              cancelar.current.signal,
            );
          } catch (e) {
            if ((e as Error).name === "AbortError") throw e;
            muestra.error = (e as Error).message;
          }
          acumuladas.push(muestra);
          setMuestras([...acumuladas]);
        }
      }
    } catch {
      // cancelado por el usuario
    } finally {
      setCorriendo(false);
    }
  }

  // --- Resumen por método ---------------------------------------------------
  const evaluacionesDe = (m: MetodoEstructurado) =>
    muestras.flatMap((s) => (s.resultado?.evaluaciones[m] ? [{ ev: s.resultado.evaluaciones[m]!, s }] : []));

  const resumen = METODOS.map((m) => {
    const evs = evaluacionesDe(m.id);
    const conExactitud = evs.filter((x) => x.ev.accuracy !== null);
    return {
      ...m,
      n: evs.length,
      jsonOk: evs.length ? evs.filter((x) => x.ev.json_ok).length / evs.length : null,
      esquemaOk: evs.length ? evs.filter((x) => x.ev.schema_ok).length / evs.length : null,
      exactitud: conExactitud.length
        ? conExactitud.reduce((a, x) => a + (x.ev.accuracy ?? 0), 0) / conExactitud.length
        : null,
      latencia: evs.length ? evs.reduce((a, x) => a + (x.s.resultado?.latency_s ?? 0), 0) / evs.length : null,
    };
  }).filter((r) => r.n > 0);

  const datosGrafico = [
    { metrica: "JSON válido", ...Object.fromEntries(resumen.map((r) => [r.id, r.jsonOk !== null ? Math.round(r.jsonOk * 100) : null])) },
    { metrica: "Cumple el esquema", ...Object.fromEntries(resumen.map((r) => [r.id, r.esquemaOk !== null ? Math.round(r.esquemaOk * 100) : null])) },
    ...(resumen.some((r) => r.exactitud !== null)
      ? [{ metrica: "Datos correctos", ...Object.fromEntries(resumen.map((r) => [r.id, r.exactitud !== null ? Math.round(r.exactitud * 100) : null])) }]
      : []),
  ];

  const pct = (v: number | null) => (v === null ? "—" : `${Math.round(v * 100)}%`);

  return (
    <div className="h-full space-y-4 overflow-y-auto pr-1">
      {/* Configuración */}
      <div className="grid gap-4 rounded-xl border border-zinc-800 bg-zinc-900/50 p-4 text-sm xl:grid-cols-2">
        <div className="space-y-3">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-xs text-zinc-400">Ejemplo:</span>
            {[...EJEMPLOS_ESQUEMAS.map((e) => ({ id: e.id, nombre: e.nombre })), { id: "custom", nombre: "Personalizado" }].map(
              (e) => (
                <button
                  key={e.id}
                  onClick={() => elegirEjemplo(e.id)}
                  className={`rounded-full border px-2.5 py-0.5 text-xs ${
                    ejemploId === e.id ? "border-indigo-400 bg-indigo-500/20 text-indigo-100" : "border-zinc-700 text-zinc-400"
                  }`}
                >
                  {e.nombre}
                </button>
              ),
            )}
          </div>
          <label className="block space-y-1">
            <span className="text-xs text-zinc-400">Texto de entrada</span>
            <textarea
              value={texto}
              onChange={(e) => {
                setTexto(e.target.value);
                setEjemploId("custom");
              }}
              rows={3}
              className="w-full resize-y rounded-md border border-zinc-700 bg-zinc-900 px-3 py-2"
            />
          </label>
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
                min={1}
                max={20}
                step={1}
                value={repeticiones}
                onChange={(e) => setRepeticiones(Number(e.target.value))}
                className="accent-indigo-500"
              />
              <span className="w-6 font-mono">{repeticiones}</span>
            </label>
          </div>
          <div className="space-y-1 text-xs text-zinc-300">
            <label className="flex cursor-pointer items-center gap-2">
              <input type="checkbox" checked={libre} onChange={(e) => setLibre(e.target.checked)} />
              Sin restricción → evalúa <b className="font-medium text-[#5b9be6]">Solo prompt</b> y{" "}
              <b className="font-medium text-[#eb6834]">Prompt + post-proceso</b> sobre la misma respuesta
            </label>
            <label className="flex cursor-pointer items-center gap-2">
              <input type="checkbox" checked={restringido} onChange={(e) => setRestringido(e.target.checked)} />
              <b className="font-medium text-[#1baf7a]">Sampling restringido</b> (Ollama recibe el esquema)
            </label>
          </div>
          <div className="flex items-center gap-3">
            {corriendo ? (
              <button
                onClick={() => cancelar.current?.abort()}
                className="rounded-xl bg-rose-600 px-5 py-2 font-medium hover:bg-rose-500"
              >
                Detener ({muestras.length}/{total})
              </button>
            ) : (
              <button onClick={ejecutar} className="rounded-xl bg-indigo-600 px-5 py-2 font-medium hover:bg-indigo-500">
                Ejecutar {total} generaciones
              </button>
            )}
            {error && <span className="text-xs text-rose-400">{error}</span>}
          </div>
        </div>

        <div className="grid gap-3 lg:grid-cols-2 xl:grid-cols-1 2xl:grid-cols-2">
          <label className="block space-y-1">
            <span className="flex justify-between text-xs text-zinc-400">
              JSON Schema
              {esquema.error && <span className="text-rose-400">JSON inválido</span>}
            </span>
            <textarea
              value={esquemaTexto}
              onChange={(e) => {
                setEsquemaTexto(e.target.value);
                setEjemploId("custom");
              }}
              rows={12}
              spellCheck={false}
              className={`w-full resize-y rounded-md border bg-zinc-950 px-3 py-2 font-mono text-[11px] ${
                esquema.error ? "border-rose-500/60" : "border-zinc-700"
              }`}
            />
          </label>
          <label className="block space-y-1">
            <span className="flex justify-between text-xs text-zinc-400">
              Respuesta esperada (opcional, para medir exactitud)
              {esperado.error && <span className="text-rose-400">JSON inválido</span>}
            </span>
            <textarea
              value={esperadoTexto}
              onChange={(e) => setEsperadoTexto(e.target.value)}
              rows={12}
              spellCheck={false}
              className={`w-full resize-y rounded-md border bg-zinc-950 px-3 py-2 font-mono text-[11px] ${
                esperado.error ? "border-rose-500/60" : "border-zinc-700"
              }`}
            />
          </label>
        </div>
      </div>

      {/* Resultados */}
      {resumen.length > 0 && (
        <>
          <div className="grid gap-3 lg:grid-cols-3">
            {resumen.map((r) => (
              <div key={r.id} className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-4" title={r.ayuda}>
                <div className="mb-2 flex items-center gap-2">
                  <span className="h-2.5 w-2.5 rounded-sm" style={{ background: r.color }} />
                  <span className="text-sm font-medium">{r.nombre}</span>
                  <span className="ml-auto text-[11px] text-zinc-500">{r.n} muestras</span>
                </div>
                <div className="grid grid-cols-4 gap-2 text-center">
                  {[
                    ["JSON válido", pct(r.jsonOk)],
                    ["Esquema", pct(r.esquemaOk)],
                    ["Correcto", pct(r.exactitud)],
                    ["Latencia", r.latencia !== null ? `${r.latencia.toFixed(1)}s` : "—"],
                  ].map(([t, v]) => (
                    <div key={t} className="rounded-lg bg-zinc-800/60 px-1 py-2">
                      <div className="text-[10px] text-zinc-400">{t}</div>
                      <div className="text-lg font-semibold">{v}</div>
                    </div>
                  ))}
                </div>
                <p className="mt-2 text-[11px] leading-snug text-zinc-500">{r.ayuda}</p>
              </div>
            ))}
          </div>

          <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-4">
            <div className="mb-2 flex flex-wrap items-center gap-4 text-xs text-zinc-400">
              <span className="text-sm font-medium text-zinc-200">Comparación de métodos</span>
              {resumen.map((r) => (
                <span key={r.id} className="flex items-center gap-1.5">
                  <span className="h-2.5 w-2.5 rounded-sm" style={{ background: r.color }} />
                  {r.nombre}
                </span>
              ))}
            </div>
            <div className="h-56">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={datosGrafico} margin={{ top: 20, right: 8, bottom: 0, left: -16 }}>
                  <CartesianGrid stroke="#27272a" vertical={false} />
                  <XAxis dataKey="metrica" tick={{ fill: "#a1a1aa", fontSize: 12 }} axisLine={false} tickLine={false} />
                  <YAxis domain={[0, 100]} tick={{ fill: "#71717a", fontSize: 11 }} unit="%" axisLine={false} tickLine={false} />
                  <Tooltip
                    cursor={{ fill: "rgba(255,255,255,0.04)" }}
                    contentStyle={{ background: "#18181b", border: "1px solid #3f3f46", fontSize: 12 }}
                    formatter={(v, nombre) => [`${v}%`, METODOS.find((m) => m.id === nombre)?.nombre ?? nombre]}
                  />
                  {resumen.map((r) => (
                    <Bar key={r.id} dataKey={r.id} fill={r.color} radius={[4, 4, 0, 0]} maxBarSize={44} isAnimationActive={false}>
                      <LabelList dataKey={r.id} position="top" formatter={(v) => `${v}%`} style={{ fill: "#a1a1aa", fontSize: 10 }} />
                    </Bar>
                  ))}
                </BarChart>
              </ResponsiveContainer>
            </div>
            <p className="mt-1 text-[11px] text-zinc-500">
              "Correcto" mide los datos, no el formato: un JSON perfecto puede tener la edad equivocada.
            </p>
          </div>
        </>
      )}

      {muestras.length > 0 && (
        <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-4">
          <h3 className="mb-3 text-sm font-medium">Muestras (clic para ver la respuesta cruda)</h3>
          <div className="space-y-1.5">
            {muestras.map((s) => {
              const evs = Object.entries(s.resultado?.evaluaciones ?? {}) as [MetodoEstructurado, EvaluacionEstructurada][];
              return (
                <details key={`${s.modo}-${s.n}`} className="rounded-lg bg-zinc-800/50 px-3 py-2 text-xs">
                  <summary className="flex cursor-pointer flex-wrap items-center gap-2">
                    <span className="font-mono text-zinc-500">
                      {s.modo === "libre" ? "sin restricción" : "restringido"} · #{s.n} · seed {s.seed}
                    </span>
                    {s.error && <span className="text-rose-400">{s.error}</span>}
                    {evs.map(([m, ev]) => (
                      <span key={m} className="flex items-center gap-1">
                        <span
                          className="h-2 w-2 rounded-sm"
                          style={{ background: METODOS.find((x) => x.id === m)!.color }}
                          title={METODOS.find((x) => x.id === m)!.nombre}
                        />
                        <Chip ok={ev.json_ok} texto="JSON" />
                        <Chip ok={ev.schema_ok} texto="esquema" />
                        {ev.accuracy !== null && <Chip ok={ev.accuracy === 1} texto={`${Math.round(ev.accuracy * 100)}% datos`} />}
                      </span>
                    ))}
                    {s.resultado && <span className="ml-auto text-zinc-500">{s.resultado.latency_s}s</span>}
                  </summary>
                  {s.resultado && (
                    <div className="mt-2 space-y-2">
                      <pre className="max-h-48 overflow-auto whitespace-pre-wrap rounded bg-zinc-950 p-2 font-mono text-[11px] text-zinc-300">
                        {s.resultado.raw || "(vacía)"}
                      </pre>
                      {evs.map(([m, ev]) =>
                        ev.repairs.length || ev.schema_errors.length ? (
                          <div key={m} className="text-[11px] text-zinc-400">
                            <span className="font-medium text-zinc-300">{METODOS.find((x) => x.id === m)!.nombre}:</span>{" "}
                            {ev.repairs.length > 0 && <>reparaciones: {ev.repairs.join(" · ")}. </>}
                            {ev.schema_errors.length > 0 && (
                              <span className="text-rose-300">errores: {ev.schema_errors.join(" · ")}</span>
                            )}
                          </div>
                        ) : null,
                      )}
                    </div>
                  )}
                </details>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
