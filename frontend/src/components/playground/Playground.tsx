import { useEffect, useRef, useState } from "react";
import { getModels, streamContinue, type ChatMessage, type ModelInfo } from "../../lib/api";
import { ID_RAIZ, nuevoId, textoDe, type Rama } from "../../lib/ramas";
import { mostrarToken } from "../../lib/probs";
import { useStreamingChat, type Parametros } from "../../lib/useStreamingChat";
import ArbolRamas from "./ArbolRamas";
import Controles, { CONFIG_INICIAL, type Config } from "./Controles";
import InspectorToken, { type EstadoToken } from "./InspectorToken";
import MetricasRespuesta from "./MetricasRespuesta";
import TextoTokens, { type ModoColor } from "./TextoTokens";

type Seleccion = { turno: number; rama: string; indice: number } | null;

/** Con qué modelo y system prompt se generó cada respuesta (las ramas usan los mismos). */
type Contexto = { modelo: string; system: string };

const MODOS: { valor: ModoColor; nombre: string; ayuda: string }[] = [
  { valor: "probabilidad", nombre: "Probabilidad", ayuda: "Verde = token muy probable; rojo = poco probable" },
  { valor: "incertidumbre", nombre: "Incertidumbre", ayuda: "Violeta = el modelo dudaba entre varias opciones parecidas" },
  { valor: "ninguno", nombre: "Sin color", ayuda: "Texto plano (igual se puede hacer clic)" },
];

const parametrosDe = (c: Config): Parametros => ({
  temperature: c.temperature,
  top_p: c.top_p,
  top_k: c.top_k,
  seed: c.seedFija ? c.seed : null,
  think: c.think,
  top_logprobs: c.top_logprobs,
  max_tokens: c.max_tokens,
});

export default function Playground() {
  const [modelos, setModelos] = useState<ModelInfo[]>([]);
  const [config, setConfig] = useState<Config>(CONFIG_INICIAL);
  const [modo, setModo] = useState<ModoColor>("probabilidad");
  const [seleccion, setSeleccion] = useState<Seleccion>(null);
  const [entrada, setEntrada] = useState("");
  const [panel, setPanel] = useState<"inspector" | "ramas">("inspector");
  const [turnoVista, setTurnoVista] = useState<number | null>(null);
  const { turnos, generando, error, enviar, detener, reiniciar } = useStreamingChat();

  // Ramas creadas por el usuario, por turno del asistente (la original se arma desde `turnos`).
  const [ramasExtra, setRamasExtra] = useState<Record<number, Rama[]>>({});
  const [ramaActiva, setRamaActiva] = useState<Record<number, string>>({});
  const [contextos, setContextos] = useState<Record<number, Contexto>>({});
  const fin = useRef<HTMLDivElement>(null);

  useEffect(() => {
    getModels().then((ms) => {
      setModelos(ms);
      const preferido = ms.find((m) => m.name === "qwen3:8b") ?? ms[0];
      if (preferido) setConfig((c) => ({ ...c, modelo: preferido.name }));
    });
  }, []);

  useEffect(() => {
    fin.current?.scrollIntoView({ behavior: "smooth" });
  }, [turnos.length]);

  // --- Ramas -----------------------------------------------------------------

  function ramasDe(turno: number): Rama[] {
    const t = turnos[turno];
    const original: Rama = {
      id: ID_RAIZ,
      padreId: null,
      corte: null,
      tokens: t?.tokens ?? [],
      generando: generando && turno === turnos.length - 1,
      stats: t?.stats,
    };
    return [original, ...(ramasExtra[turno] ?? [])];
  }

  function ramaDe(turno: number, id?: string): Rama {
    const ramas = ramasDe(turno);
    return ramas.find((r) => r.id === (id ?? ramaActiva[turno] ?? ID_RAIZ)) ?? ramas[0];
  }

  /** Texto que cuenta como "la respuesta" de un turno: el de la rama activa. */
  function contenidoActivo(turno: number): string {
    const id = ramaActiva[turno];
    if (!id || id === ID_RAIZ) return turnos[turno].content;
    return textoDe(ramaDe(turno, id).tokens);
  }

  const actualizarRama = (turno: number, id: string, f: (r: Rama) => Rama) =>
    setRamasExtra((prev) => ({ ...prev, [turno]: (prev[turno] ?? []).map((r) => (r.id === id ? f(r) : r)) }));

  async function bifurcar(turno: number, origen: Rama, indice: number, alternativa: { token: string; logprob: number }) {
    const ctx = contextos[turno] ?? { modelo: config.modelo, system: config.system };
    const forzado = { ...alternativa, top: origen.tokens[indice].top };
    const base = [...origen.tokens.slice(0, indice), forzado];
    const nueva: Rama = { id: nuevoId(), padreId: origen.id, corte: indice, tokens: base, generando: true };

    setRamasExtra((prev) => ({ ...prev, [turno]: [...(prev[turno] ?? []), nueva] }));
    setRamaActiva((prev) => ({ ...prev, [turno]: nueva.id }));
    setTurnoVista(turno);
    setSeleccion({ turno, rama: nueva.id, indice });

    const historial: ChatMessage[] = [
      ...(ctx.system.trim() ? [{ role: "system" as const, content: ctx.system.trim() }] : []),
      ...turnos.slice(0, turno).map((t, i) => ({
        role: t.role,
        content: t.role === "assistant" ? contenidoActivo(i) : t.content,
      })),
    ];

    try {
      for await (const ev of streamContinue({
        model: ctx.modelo,
        messages: historial,
        prefix: textoDe(base),
        thinking: turnos[turno].thinking || null,
        ...parametrosDe(config),
      })) {
        if (ev.type === "meta") actualizarRama(turno, nueva.id, (r) => ({ ...r, metodo: ev.method }));
        else if (ev.type === "token")
          actualizarRama(turno, nueva.id, (r) => ({ ...r, tokens: [...r.tokens, ...ev.logprobs] }));
        else if (ev.type === "done") actualizarRama(turno, nueva.id, (r) => ({ ...r, stats: ev.stats }));
        else if (ev.type === "error") actualizarRama(turno, nueva.id, (r) => ({ ...r, error: ev.message }));
      }
    } catch (e) {
      actualizarRama(turno, nueva.id, (r) => ({ ...r, error: (e as Error).message }));
    } finally {
      actualizarRama(turno, nueva.id, (r) => ({ ...r, generando: false }));
    }
  }

  // --- Conversación ----------------------------------------------------------

  function mandar() {
    if (!entrada.trim() || generando) return;
    const reemplazos: Record<number, string> = {};
    turnos.forEach((t, i) => {
      if (t.role === "assistant" && ramaActiva[i] && ramaActiva[i] !== ID_RAIZ) reemplazos[i] = contenidoActivo(i);
    });
    setContextos((prev) => ({ ...prev, [turnos.length + 1]: { modelo: config.modelo, system: config.system } }));
    enviar(entrada, config.modelo, parametrosDe(config), config.system, reemplazos);
    setEntrada("");
    setSeleccion(null);
  }

  function nuevaConversacion() {
    reiniciar();
    setSeleccion(null);
    setRamasExtra({});
    setRamaActiva({});
    setContextos({});
    setTurnoVista(null);
  }

  // --- Inspector -------------------------------------------------------------

  const ramaSeleccionada = seleccion ? ramaDe(seleccion.turno, seleccion.rama) : null;
  let estadoToken: EstadoToken = "original";
  if (ramaSeleccionada && seleccion && ramaSeleccionada.corte !== null) {
    const c = ramaSeleccionada.corte;
    estadoToken = seleccion.indice < c ? "heredado" : seleccion.indice === c ? "forzado" : "generado";
  }

  // Turno cuyo árbol se muestra: el seleccionado o, si no hay, la última respuesta.
  const ultimoAsistente = turnos.map((t, i) => (t.role === "assistant" ? i : -1)).filter((i) => i >= 0).pop();
  const turnoArbol = seleccion?.turno ?? turnoVista ?? ultimoAsistente;
  const ramasArbol = turnoArbol !== undefined ? ramasDe(turnoArbol) : [];

  return (
    <div className="grid h-full min-h-0 grid-cols-[17rem_minmax(0,1fr)_22rem] gap-4">
      <Controles config={config} setConfig={setConfig} modelos={modelos} />

      <section className="flex min-h-0 flex-col gap-3">
        <div className="flex items-center gap-2 text-xs">
          <span className="text-zinc-400">Colorear por:</span>
          {MODOS.map((m) => (
            <button
              key={m.valor}
              title={m.ayuda}
              onClick={() => setModo(m.valor)}
              className={`rounded-md px-2 py-1 ${modo === m.valor ? "bg-zinc-700 text-white" : "text-zinc-400 hover:bg-zinc-800"}`}
            >
              {m.nombre}
            </button>
          ))}
          <button
            onClick={nuevaConversacion}
            className="ml-auto rounded-md border border-zinc-700 px-3 py-1 text-zinc-300 hover:bg-zinc-800"
          >
            Nueva conversación
          </button>
        </div>

        <div className="flex-1 space-y-4 overflow-y-auto rounded-xl border border-zinc-800 bg-zinc-900/50 p-4">
          {turnos.length === 0 && (
            <div className="mx-auto max-w-md space-y-2 pt-10 text-center text-sm text-zinc-500">
              <p className="text-base text-zinc-300">Playground de sampling</p>
              <p>
                Ajustá los parámetros a la izquierda, preguntá algo y hacé clic en cualquier token de la respuesta para ver
                entre qué opciones dudaba el modelo.
              </p>
              <p className="text-xs">
                Desde el inspector podés forzar una alternativa y ver cómo sigue la respuesta en una rama nueva.
              </p>
            </div>
          )}

          {turnos.map((t, i) => {
            if (t.role === "user") {
              return (
                <div key={i} className="flex justify-end">
                  <div className="max-w-[85%] whitespace-pre-wrap rounded-xl bg-indigo-600/80 px-4 py-2">{t.content}</div>
                </div>
              );
            }
            const ramas = ramasDe(i);
            const rama = ramaDe(i);
            const pos = ramas.findIndex((r) => r.id === rama.id);
            const cambiarRama = (delta: number) => {
              const otra = ramas[(pos + delta + ramas.length) % ramas.length];
              setRamaActiva((prev) => ({ ...prev, [i]: otra.id }));
              setSeleccion(null);
            };
            return (
              <div key={i} className="rounded-xl bg-zinc-800/70 px-4 py-3">
                {ramas.length > 1 && (
                  <div className="mb-2 flex flex-wrap items-center gap-2 border-b border-zinc-700 pb-2 text-xs text-zinc-400">
                    <button onClick={() => cambiarRama(-1)} className="rounded border border-zinc-700 px-2 hover:bg-zinc-700">
                      ‹
                    </button>
                    <span className="font-medium text-zinc-200">
                      {rama.corte === null ? "Respuesta original" : `Rama ${pos}`}
                    </span>
                    <span>
                      ({pos + 1} de {ramas.length})
                    </span>
                    <button onClick={() => cambiarRama(1)} className="rounded border border-zinc-700 px-2 hover:bg-zinc-700">
                      ›
                    </button>
                    {rama.corte !== null && (
                      <span>
                        · forzado <span className="font-mono text-amber-300">{mostrarToken(rama.tokens[rama.corte].token)}</span>{" "}
                        en el token #{rama.corte + 1}
                      </span>
                    )}
                    {rama.metodo && (
                      <span className="ml-auto rounded bg-zinc-900 px-1.5 py-0.5 font-mono text-[10px]" title="Cómo se generó la continuación">
                        {rama.metodo}
                      </span>
                    )}
                  </div>
                )}

                {t.thinking && (
                  <details className="mb-2 rounded-lg bg-zinc-900/60 px-3 py-2 text-xs text-zinc-400">
                    <summary className="cursor-pointer select-none">Razonamiento del modelo</summary>
                    <p className="mt-2 whitespace-pre-wrap">{t.thinking}</p>
                  </details>
                )}

                {rama.tokens.length ? (
                  <TextoTokens
                    tokens={rama.tokens}
                    modo={modo}
                    corte={rama.corte}
                    seleccionado={seleccion?.turno === i && seleccion.rama === rama.id ? seleccion.indice : null}
                    onSeleccionar={(indice) => setSeleccion({ turno: i, rama: rama.id, indice })}
                  />
                ) : (
                  <span className="whitespace-pre-wrap">{t.content || (rama.generando ? "…" : "")}</span>
                )}
                {rama.generando && rama.corte !== null && <span className="ml-1 animate-pulse text-zinc-500">▍</span>}
                {rama.error && <p className="mt-2 text-sm text-rose-400">{rama.error}</p>}

                {rama.tokens.length > 0 && !rama.generando && (
                  <MetricasRespuesta
                    tokens={rama.tokens}
                    stats={rama.stats}
                    desde={rama.corte === null ? 0 : rama.corte + 1}
                    onSeleccionar={(indice) => setSeleccion({ turno: i, rama: rama.id, indice })}
                  />
                )}
              </div>
            );
          })}
          <div ref={fin} />
        </div>

        {error && <p className="text-sm text-rose-400">{error}</p>}

        <div className="flex gap-2">
          <textarea
            value={entrada}
            onChange={(e) => setEntrada(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                mandar();
              }
            }}
            rows={2}
            placeholder="Escribí tu mensaje (Enter para enviar)"
            className="flex-1 resize-none rounded-xl border border-zinc-700 bg-zinc-900 px-4 py-2 outline-none focus:border-indigo-500"
          />
          {generando ? (
            <button onClick={detener} className="rounded-xl bg-rose-600 px-5 font-medium hover:bg-rose-500">
              Detener
            </button>
          ) : (
            <button onClick={mandar} className="rounded-xl bg-indigo-600 px-5 font-medium hover:bg-indigo-500">
              Enviar
            </button>
          )}
        </div>
      </section>

      <div className="flex min-h-0 flex-col gap-2">
        <div className="flex gap-1 text-xs">
          {(["inspector", "ramas"] as const).map((p) => (
            <button
              key={p}
              onClick={() => setPanel(p)}
              className={`flex-1 rounded-md px-3 py-1.5 ${panel === p ? "bg-zinc-800 text-white" : "text-zinc-400 hover:bg-zinc-900"}`}
            >
              {p === "inspector" ? "Inspector" : `Ramas${ramasArbol.length > 1 ? ` (${ramasArbol.length - 1})` : ""}`}
            </button>
          ))}
        </div>

        {panel === "inspector" ? (
          <div className="min-h-0 flex-1 overflow-y-auto">
            <InspectorToken
              tokens={ramaSeleccionada?.tokens ?? null}
              indice={seleccion?.indice ?? null}
              onMover={(indice) => seleccion && setSeleccion({ ...seleccion, indice })}
              estado={estadoToken}
              bloqueado={generando || !!ramaSeleccionada?.generando}
              onBifurcar={
                seleccion && ramaSeleccionada
                  ? (alt) => bifurcar(seleccion.turno, ramaSeleccionada, seleccion.indice, alt)
                  : undefined
              }
            />
          </div>
        ) : (
          <div className="flex min-h-0 flex-1 flex-col gap-2 rounded-xl border border-zinc-800 bg-zinc-900/50 p-3 text-sm">
            {turnoArbol === undefined ? (
              <p className="text-zinc-500">Todavía no hay respuestas. Cuando forces una alternativa desde el inspector, acá vas a ver el árbol.</p>
            ) : (
              <>
                <p className="text-[11px] leading-snug text-zinc-500">
                  Cada nodo es una versión de la respuesta. Clic para verla: la rama activa es la que sigue la conversación.
                  PPL = perplejidad de la parte nueva.
                </p>
                <div className="min-h-0 flex-1">
                  <ArbolRamas
                    ramas={ramasArbol}
                    activa={ramaActiva[turnoArbol] ?? ID_RAIZ}
                    onElegir={(id) => {
                      setRamaActiva((prev) => ({ ...prev, [turnoArbol]: id }));
                      setTurnoVista(turnoArbol);
                      setSeleccion(null);
                    }}
                  />
                </div>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
