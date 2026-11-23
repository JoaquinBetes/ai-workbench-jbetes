import { useEffect, useRef, useState } from "react";
import { getModels, type ModelInfo } from "../../lib/api";
import { useStreamingChat } from "../../lib/useStreamingChat";
import Controles, { CONFIG_INICIAL, type Config } from "./Controles";
import InspectorToken from "./InspectorToken";
import MetricasRespuesta from "./MetricasRespuesta";
import TextoTokens, { type ModoColor } from "./TextoTokens";

type Seleccion = { turno: number; indice: number } | null;

const MODOS: { valor: ModoColor; nombre: string; ayuda: string }[] = [
  { valor: "probabilidad", nombre: "Probabilidad", ayuda: "Verde = token muy probable; rojo = poco probable" },
  { valor: "incertidumbre", nombre: "Incertidumbre", ayuda: "Violeta = el modelo dudaba entre varias opciones parecidas" },
  { valor: "ninguno", nombre: "Sin color", ayuda: "Texto plano (igual se puede hacer clic)" },
];

export default function Playground() {
  const [modelos, setModelos] = useState<ModelInfo[]>([]);
  const [config, setConfig] = useState<Config>(CONFIG_INICIAL);
  const [modo, setModo] = useState<ModoColor>("probabilidad");
  const [seleccion, setSeleccion] = useState<Seleccion>(null);
  const [entrada, setEntrada] = useState("");
  const { turnos, generando, error, enviar, detener, reiniciar } = useStreamingChat();
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

  function mandar() {
    if (!entrada.trim()) return;
    enviar(
      entrada,
      config.modelo,
      {
        temperature: config.temperature,
        top_p: config.top_p,
        top_k: config.top_k,
        seed: config.seedFija ? config.seed : null,
        think: config.think,
        top_logprobs: config.top_logprobs,
        max_tokens: config.max_tokens,
      },
      config.system,
    );
    setEntrada("");
    setSeleccion(null);
  }

  const tokensSeleccionados = seleccion ? (turnos[seleccion.turno]?.tokens ?? null) : null;

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
            onClick={() => {
              reiniciar();
              setSeleccion(null);
            }}
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
                Probá: la misma pregunta con temperatura 0 y con 1.5, o una pregunta de hecho contra una creativa.
              </p>
            </div>
          )}

          {turnos.map((t, i) =>
            t.role === "user" ? (
              <div key={i} className="flex justify-end">
                <div className="max-w-[85%] whitespace-pre-wrap rounded-xl bg-indigo-600/80 px-4 py-2">{t.content}</div>
              </div>
            ) : (
              <div key={i} className="rounded-xl bg-zinc-800/70 px-4 py-3">
                {t.thinking && (
                  <details className="mb-2 rounded-lg bg-zinc-900/60 px-3 py-2 text-xs text-zinc-400">
                    <summary className="cursor-pointer select-none">Razonamiento del modelo</summary>
                    <p className="mt-2 whitespace-pre-wrap">{t.thinking}</p>
                  </details>
                )}
                {t.tokens?.length ? (
                  <TextoTokens
                    tokens={t.tokens}
                    modo={modo}
                    seleccionado={seleccion?.turno === i ? seleccion.indice : null}
                    onSeleccionar={(indice) => setSeleccion({ turno: i, indice })}
                  />
                ) : (
                  <span className="whitespace-pre-wrap">{t.content || (generando ? "…" : "")}</span>
                )}
                {t.tokens && t.tokens.length > 0 && !(generando && i === turnos.length - 1) && (
                  <MetricasRespuesta
                    tokens={t.tokens}
                    stats={t.stats}
                    onSeleccionar={(indice) => setSeleccion({ turno: i, indice })}
                  />
                )}
              </div>
            ),
          )}
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

      <InspectorToken
        tokens={tokensSeleccionados}
        indice={seleccion?.indice ?? null}
        onMover={(indice) => seleccion && setSeleccion({ ...seleccion, indice })}
      />
    </div>
  );
}
