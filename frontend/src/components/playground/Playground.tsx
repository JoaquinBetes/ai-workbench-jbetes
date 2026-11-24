import { ChevronLeft, ChevronRight, GitFork, RotateCcw, ScanSearch } from "lucide-react";
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { EVENTO_ENFOCAR } from "../../App";
import { streamContinue, type ChatMessage, type TokenLogprob } from "../../lib/api";
import { escribiendo, useComandos } from "../../lib/comandos";
import { crestasDeTokens } from "../../lib/paisaje";
import { mostrarToken } from "../../lib/probs";
import { ID_RAIZ, nuevoId, textoDe, type Rama } from "../../lib/ramas";
import { useModelos } from "../../lib/useModelos";
import { useStreamingChat, type Parametros } from "../../lib/useStreamingChat";
import { Giro } from "../ascii/Texto";
import { Cordillera } from "../graficos3d";
import Compositor from "../ui/Compositor";
import Segmentado from "../ui/Segmentado";
import { EncabezadoVista, Vacio } from "../ui/Vista";
import ArbolRamas from "./ArbolRamas";
import Controles, { CONFIG_INICIAL, type Config } from "./Controles";
import ExploradorSampling from "./ExploradorSampling";
import InspectorToken, { alternativasForzables, type EstadoToken } from "./InspectorToken";
import MetricasRespuesta from "./MetricasRespuesta";
import TextoTokens, { type ModoColor } from "./TextoTokens";
import TrazaConfianza from "./TrazaConfianza";

type Seleccion = { turno: number; rama: string; indice: number } | null;

/** Con qué modelo y system prompt se generó cada respuesta (las ramas usan los mismos). */
type Contexto = { modelo: string; system: string };

const MODOS: { valor: ModoColor; nombre: string; ayuda: string }[] = [
  { valor: "duda", nombre: "Duda", ayuda: "Subrayado ámbar donde el modelo dudaba entre varias opciones" },
  { valor: "probabilidad", nombre: "Probabilidad", ayuda: "Fondo ámbar cuanto menos probable fue el token elegido" },
  { valor: "ninguno", nombre: "Sin marcas", ayuda: "Texto plano (igual se puede hacer clic)" },
];

const EJEMPLOS = ["El mejor asado se hace con", "¿Capital de Australia?", "Un chiste de programadores"];

const parametrosDe = (c: Config): Parametros => ({
  temperature: c.temperature,
  top_p: c.top_p,
  top_k: c.top_k,
  seed: c.seedFija ? c.seed : null,
  think: c.think,
  top_logprobs: c.top_logprobs,
  max_tokens: c.max_tokens,
});

const dosCifras = (n: number) => String(n).padStart(2, "0");

/** Debajo de cada respuesta: la traza de duda (2D) o el paisaje de probabilidades (3D). */
function GraficoRespuesta({
  tokens,
  desde,
  sel,
  en3D,
  onVista,
  onSeleccionar,
}: {
  tokens: TokenLogprob[];
  desde: number;
  sel: number | null;
  en3D: boolean;
  onVista: (v: "traza" | "3d") => void;
  onSeleccionar: (i: number) => void;
}) {
  const crestas = useMemo(() => (en3D ? crestasDeTokens(tokens) : []), [en3D, tokens]);
  const selFila = sel === null ? null : crestas.findIndex((c) => c.indice === sel);
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-2">
        <Segmentado
          etiqueta="Cómo ver la respuesta"
          sm
          valor={en3D ? "3d" : "traza"}
          onChange={onVista}
          opciones={[
            { valor: "traza", etiqueta: "traza de duda" },
            { valor: "3d", etiqueta: "paisaje 3D" },
          ]}
        />
        {en3D && <span className="label max-sm:hidden">una cresta por token · al centro, la opción más probable</span>}
      </div>
      {en3D ? (
        <div className="well">
          <Cordillera
            titulo="Paisaje de probabilidades: una cresta por token, con sus alternativas de más a menos probable"
            filas={crestas.map((c) => ({ etiqueta: c.etiqueta, valores: c.valores, marca: c.marca }))}
            seleccion={selFila !== null && selFila >= 0 ? selFila : null}
            onSeleccionar={(f) => onSeleccionar(crestas[f].indice)}
            ejeX={["menos", "más probable", "menos"]}
            ejeZ={["inicio", "fin"]}
            alto={300}
          />
        </div>
      ) : (
        <TrazaConfianza tokens={tokens} desde={desde} seleccionado={sel} onSeleccionar={onSeleccionar} />
      )}
    </div>
  );
}

export default function Playground({ activa = true }: { activa?: boolean }) {
  const { modelos, preferido } = useModelos();
  const [config, setConfig] = useState<Config>(CONFIG_INICIAL);
  const [modo, setModo] = useState<ModoColor>("duda");
  const [seleccion, setSeleccion] = useState<Seleccion>(null);
  const [entrada, setEntrada] = useState("");
  const [panel, setPanel] = useState<"inspector" | "ramas">("inspector");
  // Qué respuesta muestra el paisaje 3D (uno solo a la vez: cada uno es un contexto WebGL).
  // null = la última respuesta; -1 = ninguna.
  const [turno3D, setTurno3D] = useState<number | null>(null);
  const [turnoVista, setTurnoVista] = useState<number | null>(null);
  const { turnos, generando, error, enviar, detener, reiniciar } = useStreamingChat();

  // Ramas creadas por el usuario, por turno del asistente (la original se arma desde `turnos`).
  const [ramasExtra, setRamasExtra] = useState<Record<number, Rama[]>>({});
  const [ramaActiva, setRamaActiva] = useState<Record<number, string>>({});
  const [contextos, setContextos] = useState<Record<number, Contexto>>({});
  const scroll = useRef<HTMLDivElement>(null);
  const prompt = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (preferido) setConfig((c) => (c.modelo ? c : { ...c, modelo: preferido }));
  }, [preferido]);

  // Mientras llega texto, seguir el final si ya estabas cerca del final.
  useLayoutEffect(() => {
    const el = scroll.current;
    if (!el || !turnos.length) return;
    if (el.scrollHeight - el.scrollTop - el.clientHeight < 160) el.scrollTop = el.scrollHeight;
  });
  useEffect(() => {
    const el = scroll.current;
    if (el && turnos.length) el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
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
    prompt.current?.focus();
  }

  // --- Inspector -------------------------------------------------------------

  const ramaSeleccionada = seleccion ? ramaDe(seleccion.turno, seleccion.rama) : null;
  let estadoToken: EstadoToken = "original";
  if (ramaSeleccionada && seleccion && ramaSeleccionada.corte !== null) {
    const c = ramaSeleccionada.corte;
    estadoToken = seleccion.indice < c ? "heredado" : seleccion.indice === c ? "forzado" : "generado";
  }
  const bloqueado = generando || !!ramaSeleccionada?.generando;
  const forzarAlternativa =
    seleccion && ramaSeleccionada
      ? (alt: { token: string; logprob: number }) => {
          setPanel("inspector");
          bifurcar(seleccion.turno, ramaSeleccionada, seleccion.indice, alt);
        }
      : undefined;

  // Turno cuyo árbol se muestra: el seleccionado o, si no hay, la última respuesta.
  const ultimoAsistente = turnos.map((t, i) => (t.role === "assistant" ? i : -1)).filter((i) => i >= 0).pop();
  const turnoArbol = seleccion?.turno ?? turnoVista ?? ultimoAsistente;
  const ramasArbol = turnoArbol !== undefined ? ramasDe(turnoArbol) : [];

  // --- Teclado y comandos ----------------------------------------------------

  const estadoTeclas = useRef({ seleccion, ramaSeleccionada, generando, bloqueado, forzarAlternativa, detener });
  estadoTeclas.current = { seleccion, ramaSeleccionada, generando, bloqueado, forzarAlternativa, detener };

  useEffect(() => {
    if (!activa) return;
    const alTeclear = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey || e.altKey || escribiendo(e) || document.querySelector(".overlay")) return;
      const s = estadoTeclas.current;
      if (e.key === "Escape") {
        if (s.generando) s.detener();
        else setSeleccion(null);
        return;
      }
      if (!s.seleccion || !s.ramaSeleccionada) return;
      const total = s.ramaSeleccionada.tokens.length;
      if (e.key === "ArrowLeft" || e.key === "ArrowRight") {
        e.preventDefault();
        const d = e.key === "ArrowLeft" ? -1 : 1;
        setSeleccion({ ...s.seleccion, indice: Math.min(total - 1, Math.max(0, s.seleccion.indice + d)) });
      } else if (/^[1-9]$/.test(e.key) && s.forzarAlternativa && !s.bloqueado) {
        const t = s.ramaSeleccionada.tokens[s.seleccion.indice];
        const alt = t && alternativasForzables(t)[Number(e.key) - 1];
        if (alt) {
          e.preventDefault();
          s.forzarAlternativa({ token: alt.token, logprob: Math.log(alt.p) });
        }
      }
    };
    const enfocar = (e: Event) => (e as CustomEvent).detail === "playground" && prompt.current?.focus();
    window.addEventListener("keydown", alTeclear);
    window.addEventListener(EVENTO_ENFOCAR, enfocar);
    return () => {
      window.removeEventListener("keydown", alTeclear);
      window.removeEventListener(EVENTO_ENFOCAR, enfocar);
    };
  }, [activa]);

  useComandos(
    "playground",
    activa
      ? [
          { id: "pg-nueva", titulo: "Nueva conversación", grupo: "Playground", claves: "borrar reiniciar", ejecutar: nuevaConversacion },
          ...MODOS.map((m) => ({
            id: `pg-modo-${m.valor}`,
            titulo: `Marcar tokens: ${m.nombre.toLowerCase()}`,
            grupo: "Playground",
            claves: "color subrayado incertidumbre",
            ejecutar: () => setModo(m.valor),
          })),
          { id: "pg-ramas", titulo: "Ver el árbol de ramas", grupo: "Playground", ejecutar: () => setPanel("ramas") },
          { id: "pg-inspector", titulo: "Ver el inspector de tokens", grupo: "Playground", ejecutar: () => setPanel("inspector") },
          ...(generando ? [{ id: "pg-detener", titulo: "Detener la generación", grupo: "Playground", atajo: ["Esc"], ejecutar: detener }] : []),
        ]
      : [],
  );

  // --- Vista -----------------------------------------------------------------

  return (
    <div className="flex h-full flex-col px-3 pb-3 max-lg:h-auto">
      <EncabezadoVista
        capitulo="Cap. 2"
        titulo="Playground de sampling"
        descripcion="Cada token de la respuesta se puede inspeccionar y bifurcar."
        acciones={
          <>
            <Segmentado
              etiqueta="Cómo marcar los tokens"
              sm
              valor={modo}
              onChange={setModo}
              opciones={MODOS.map((m) => ({ valor: m.valor, etiqueta: m.nombre, tip: m.ayuda }))}
            />
            <button type="button" onClick={nuevaConversacion} className="btn btn--sm" disabled={!turnos.length}>
              <RotateCcw aria-hidden /> Nueva conversación
            </button>
          </>
        }
      />

      <div className="grid min-h-0 flex-1 grid-cols-[18.5rem_minmax(0,1fr)_23rem] gap-3 max-xl:grid-cols-[17rem_minmax(0,1fr)] max-lg:grid-cols-1">
        <Controles config={config} setConfig={setConfig} modelos={modelos} />

        <section className="flex min-h-0 flex-col max-xl:row-span-1 max-lg:order-first" aria-label="Conversación">
          <div ref={scroll} className="min-h-0 flex-1 overflow-y-auto px-2 pb-6 max-lg:overflow-visible max-lg:px-0">
            {turnos.length === 0 ? (
              <ExploradorSampling temperatura={config.temperature} topK={config.top_k} topP={config.top_p} />
            ) : (
              <div className="mx-auto max-w-[780px] space-y-5 pt-2">
                {turnos.map((t, i) => {
                  const par = dosCifras(Math.floor(i / 2) + 1);
                  if (t.role === "user") {
                    return (
                      <div key={i} className="rise-in grid grid-cols-[5.5rem_1fr] gap-3 px-1">
                        <span className="mono pt-0.5 text-label text-muted">entrada {par}</span>
                        <p className="whitespace-pre-wrap text-body text-ink">{t.content}</p>
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
                  const sel = seleccion?.turno === i && seleccion.rama === rama.id ? seleccion.indice : null;
                  const desde = rama.corte === null ? 0 : rama.corte + 1;
                  return (
                    <article key={i} className="panel rise-in overflow-hidden">
                      <header className="panel-head gap-3">
                        <span className="mono text-label text-muted">salida {par}</span>
                        <span className="mono truncate text-label text-ink-2">{contextos[i]?.modelo ?? config.modelo}</span>
                        {ramas.length > 1 && (
                          <span className="flex items-center gap-1 border border-line bg-sunken p-0.5">
                            <button type="button" onClick={() => cambiarRama(-1)} className="btn btn--sm btn--icon btn--quiet h-6 w-6" aria-label="Rama anterior">
                              <ChevronLeft aria-hidden />
                            </button>
                            <span className="num px-1 text-label text-ink">
                              {rama.corte === null ? "original" : `rama ${pos}`}
                              <span className="text-muted"> · {pos + 1}/{ramas.length}</span>
                            </span>
                            <button type="button" onClick={() => cambiarRama(1)} className="btn btn--sm btn--icon btn--quiet h-6 w-6" aria-label="Rama siguiente">
                              <ChevronRight aria-hidden />
                            </button>
                          </span>
                        )}
                        {rama.corte !== null && (
                          <span className="hidden items-center gap-1.5 text-label text-muted lg:flex">
                            forzó
                            <span className="mono bg-accent px-1 text-[var(--accent-ink)]">
                              {mostrarToken(rama.tokens[rama.corte].token)}
                            </span>
                            <span className="num">en #{rama.corte + 1}</span>
                          </span>
                        )}
                        <span className="ml-auto flex items-center gap-2">
                          {rama.metodo && (
                            <span className="tag" data-tip="Cómo siguió el backend la respuesta desde el prefijo" data-tip-pos="left">
                              {rama.metodo}
                            </span>
                          )}
                          {rama.generando ? (
                            <span className="flex items-center gap-2 text-label text-accent">
                              <Giro />
                              <span className="num">{rama.tokens.length} tokens</span>
                            </span>
                          ) : (
                            ramas.length > 1 && (
                              <button
                                type="button"
                                className="btn btn--sm btn--quiet"
                                onClick={() => {
                                  setTurnoVista(i);
                                  setPanel("ramas");
                                }}
                              >
                                <GitFork aria-hidden /> Árbol
                              </button>
                            )
                          )}
                        </span>
                      </header>

                      <div className="@container space-y-4 px-5 py-4">
                        {t.thinking && (
                          <details className="well group px-3 py-2">
                            <summary className="label cursor-pointer select-none list-none">
                              <span className="inline-block transition-transform group-open:rotate-90">›</span> Razonamiento del modelo
                              <span className="num ml-2 text-muted">{t.thinking.length} caracteres</span>
                            </summary>
                            <p className="mt-2 whitespace-pre-wrap text-label leading-relaxed text-muted">{t.thinking}</p>
                          </details>
                        )}

                        {rama.tokens.length ? (
                          <TextoTokens
                            tokens={rama.tokens}
                            modo={modo}
                            corte={rama.corte}
                            cursor={rama.generando}
                            seleccionado={sel}
                            onSeleccionar={(indice) => setSeleccion({ turno: i, rama: rama.id, indice })}
                          />
                        ) : (
                          <div className="tokens">
                            {t.content}
                            {rama.generando && (
                              <span className="flex items-center gap-2 text-label text-muted">
                                <Giro /> Cargando el modelo y leyendo el prompt…
                              </span>
                            )}
                          </div>
                        )}
                        {rama.error && <p className="tag tag--danger h-auto py-1">{rama.error}</p>}

                        {rama.tokens.length > 1 && (
                          <GraficoRespuesta
                            tokens={rama.tokens}
                            desde={desde}
                            sel={sel}
                            en3D={!rama.generando && (turno3D === null ? i === ultimoAsistente : turno3D === i)}
                            onVista={(v) => setTurno3D(v === "3d" ? i : -1)}
                            onSeleccionar={(indice) => setSeleccion({ turno: i, rama: rama.id, indice })}
                          />
                        )}
                        {rama.tokens.length > 0 && !rama.generando && (
                          <MetricasRespuesta
                            tokens={rama.tokens}
                            stats={rama.stats}
                            desde={desde}
                            onSeleccionar={(indice) => setSeleccion({ turno: i, rama: rama.id, indice })}
                          />
                        )}
                      </div>
                    </article>
                  );
                })}
              </div>
            )}
          </div>

          {error && <p className="tag tag--danger mx-auto mb-3 h-auto max-w-[780px] py-1">{error}</p>}

          <div className="enter mx-auto w-full max-w-[804px] px-3 pt-2 max-lg:sticky max-lg:bottom-0 max-lg:z-30 max-lg:bg-[var(--bg)] max-lg:pb-2" style={{ ["--delay" as string]: "200ms" }}>
            <Compositor
              entradaRef={prompt}
              valor={entrada}
              onCambio={setEntrada}
              onEnviar={mandar}
              onDetener={detener}
              generando={generando}
              deshabilitado={!config.modelo}
              etiqueta="prompt para el modelo"
              placeholder="Preguntale algo al modelo y después hacé clic en cualquier token de la respuesta"
              chip={config.modelo || "sin modelo"}
              ejemplos={turnos.length ? [] : EJEMPLOS}
            />
          </div>
        </section>

        <aside className="panel enter flex min-h-0 flex-col max-xl:col-span-2 max-xl:h-[520px] max-lg:col-span-1" style={{ ["--delay" as string]: "120ms" }} aria-label="Inspector y ramas">
          <div className="border-b border-line p-2">
            <Segmentado
              etiqueta="Panel lateral"
              block
              valor={panel}
              onChange={setPanel}
              opciones={[
                { valor: "inspector", etiqueta: "Inspector", icono: <ScanSearch aria-hidden /> },
                {
                  valor: "ramas",
                  etiqueta: `Ramas${ramasArbol.length > 1 ? ` · ${ramasArbol.length - 1}` : ""}`,
                  icono: <GitFork aria-hidden />,
                },
              ]}
            />
          </div>

          {panel === "inspector" ? (
            <div key="inspector" className="fade-in min-h-0 flex-1 overflow-y-auto">
              <InspectorToken
                tokens={ramaSeleccionada?.tokens ?? null}
                indice={seleccion?.indice ?? null}
                onMover={(indice) => seleccion && setSeleccion({ ...seleccion, indice })}
                estado={estadoToken}
                bloqueado={bloqueado}
                onBifurcar={forzarAlternativa}
              />
            </div>
          ) : (
            <div key="ramas" className="fade-in flex min-h-0 flex-1 flex-col">
              {turnoArbol === undefined || ramasArbol.length < 2 ? (
                <Vacio icono={<GitFork />} titulo="Todavía no hay ramas">
                  Elegí un token, forzá una alternativa desde el inspector y acá vas a ver el árbol de versiones.
                </Vacio>
              ) : (
                <>
                  <p className="hint border-b border-line px-4 py-2.5">
                    Cada nodo es una versión de la salida {dosCifras(Math.floor(turnoArbol / 2) + 1)}. La rama activa es la que sigue la conversación.
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
        </aside>
      </div>
    </div>
  );
}
