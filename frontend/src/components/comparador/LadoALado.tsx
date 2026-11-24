import { useEffect, useRef, useState } from "react";
import { streamChat, type ChatMessage, type ModelInfo, type Stats, type TokenLogprob } from "../../lib/api";
import { escribiendo, useComandos } from "../../lib/comandos";
import { num, segundos } from "../../lib/formato";
import { metricas, pct } from "../../lib/probs";
import { parametrosEnNumero, useModelos } from "../../lib/useModelos";
import InspectorToken from "../playground/InspectorToken";
import TextoTokens from "../playground/TextoTokens";
import { Deslizador, Interruptor, Seccion } from "../ui/Controles";
import { BarraVram } from "../ui/SelectorModelo";
import { escenaToro } from "../../lib/ascii";
import { Giro } from "../ascii/Texto";
import { Vacio } from "../ui/Vista";
import { BotonCorrer, CampoPrompt, Estado, PanelConfig, SERIES, SERIES_HEX } from "./comun";
import ResumenModelos3D, { type FilaResumen } from "./ResumenModelos3D";

const MAX_MODELOS = 4;

type Columna = {
  modelo: ModelInfo;
  slot: number;
  estado: "esperando" | "generando" | "listo" | "error";
  tokens: TokenLogprob[];
  thinking: string;
  stats?: Stats;
  error?: string;
};

function Fila({ etiqueta, valor }: { etiqueta: string; valor: string }) {
  return (
    <div className="flex justify-between gap-2 py-1">
      <dt className="text-label text-muted">{etiqueta}</dt>
      <dd className="num text-label text-ink">{valor}</dd>
    </div>
  );
}

export default function LadoALado({ activa = true }: { activa?: boolean }) {
  const { modelos } = useModelos();
  // Cada modelo elegido conserva su color mientras siga elegido (el color sigue a la entidad).
  const [slots, setSlots] = useState<Record<string, number>>({});
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
  const elegidos = Object.keys(slots);

  // Por defecto, hasta 3 modelos qwen3 de distinto tamaño.
  useEffect(() => {
    if (elegidos.length || !modelos.length) return;
    const qwen = modelos.filter((m) => m.name.startsWith("qwen3:") && !m.name.includes("thinking"));
    const base = qwen.length ? qwen : modelos;
    const ordenados = [...base].sort((a, b) => parametrosEnNumero(a.parameters) - parametrosEnNumero(b.parameters));
    const sugeridos = ["qwen3:0.6b", "qwen3:1.7b", "qwen3:8b"].filter((n) => ordenados.some((m) => m.name === n));
    const lista = sugeridos.length >= 2 ? sugeridos : ordenados.slice(0, 3).map((m) => m.name);
    setSlots(Object.fromEntries(lista.map((n, i) => [n, i])));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [modelos]);

  const alternar = (nombre: string) =>
    setSlots((prev) => {
      if (nombre in prev) {
        const resto = { ...prev };
        delete resto[nombre];
        return resto;
      }
      if (Object.keys(prev).length >= MAX_MODELOS) return prev;
      const usados = new Set(Object.values(prev));
      const libre = [0, 1, 2, 3].find((s) => !usados.has(s)) ?? 0;
      return { ...prev, [nombre]: libre };
    });

  const actualizar = (i: number, f: (c: Columna) => Columna) =>
    setColumnas((prev) => prev.map((c, j) => (j === i ? f(c) : c)));

  async function comparar() {
    if (!prompt.trim() || elegidos.length === 0 || corriendo) return;
    const infos = elegidos
      .map((n) => modelos.find((m) => m.name === n)!)
      .filter(Boolean)
      .sort((a, b) => parametrosEnNumero(a.parameters) - parametrosEnNumero(b.parameters));

    setColumnas(infos.map((m) => ({ modelo: m, slot: slots[m.name], estado: "esperando", tokens: [], thinking: "" })));
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
        if ((e as Error).name === "AbortError") {
          actualizar(i, (c) => ({ ...c, estado: c.tokens.length ? "listo" : "esperando" }));
          break;
        }
        actualizar(i, (c) => ({ ...c, estado: "error", error: (e as Error).message }));
      }
    }
    setCorriendo(false);
  }

  const detener = () => cancelar.current?.abort();

  // Teclado: ←/→ en el inspector, Esc detiene o suelta el token.
  const estado = useRef({ seleccion, columnas, corriendo });
  estado.current = { seleccion, columnas, corriendo };
  useEffect(() => {
    if (!activa) return;
    const alTeclear = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey || e.altKey || escribiendo(e) || document.querySelector(".overlay")) return;
      const s = estado.current;
      if (e.key === "Escape") return s.corriendo ? detener() : setSeleccion(null);
      if (!s.seleccion) return;
      const total = s.columnas[s.seleccion.col]?.tokens.length ?? 0;
      if (e.key === "ArrowLeft" || e.key === "ArrowRight") {
        e.preventDefault();
        const d = e.key === "ArrowLeft" ? -1 : 1;
        setSeleccion({ ...s.seleccion, indice: Math.min(total - 1, Math.max(0, s.seleccion.indice + d)) });
      }
    };
    window.addEventListener("keydown", alTeclear);
    return () => window.removeEventListener("keydown", alTeclear);
  }, [activa]);

  useComandos(
    "lado-a-lado",
    activa
      ? [
          { id: "lal-correr", titulo: "Comparar los modelos elegidos", grupo: "Comparador", ejecutar: comparar },
          ...(corriendo ? [{ id: "lal-detener", titulo: "Detener la comparación", grupo: "Comparador", atajo: ["Esc"], ejecutar: detener }] : []),
        ]
      : [],
  );

  const resumen: FilaResumen[] = columnas
    .filter((c) => c.estado === "listo")
    .map((c) => {
      const m = metricas(c.tokens);
      return {
        modelo: c.modelo.name,
        color: SERIES_HEX[c.slot],
        tokens: c.tokens,
        tokS: c.stats?.tokens_per_second ?? null,
        carga: c.stats?.load_s ?? null,
        perplejidad: m?.perplejidad ?? null,
        confianza: m?.confianzaPromedio ?? null,
      };
    });

  const colSel = seleccion ? columnas[seleccion.col] : null;
  const ordenados = [...modelos].sort((a, b) => parametrosEnNumero(a.parameters) - parametrosEnNumero(b.parameters));

  return (
    <div className="grid h-full min-h-0 grid-cols-[18.5rem_minmax(0,1fr)_21rem] gap-3 max-xl:grid-cols-[17rem_minmax(0,1fr)] max-lg:h-auto max-lg:grid-cols-1">
      <PanelConfig
        meta={`${elegidos.length} de ${MAX_MODELOS} modelos`}
        pie={
          <BotonCorrer
            corriendo={corriendo}
            onCorrer={comparar}
            onDetener={detener}
            texto="Comparar"
            hecho={columnas.filter((c) => c.estado === "listo" || c.estado === "error").length}
            total={columnas.length}
            deshabilitado={!prompt.trim() || !elegidos.length}
          />
        }
      >
        <Seccion titulo="Modelos">
          <ul className="space-y-1" aria-label="Modelos para comparar">
            {ordenados.map((m) => {
              const slot = slots[m.name];
              const activo = slot !== undefined;
              const lleno = !activo && elegidos.length >= MAX_MODELOS;
              return (
                <li key={m.name}>
                  <button
                    type="button"
                    aria-pressed={activo}
                    disabled={lleno}
                    onClick={() => alternar(m.name)}
                    className={`flex w-full items-center gap-2.5 border px-2.5 py-2 text-left transition-colors ${
                      activo ? "border-line-2 bg-raised" : "border-transparent hover:bg-raised"
                    } disabled:opacity-40`}
                  >
                    <span
                      className="h-2.5 w-2.5 flex-none border"
                      style={activo ? { background: SERIES[slot], borderColor: "transparent" } : { borderColor: "var(--line-2)" }}
                      aria-hidden
                    />
                    <span className="mono min-w-0 flex-1 truncate text-label text-ink">{m.name}</span>
                    <span className="num text-label text-muted">{m.parameters}</span>
                    <BarraVram gb={m.size_gb} />
                  </button>
                </li>
              );
            })}
          </ul>
        </Seccion>
        <Seccion titulo="Parámetros">
          <Deslizador etiqueta="Temperatura" valor={temperatura} min={0} max={2} paso={0.05} decimales={2} onChange={setTemperatura} />
          <Deslizador etiqueta="Máximo de tokens" valor={maxTokens} min={16} max={1024} paso={16} onChange={setMaxTokens} />
          <Interruptor valor={semillaFija} onChange={setSemillaFija}>
            Misma semilla para todos (42)
          </Interruptor>
          <Interruptor valor={pensar} onChange={setPensar}>
            Razonar antes de responder
          </Interruptor>
        </Seccion>
        <Seccion titulo="Prompt">
          <input
            value={system}
            onChange={(e) => setSystem(e.target.value)}
            aria-label="System prompt"
            placeholder="System prompt (opcional, igual para todos)"
            className="field text-label"
          />
          <CampoPrompt
            valor={prompt}
            onCambio={setPrompt}
            onCorrer={comparar}
            placeholder="El mismo prompt va a todos los modelos. Probá: ¿Quién escribió Cien años de soledad?"
          />
          <p className="hint">Los modelos corren de a uno: en 8 GB de VRAM no entran juntos.</p>
        </Seccion>
      </PanelConfig>

      <section className="min-h-0 space-y-3 overflow-y-auto pr-1 max-lg:overflow-visible max-lg:pr-0" aria-label="Resultados">
        {columnas.length === 0 ? (
          <div className="panel h-full">
            <Vacio escena={escenaToro} etiquetaEscena="Un toro que gira, dibujado con caracteres" titulo="Elegí modelos y escribí un prompt">
              Cada modelo responde en su columna, con su velocidad, el tiempo de carga y qué tan seguro estuvo.
            </Vacio>
          </div>
        ) : (
          <>
            <div className="grid gap-3" style={{ gridTemplateColumns: `repeat(auto-fit, minmax(min(100%, 230px), 1fr))` }}>
              {columnas.map((c, i) => {
                const m = metricas(c.tokens);
                return (
                  <article key={c.modelo.name} className="panel rise-in flex min-w-0 flex-col overflow-hidden">
                    <span className="h-[2px]" style={{ background: SERIES[c.slot] }} aria-hidden />
                    <header className="flex items-start justify-between gap-2 border-b border-line px-4 py-3">
                      <div className="min-w-0">
                        <div className="mono truncate text-small text-ink">{c.modelo.name}</div>
                        <div className="num truncate text-label text-muted">
                          {c.modelo.parameters} · {c.modelo.quantization} · {num(c.modelo.size_gb, 1)} GB
                        </div>
                      </div>
                      <Estado
                        estado={c.estado}
                        detalle={
                          c.estado === "generando"
                            ? c.tokens.length
                              ? `${c.tokens.length} tokens`
                              : "cargando"
                            : c.estado === "listo"
                              ? `${num(c.stats?.tokens_per_second, 0)} tok/s`
                              : undefined
                        }
                      />
                    </header>

                    <div className="min-h-24 flex-1 space-y-3 px-4 py-3">
                      {c.thinking && (
                        <details className="well px-3 py-2">
                          <summary className="label cursor-pointer select-none">Razonamiento</summary>
                          <p className="prosa mt-1 whitespace-pre-wrap text-small leading-relaxed text-muted">{c.thinking}</p>
                        </details>
                      )}
                      {c.tokens.length > 0 ? (
                        <TextoTokens
                          tokens={c.tokens}
                          modo="duda"
                          cursor={c.estado === "generando"}
                          seleccionado={seleccion?.col === i ? seleccion.indice : null}
                          onSeleccionar={(indice) => setSeleccion({ col: i, indice })}
                        />
                      ) : (
                        <span className="flex items-center gap-2 text-label text-muted">
                          {c.estado === "generando" && <Giro />}
                          {c.estado === "generando" ? "Cargando el modelo en la GPU…" : c.estado === "esperando" ? "Espera su turno" : ""}
                        </span>
                      )}
                      {c.error && <p className="tag tag--danger h-auto py-1">{c.error}</p>}
                    </div>

                    {c.estado === "listo" && m && (
                      <dl className="divide-y divide-line border-t border-line bg-sunken px-4 py-1.5">
                        <Fila etiqueta="Tokens" valor={String(m.tokens)} />
                        <Fila etiqueta="Velocidad" valor={`${num(c.stats?.tokens_per_second, 1)} tok/s`} />
                        <Fila etiqueta="Carga" valor={segundos(c.stats?.load_s)} />
                        <Fila etiqueta="Primer token" valor={segundos(c.stats?.time_to_first_token_s)} />
                        <Fila etiqueta="Confianza" valor={pct(m.confianzaPromedio)} />
                        <Fila etiqueta="Perplejidad" valor={num(m.perplejidad, 2)} />
                      </dl>
                    )}
                  </article>
                );
              })}
            </div>
            {resumen.length >= 2 && !corriendo && <ResumenModelos3D filas={resumen} />}
          </>
        )}
      </section>

      <aside className="panel enter flex min-h-0 flex-col max-xl:col-span-2 max-xl:max-h-[480px] max-lg:col-span-1" style={{ ["--delay" as string]: "120ms" }} aria-label="Inspector">
        <div className="panel-head">
          <span className="panel-title">Inspector</span>
          {colSel && (
            <span className="ml-auto flex min-w-0 items-center gap-2">
              <span className="h-2 w-2 flex-none" style={{ background: SERIES[colSel.slot] }} aria-hidden />
              <span className="mono truncate text-label text-muted">{colSel.modelo.name}</span>
            </span>
          )}
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto">
          <InspectorToken
            tokens={colSel?.tokens ?? null}
            indice={seleccion?.indice ?? null}
            onMover={(indice) => seleccion && setSeleccion({ ...seleccion, indice })}
          />
        </div>
      </aside>
    </div>
  );
}
