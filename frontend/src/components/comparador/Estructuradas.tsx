import { Braces, ChevronRight } from "lucide-react";
import { Fragment, useEffect, useRef, useState, type ReactNode } from "react";
import { Bar, BarChart, CartesianGrid, LabelList, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import {
  muestraEstructurada,
  type EvaluacionEstructurada,
  type MetodoEstructurado,
  type ResultadoEstructurado,
} from "../../lib/api";
import { escribiendo, useComandos } from "../../lib/comandos";
import { num, porcentaje, segundos } from "../../lib/formato";
import { useModelos } from "../../lib/useModelos";
import { Deslizador, Interruptor, Seccion } from "../ui/Controles";
import Segmentado from "../ui/Segmentado";
import SelectorModelo from "../ui/SelectorModelo";
import { EJE, GRILLA, TipGrafico, Vacio } from "../ui/Vista";
import { BotonCorrer, PanelConfig, SERIES_HEX } from "./comun";
import { EJEMPLOS_ESQUEMAS } from "./ejemplosEsquemas";

const METODOS: { id: MetodoEstructurado; nombre: string; color: string; ayuda: string }[] = [
  { id: "prompt", nombre: "Solo prompt", color: SERIES_HEX[0], ayuda: "La respuesta se acepta solo si ya es JSON puro." },
  {
    id: "postproceso",
    nombre: "Prompt + post-proceso",
    color: SERIES_HEX[1],
    ayuda: "La misma respuesta, pero el backend extrae y repara el JSON si hace falta.",
  },
  {
    id: "restringido",
    nombre: "Sampling restringido",
    color: SERIES_HEX[2],
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

type Pestana = "texto" | "esquema" | "esperado";

const json = (v: unknown) => JSON.stringify(v, null, 2);

function parsear(texto: string): { valor: unknown; error: string | null } {
  if (!texto.trim()) return { valor: undefined, error: null };
  try {
    return { valor: JSON.parse(texto), error: null };
  } catch (e) {
    return { valor: undefined, error: (e as Error).message };
  }
}

/** Resaltado mínimo de JSON (claves, textos, números, literales). Sirve también para texto mezclado. */
function resaltar(texto: string): ReactNode[] {
  const re = /("(?:\\.|[^"\\])*")(\s*:)?|(-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?)|\b(true|false|null)\b/g;
  const partes: ReactNode[] = [];
  let ultimo = 0;
  let m: RegExpExecArray | null;
  let k = 0;
  while ((m = re.exec(texto))) {
    if (m.index > ultimo) partes.push(texto.slice(ultimo, m.index));
    if (m[1] && m[2]) {
      partes.push(<span key={k++} className="text-ink">{m[1]}</span>, m[2]);
    } else if (m[1]) {
      partes.push(<span key={k++} style={{ color: "var(--accent)" }}>{m[1]}</span>);
    } else if (m[3]) {
      partes.push(<span key={k++} style={{ color: "#7cb5f2" }}>{m[3]}</span>);
    } else {
      partes.push(<span key={k++} style={{ color: "var(--doubt)" }}>{m[4]}</span>);
    }
    ultimo = re.lastIndex;
  }
  partes.push(texto.slice(ultimo));
  return partes;
}

/** Editor de código liviano: números de línea que siguen el scroll del texto. */
function EditorCodigo({
  valor,
  onChange,
  etiqueta,
  invalido,
  mono = true,
}: {
  valor: string;
  onChange: (v: string) => void;
  etiqueta: string;
  invalido?: boolean;
  mono?: boolean;
}) {
  const gutter = useRef<HTMLDivElement>(null);
  const lineas = Math.max(valor.split("\n").length, 1);
  return (
    <div className={`well relative grid h-full min-h-0 overflow-hidden ${mono ? "grid-cols-[2.75rem_1fr]" : "grid-cols-1"} ${invalido ? "border-[var(--danger)]" : ""}`}>
      {mono && (
        <div ref={gutter} className="num overflow-hidden border-r border-line py-3 pr-2 text-right text-label leading-5 text-muted select-none" aria-hidden>
          {Array.from({ length: lineas }, (_, i) => (
            <div key={i}>{i + 1}</div>
          ))}
        </div>
      )}
      <textarea
        value={valor}
        aria-label={etiqueta}
        aria-invalid={invalido}
        spellCheck={false}
        onChange={(e) => onChange(e.target.value)}
        onScroll={(e) => {
          if (gutter.current) gutter.current.scrollTop = e.currentTarget.scrollTop;
        }}
        className={`h-full w-full resize-none bg-transparent px-3 py-3 leading-5 text-ink outline-none ${mono ? "mono text-label" : "text-small leading-6"}`}
      />
    </div>
  );
}

function Barrita({ v, color }: { v: number | null; color: string }) {
  return (
    <span className="mt-2 block h-[3px] overflow-hidden rounded-full bg-line" aria-hidden>
      <span className="block h-full origin-left rounded-full" style={{ background: color, transform: `scaleX(${v ?? 0})`, transition: "transform 300ms var(--ease)" }} />
    </span>
  );
}

export default function Estructuradas({ activa = true }: { activa?: boolean }) {
  const { modelos, preferido } = useModelos();
  const [modelo, setModelo] = useState("");
  const [ejemploId, setEjemploId] = useState(EJEMPLOS_ESQUEMAS[0].id);
  const [esquemaTexto, setEsquemaTexto] = useState(json(EJEMPLOS_ESQUEMAS[0].esquema));
  const [texto, setTexto] = useState(EJEMPLOS_ESQUEMAS[0].texto);
  const [esperadoTexto, setEsperadoTexto] = useState(json(EJEMPLOS_ESQUEMAS[0].esperado));
  const [pestana, setPestana] = useState<Pestana>("texto");
  const [repeticiones, setRepeticiones] = useState(5);
  const [temperatura, setTemperatura] = useState(0.7);
  const [libre, setLibre] = useState(true);
  const [restringido, setRestringido] = useState(true);
  const [muestras, setMuestras] = useState<Muestra[]>([]);
  const [corriendo, setCorriendo] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [abierta, setAbierta] = useState<string | null>(null);
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
    if (esquema.error || !esquema.valor) {
      setPestana("esquema");
      return setError("El esquema no es un JSON válido.");
    }
    if (esperado.error) {
      setPestana("esperado");
      return setError("La respuesta esperada no es un JSON válido (o dejala vacía).");
    }
    setError(null);
    setMuestras([]);
    setAbierta(null);
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
    "estructuradas",
    activa
      ? [
          { id: "est-correr", titulo: `Ejecutar ${total} generaciones con esquema`, grupo: "Salidas estructuradas", claves: "json", ejecutar: ejecutar },
          ...EJEMPLOS_ESQUEMAS.map((e) => ({
            id: `est-ej-${e.id}`,
            titulo: `Cargar el ejemplo: ${e.nombre.toLowerCase()}`,
            grupo: "Salidas estructuradas",
            ejecutar: () => elegirEjemplo(e.id),
          })),
          ...(corriendo ? [{ id: "est-detener", titulo: "Detener las generaciones", grupo: "Salidas estructuradas", atajo: ["Esc"], ejecutar: detener }] : []),
        ]
      : [],
  );

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
      exactitud: conExactitud.length ? conExactitud.reduce((a, x) => a + (x.ev.accuracy ?? 0), 0) / conExactitud.length : null,
      latencia: evs.length ? evs.reduce((a, x) => a + (x.s.resultado?.latency_s ?? 0), 0) / evs.length : null,
    };
  }).filter((r) => r.n > 0);

  const fila = (metrica: string, clave: "jsonOk" | "esquemaOk" | "exactitud") => ({
    metrica,
    ...Object.fromEntries(resumen.map((r) => [r.id, r[clave] !== null ? Math.round(r[clave]! * 100) : null])),
  });
  const datosGrafico = [
    fila("JSON válido", "jsonOk"),
    fila("Cumple el esquema", "esquemaOk"),
    ...(resumen.some((r) => r.exactitud !== null) ? [fila("Datos correctos", "exactitud")] : []),
  ];

  const ejemplos = [...EJEMPLOS_ESQUEMAS.map((e) => ({ id: e.id, nombre: e.nombre })), { id: "custom", nombre: "Personalizado" }];
  const marca = (malo: boolean) => (malo ? <span className="h-1.5 w-1.5 rounded-full bg-danger" aria-label="con errores" /> : null);

  return (
    <div className="grid h-full min-h-0 grid-cols-[18.5rem_minmax(0,1fr)] gap-3">
      <PanelConfig
        meta={`${total} generaciones`}
        pie={
          <>
            {error && <p className="tag tag--danger h-auto py-1">{error}</p>}
            <BotonCorrer
              corriendo={corriendo}
              onCorrer={ejecutar}
              onDetener={detener}
              texto={`Ejecutar ${total} generaciones`}
              hecho={muestras.length}
              total={total}
              deshabilitado={!modos.length || !texto.trim() || !modelo}
            />
          </>
        }
      >
        <Seccion titulo="Ejemplo">
          <div className="space-y-1">
            {ejemplos.map((e) => (
              <button
                key={e.id}
                type="button"
                aria-pressed={ejemploId === e.id}
                onClick={() => elegirEjemplo(e.id)}
                className={`flex w-full items-center gap-2 rounded-md border px-2.5 py-1.5 text-left text-label transition-colors ${
                  ejemploId === e.id ? "border-line-2 bg-raised text-ink" : "border-transparent text-ink-2 hover:bg-raised"
                }`}
              >
                <span className={`h-1.5 w-1.5 rounded-full ${ejemploId === e.id ? "bg-accent" : "bg-line-2"}`} aria-hidden />
                {e.nombre}
              </button>
            ))}
          </div>
        </Seccion>
        <Seccion titulo="Modelo">
          <SelectorModelo modelos={modelos} valor={modelo} onChange={setModelo} />
          <Deslizador etiqueta="Temperatura" valor={temperatura} min={0} max={2} paso={0.1} decimales={1} onChange={setTemperatura} />
          <Deslizador etiqueta="Repeticiones por modo" valor={repeticiones} min={1} max={20} paso={1} onChange={setRepeticiones} />
        </Seccion>
        <Seccion titulo="Métodos">
          <Interruptor valor={libre} onChange={setLibre}>
            Sin restricción
          </Interruptor>
          <p className="hint -mt-1 pl-[46px]">
            Una sola generación evaluada como <b className="font-medium" style={{ color: "#7cb5f2" }}>solo prompt</b> y como{" "}
            <b className="font-medium" style={{ color: "#ec8a62" }}>prompt + post-proceso</b>.
          </p>
          <Interruptor valor={restringido} onChange={setRestringido}>
            Sampling restringido
          </Interruptor>
          <p className="hint -mt-1 pl-[46px]">Ollama recibe el esquema y limita los tokens posibles.</p>
        </Seccion>
      </PanelConfig>

      <section className="min-h-0 space-y-3 overflow-y-auto pr-1" aria-label="Entrada y resultados">
        <div className="panel enter flex h-[340px] flex-col" style={{ ["--delay" as string]: "120ms" }}>
          <div className="panel-head">
            <Segmentado
              etiqueta="Qué editar"
              sm
              valor={pestana}
              onChange={setPestana}
              opciones={[
                { valor: "texto", etiqueta: "Texto de entrada" },
                { valor: "esquema", etiqueta: <>JSON Schema {marca(!!esquema.error)}</> },
                { valor: "esperado", etiqueta: <>Respuesta esperada {marca(!!esperado.error)}</> },
              ]}
            />
            <span className="panel-meta ml-auto">
              {pestana === "texto"
                ? `${texto.length} caracteres`
                : pestana === "esquema"
                  ? esquema.error
                    ? "JSON inválido"
                    : "JSON válido"
                  : esperado.error
                    ? "JSON inválido"
                    : esperadoTexto.trim()
                      ? "mide la exactitud"
                      : "opcional"}
            </span>
          </div>
          <div className="min-h-0 flex-1 p-3">
            {pestana === "texto" && (
              <EditorCodigo
                etiqueta="Texto de entrada"
                mono={false}
                valor={texto}
                onChange={(v) => {
                  setTexto(v);
                  setEjemploId("custom");
                }}
              />
            )}
            {pestana === "esquema" && (
              <EditorCodigo
                etiqueta="JSON Schema"
                valor={esquemaTexto}
                invalido={!!esquema.error}
                onChange={(v) => {
                  setEsquemaTexto(v);
                  setEjemploId("custom");
                }}
              />
            )}
            {pestana === "esperado" && (
              <EditorCodigo etiqueta="Respuesta esperada" valor={esperadoTexto} invalido={!!esperado.error} onChange={setEsperadoTexto} />
            )}
          </div>
        </div>

        {muestras.length === 0 && !corriendo && (
          <div className="panel">
            <Vacio icono={<Braces />} titulo="Tres formas de pedir JSON">
              Ejecutá y comparamos qué tan seguido cada método da JSON válido, cumple el esquema y acierta los datos.
            </Vacio>
          </div>
        )}

        {resumen.length > 0 && (
          <>
            <div className="panel rise-in grid lg:grid-cols-3 lg:divide-x lg:divide-line">
              {resumen.map((r) => (
                <div key={r.id} className="relative p-4" data-tip={r.ayuda}>
                  <span className="absolute inset-x-0 top-0 h-[2px]" style={{ background: r.color }} aria-hidden />
                  <div className="flex items-center gap-2">
                    <span className="h-2.5 w-2.5 rounded-[3px]" style={{ background: r.color }} aria-hidden />
                    <span className="panel-title">{r.nombre}</span>
                    <span className="num ml-auto text-label text-muted">{r.n} muestras</span>
                  </div>
                  <div className="mt-4 grid grid-cols-4 gap-3">
                    {(
                      [
                        ["JSON", r.jsonOk],
                        ["Esquema", r.esquemaOk],
                        ["Datos", r.exactitud],
                      ] as const
                    ).map(([t, v]) => (
                      <div key={t}>
                        <div className="label">{t}</div>
                        <div className="num mt-0.5 text-[18px] leading-none text-ink">{v === null ? "—" : porcentaje(v, 0)}</div>
                        <Barrita v={v} color={r.color} />
                      </div>
                    ))}
                    <div>
                      <div className="label">Latencia</div>
                      <div className="num mt-0.5 text-[18px] leading-none text-ink">{segundos(r.latencia)}</div>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <div className="panel rise-in">
              <div className="panel-head">
                <span className="panel-title">Comparación de métodos</span>
                <span className="ml-auto flex flex-wrap items-center gap-4">
                  {resumen.map((r) => (
                    <span key={r.id} className="flex items-center gap-1.5 text-label text-ink-2">
                      <span className="h-2.5 w-2.5 rounded-[3px]" style={{ background: r.color }} aria-hidden />
                      {r.nombre}
                    </span>
                  ))}
                </span>
              </div>
              <div className="h-60 px-2 pt-4">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={datosGrafico} margin={{ top: 22, right: 12, bottom: 0, left: -8 }} barGap={3}>
                    <CartesianGrid {...GRILLA} />
                    <XAxis dataKey="metrica" {...EJE} tick={{ ...EJE.tick, fontFamily: "var(--font-text)" }} />
                    <YAxis domain={[0, 100]} ticks={[0, 50, 100]} tickFormatter={(v) => `${v} %`} {...EJE} />
                    <Tooltip
                      cursor={{ fill: "rgba(255,255,255,0.04)" }}
                      content={<TipGrafico formato={(v) => `${v} %`} nombres={Object.fromEntries(METODOS.map((m) => [m.id, m.nombre]))} />}
                    />
                    {resumen.map((r) => (
                      <Bar key={r.id} dataKey={r.id} fill={r.color} radius={[4, 4, 0, 0]} maxBarSize={24} isAnimationActive={false}>
                        <LabelList dataKey={r.id} position="top" formatter={(v) => `${v}`} style={{ fill: "var(--ink-2)", fontSize: 13, fontFamily: "var(--font-mono)" }} />
                      </Bar>
                    ))}
                  </BarChart>
                </ResponsiveContainer>
              </div>
              <p className="hint border-t border-line px-4 py-2.5">
                “Datos correctos” mide el contenido, no el formato: un JSON perfecto puede tener la edad equivocada.
              </p>
            </div>
          </>
        )}

        {muestras.length > 0 && (
          <div className="panel rise-in">
            <div className="panel-head">
              <span className="panel-title">Muestras</span>
              <span className="panel-meta ml-auto">clic para ver la respuesta cruda</span>
            </div>
            <ul className="divide-y divide-line">
              {muestras.map((s) => {
                const clave = `${s.modo}-${s.n}`;
                const evs = Object.entries(s.resultado?.evaluaciones ?? {}) as [MetodoEstructurado, EvaluacionEstructurada][];
                const abiertaEsta = abierta === clave;
                return (
                  <li key={clave}>
                    <button
                      type="button"
                      aria-expanded={abiertaEsta}
                      onClick={() => setAbierta(abiertaEsta ? null : clave)}
                      className="flex w-full flex-wrap items-center gap-x-4 gap-y-1.5 px-4 py-2.5 text-left transition-colors hover:bg-raised"
                    >
                      <ChevronRight className={`h-3.5 w-3.5 text-muted transition-transform duration-200 ${abiertaEsta ? "rotate-90" : ""}`} aria-hidden />
                      <span className="mono w-40 text-label text-muted">
                        {s.modo === "libre" ? "sin restricción" : "restringido"} · #{s.n}
                      </span>
                      {s.error && <span className="text-label text-danger">{s.error}</span>}
                      {evs.map(([m, ev]) => {
                        const met = METODOS.find((x) => x.id === m)!;
                        return (
                          <span key={m} className="flex items-center gap-1.5" data-tip={met.nombre}>
                            <span className="h-2 w-2 rounded-[2px]" style={{ background: met.color }} aria-hidden />
                            <span className={`tag ${ev.json_ok ? "" : "tag--danger"}`}>{ev.json_ok ? "✓" : "✗"} json</span>
                            <span className={`tag ${ev.schema_ok ? "" : "tag--danger"}`}>{ev.schema_ok ? "✓" : "✗"} esquema</span>
                            {ev.accuracy !== null && (
                              <span className={`tag ${ev.accuracy === 1 ? "tag--accent" : "tag--doubt"}`}>{num(ev.accuracy * 100, 0)} % datos</span>
                            )}
                          </span>
                        );
                      })}
                      {s.resultado && <span className="num ml-auto text-label text-muted">{segundos(s.resultado.latency_s)}</span>}
                    </button>
                    {abiertaEsta && s.resultado && (
                      <div className="fade-in space-y-2 px-4 pb-4 pl-11">
                        <pre className="well mono max-h-60 overflow-auto whitespace-pre-wrap px-3 py-2.5 text-label leading-5 text-muted">
                          {s.resultado.raw ? resaltar(s.resultado.raw) : "(vacía)"}
                        </pre>
                        {evs.map(([m, ev]) =>
                          ev.repairs.length || ev.schema_errors.length ? (
                            <p key={m} className="text-label text-muted">
                              <span className="text-ink-2">{METODOS.find((x) => x.id === m)!.nombre}:</span>{" "}
                              {ev.repairs.length > 0 && <Fragment>reparaciones: {ev.repairs.join(" · ")}. </Fragment>}
                              {ev.schema_errors.length > 0 && <span className="text-danger">errores: {ev.schema_errors.join(" · ")}</span>}
                            </p>
                          ) : null,
                        )}
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          </div>
        )}
      </section>
    </div>
  );
}
