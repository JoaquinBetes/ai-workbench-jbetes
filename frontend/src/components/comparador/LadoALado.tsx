import { useEffect, useRef, useState } from "react";
import { streamChat, type ChatMessage, type ModelInfo, type Stats, type TokenLogprob } from "../../lib/api";
import { metricas, pct } from "../../lib/probs";
import { parametrosEnNumero, useModelos } from "../../lib/useModelos";
import InspectorToken from "../playground/InspectorToken";
import TextoTokens from "../playground/TextoTokens";
import GraficosResumen, { type FilaResumen } from "./GraficosResumen";

const MAX_MODELOS = 4;

type Columna = {
  modelo: ModelInfo;
  estado: "esperando" | "generando" | "listo" | "error";
  tokens: TokenLogprob[];
  thinking: string;
  stats?: Stats;
  error?: string;
};

const ESTADOS: Record<Columna["estado"], { texto: string; clase: string }> = {
  esperando: { texto: "En espera", clase: "bg-zinc-700/60 text-zinc-300" },
  generando: { texto: "Generando…", clase: "animate-pulse bg-amber-500/20 text-amber-300" },
  listo: { texto: "Listo", clase: "bg-emerald-500/15 text-emerald-300" },
  error: { texto: "Error", clase: "bg-rose-500/15 text-rose-300" },
};

function Metrica({ etiqueta, valor }: { etiqueta: string; valor: string }) {
  return (
    <div className="flex justify-between gap-2">
      <span className="text-zinc-500">{etiqueta}</span>
      <span className="font-mono text-zinc-200">{valor}</span>
    </div>
  );
}

export default function LadoALado() {
  const { modelos } = useModelos();
  const [elegidos, setElegidos] = useState<string[]>([]);
  const [prompt, setPrompt] = useState("");
  const [system, setSystem] = useState("");
  const [temperatura, setTemperatura] = useState(0.7);
  const [semillaFija, setSemillaFija] = useState(true);
  const [pensar, setPensar] = useState(false);
  const [maxTokens, setMaxTokens] = useState(256);
  const [columnas, setColumnas] = useState<Columna[]>([]);
  const [corriendo, setCorriendo] = useState(false);
  const [seleccion, setSeleccion] = useState<{ col: number; indice: number } | null>(null);
  const cancelar = useRef<AbortController | null>(null);

  // Por defecto, hasta 3 modelos qwen3 de distinto tamaño.
  useEffect(() => {
    if (elegidos.length || !modelos.length) return;
    const qwen = modelos.filter((m) => m.name.startsWith("qwen3:") && !m.name.includes("thinking"));
    const base = qwen.length ? qwen : modelos;
    const ordenados = [...base].sort((a, b) => parametrosEnNumero(a.parameters) - parametrosEnNumero(b.parameters));
    const sugeridos = ["qwen3:0.6b", "qwen3:1.7b", "qwen3:8b"].filter((n) => ordenados.some((m) => m.name === n));
    setElegidos(sugeridos.length >= 2 ? sugeridos : ordenados.slice(0, 3).map((m) => m.name));
  }, [modelos, elegidos.length]);

  const alternar = (nombre: string) =>
    setElegidos((prev) =>
      prev.includes(nombre) ? prev.filter((n) => n !== nombre) : prev.length < MAX_MODELOS ? [...prev, nombre] : prev,
    );

  const actualizar = (i: number, f: (c: Columna) => Columna) =>
    setColumnas((prev) => prev.map((c, j) => (j === i ? f(c) : c)));

  async function comparar() {
    if (!prompt.trim() || elegidos.length === 0 || corriendo) return;
    const infos = elegidos
      .map((n) => modelos.find((m) => m.name === n)!)
      .filter(Boolean)
      .sort((a, b) => parametrosEnNumero(a.parameters) - parametrosEnNumero(b.parameters));

    setColumnas(infos.map((m) => ({ modelo: m, estado: "esperando", tokens: [], thinking: "" })));
    setSeleccion(null);
    setCorriendo(true);
    cancelar.current = new AbortController();

    const mensajes: ChatMessage[] = [
      ...(system.trim() ? [{ role: "system" as const, content: system.trim() }] : []),
      { role: "user", content: prompt.trim() },
    ];

    // En secuencia: en 8 GB de VRAM no entran varios modelos a la vez,
    // así que Ollama carga uno, responde, y lo cambia por el siguiente.
    for (let i = 0; i < infos.length; i++) {
      if (cancelar.current.signal.aborted) break;
      actualizar(i, (c) => ({ ...c, estado: "generando" }));
      try {
        for await (const ev of streamChat(
          {
            model: infos[i].name,
            messages: mensajes,
            temperature: temperatura,
            seed: semillaFija ? 42 : null,
            think: pensar,
            top_logprobs: 5,
            max_tokens: maxTokens,
          },
          cancelar.current.signal,
        )) {
          if (ev.type === "token") actualizar(i, (c) => ({ ...c, tokens: [...c.tokens, ...ev.logprobs] }));
          else if (ev.type === "thinking") actualizar(i, (c) => ({ ...c, thinking: c.thinking + ev.content }));
          else if (ev.type === "done") actualizar(i, (c) => ({ ...c, stats: ev.stats }));
          else if (ev.type === "error") actualizar(i, (c) => ({ ...c, estado: "error", error: ev.message }));
        }
        actualizar(i, (c) => (c.estado === "error" ? c : { ...c, estado: "listo" }));
      } catch (e) {
        if ((e as Error).name === "AbortError") break;
        actualizar(i, (c) => ({ ...c, estado: "error", error: (e as Error).message }));
      }
    }
    setCorriendo(false);
  }

  const resumen: FilaResumen[] = columnas
    .filter((c) => c.estado === "listo")
    .map((c) => {
      const m = metricas(c.tokens);
      return {
        modelo: c.modelo.name,
        tokS: c.stats?.tokens_per_second ?? null,
        carga: c.stats?.load_s ?? null,
        perplejidad: m?.perplejidad ?? null,
        confianza: m?.confianzaPromedio ?? null,
      };
    });

  const colSel = seleccion ? columnas[seleccion.col] : null;

  return (
    <div className="grid h-full min-h-0 grid-cols-[minmax(0,1fr)_20rem] gap-4">
      <div className="flex min-h-0 flex-col gap-3 overflow-y-auto pr-1">
        {/* Configuración */}
        <div className="space-y-3 rounded-xl border border-zinc-800 bg-zinc-900/50 p-4 text-sm">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs text-zinc-400">Modelos (hasta {MAX_MODELOS}):</span>
            {[...modelos]
              .sort((a, b) => parametrosEnNumero(a.parameters) - parametrosEnNumero(b.parameters))
              .map((m) => {
                const activo = elegidos.includes(m.name);
                return (
                  <button
                    key={m.name}
                    onClick={() => alternar(m.name)}
                    className={`rounded-full border px-3 py-1 text-xs ${
                      activo
                        ? "border-indigo-400 bg-indigo-500/20 text-indigo-100"
                        : "border-zinc-700 text-zinc-400 hover:border-zinc-500"
                    }`}
                  >
                    {m.name} <span className="text-zinc-500">· {m.parameters}</span>
                  </button>
                );
              })}
          </div>

          <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-xs text-zinc-300">
            <label className="flex items-center gap-2">
              Temperatura
              <input
                type="range"
                min={0}
                max={2}
                step={0.05}
                value={temperatura}
                onChange={(e) => setTemperatura(Number(e.target.value))}
                className="accent-indigo-500"
              />
              <span className="w-8 font-mono">{temperatura}</span>
            </label>
            <label className="flex items-center gap-2">
              Máx. tokens
              <input
                type="number"
                min={16}
                max={2048}
                step={16}
                value={maxTokens}
                onChange={(e) => setMaxTokens(Number(e.target.value))}
                className="w-20 rounded-md border border-zinc-700 bg-zinc-900 px-2 py-0.5 font-mono"
              />
            </label>
            <label
              className="flex cursor-pointer items-center gap-2"
              title="Misma semilla para todos: la comparación es más justa y repetible"
            >
              <input type="checkbox" checked={semillaFija} onChange={(e) => setSemillaFija(e.target.checked)} />
              Semilla fija (42)
            </label>
            <label className="flex cursor-pointer items-center gap-2">
              <input type="checkbox" checked={pensar} onChange={(e) => setPensar(e.target.checked)} />
              Modo pensar
            </label>
          </div>

          <input
            value={system}
            onChange={(e) => setSystem(e.target.value)}
            placeholder="System prompt (opcional, igual para todos los modelos)"
            className="w-full rounded-md border border-zinc-700 bg-zinc-900 px-3 py-1.5 text-xs"
          />

          <div className="flex gap-2">
            <textarea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  comparar();
                }
              }}
              rows={2}
              placeholder="El mismo prompt va a todos los modelos. Probá: ¿Quién escribió Cien años de soledad?"
              className="flex-1 resize-none rounded-xl border border-zinc-700 bg-zinc-900 px-4 py-2 outline-none focus:border-indigo-500"
            />
            {corriendo ? (
              <button
                onClick={() => cancelar.current?.abort()}
                className="rounded-xl bg-rose-600 px-5 font-medium hover:bg-rose-500"
              >
                Detener
              </button>
            ) : (
              <button onClick={comparar} className="rounded-xl bg-indigo-600 px-5 font-medium hover:bg-indigo-500">
                Comparar
              </button>
            )}
          </div>
          <p className="text-[11px] text-zinc-500">
            Los modelos corren de a uno: en 8 GB de VRAM no entran juntos, y Ollama cambia de modelo entre columna y columna.
          </p>
        </div>

        {/* Columnas */}
        {columnas.length > 0 && (
          <div className="grid gap-3" style={{ gridTemplateColumns: `repeat(${columnas.length}, minmax(0, 1fr))` }}>
            {columnas.map((c, i) => {
              const m = metricas(c.tokens);
              return (
                <div key={c.modelo.name} className="flex flex-col rounded-xl border border-zinc-800 bg-zinc-900/50 p-3 text-sm">
                  <div className="mb-2 flex items-start justify-between gap-2">
                    <div>
                      <div className="font-medium text-zinc-100">{c.modelo.name}</div>
                      <div className="text-[11px] text-zinc-500">
                        {c.modelo.parameters} · {c.modelo.quantization} · {c.modelo.size_gb} GB
                      </div>
                    </div>
                    <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] ${ESTADOS[c.estado].clase}`}>
                      {ESTADOS[c.estado].texto}
                    </span>
                  </div>

                  {c.thinking && (
                    <details className="mb-2 rounded-lg bg-zinc-950/60 px-2 py-1 text-[11px] text-zinc-400">
                      <summary className="cursor-pointer select-none">Razonamiento</summary>
                      <p className="mt-1 whitespace-pre-wrap">{c.thinking}</p>
                    </details>
                  )}

                  <div className="min-h-16 flex-1">
                    {c.tokens.length > 0 ? (
                      <TextoTokens
                        tokens={c.tokens}
                        modo="probabilidad"
                        seleccionado={seleccion?.col === i ? seleccion.indice : null}
                        onSeleccionar={(indice) => setSeleccion({ col: i, indice })}
                      />
                    ) : (
                      <span className="text-zinc-500">{c.estado === "generando" ? "Cargando el modelo…" : "—"}</span>
                    )}
                    {c.error && <p className="mt-2 text-xs text-rose-400">{c.error}</p>}
                  </div>

                  {c.estado === "listo" && m && (
                    <div className="mt-3 space-y-0.5 border-t border-zinc-800 pt-2 text-[11px]">
                      <Metrica etiqueta="Tokens" valor={String(m.tokens)} />
                      <Metrica etiqueta="Velocidad" valor={`${c.stats?.tokens_per_second ?? "—"} tok/s`} />
                      <Metrica etiqueta="Carga" valor={`${c.stats?.load_s ?? "—"} s`} />
                      <Metrica etiqueta="Primer token" valor={`${c.stats?.time_to_first_token_s ?? "—"} s`} />
                      <Metrica etiqueta="Confianza" valor={pct(m.confianzaPromedio)} />
                      <Metrica etiqueta="Perplejidad" valor={m.perplejidad.toFixed(2)} />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {resumen.length >= 2 && !corriendo && <GraficosResumen filas={resumen} />}
      </div>

      <div className="min-h-0 overflow-y-auto">
        {colSel && (
          <div className="mb-2 text-xs text-zinc-400">
            Token de <span className="font-mono text-zinc-200">{colSel.modelo.name}</span>
          </div>
        )}
        <InspectorToken
          tokens={colSel?.tokens ?? null}
          indice={seleccion?.indice ?? null}
          onMover={(indice) => seleccion && setSeleccion({ ...seleccion, indice })}
        />
      </div>
    </div>
  );
}
