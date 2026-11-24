import { Copy, History, Pencil, Plus, Target, Trash2 } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { escenaDiana } from "../../lib/ascii";
import { escribiendo, useComandos } from "../../lib/comandos";
import {
  borrarConjunto,
  borrarCorrida,
  crearConjunto,
  duplicarConjunto,
  editarConjunto,
  evaluar,
  historialCorridas,
  listarConjuntos,
  mapaEmbeddings,
  verConjunto,
  verCorrida,
  type CasoEval,
  type Conjunto,
  type ConjuntoResumen,
  type CorridaResumen,
  type IdMetrica,
  type PuntoMapa,
} from "../../lib/evaluacion";
import { parametrosEnNumero, useModelos } from "../../lib/useModelos";
import { useTelemetria } from "../../lib/telemetria";
import { BotonCorrer, PanelConfig, SERIES, SERIES_HEX } from "../comparador/comun";
import { Nube } from "../graficos3d";
import { Giro } from "../ascii/Texto";
import { Deslizador, Interruptor, Seccion } from "../ui/Controles";
import Segmentado from "../ui/Segmentado";
import { BarraVram } from "../ui/SelectorModelo";
import { EncabezadoVista, Vacio } from "../ui/Vista";
import type { Serie, Tabla } from "./comun";
import Dispersion from "./Dispersion";
import EditorConjunto from "./EditorConjunto";
import Historial from "./Historial";
import Resumen from "./Resumen";
import TablaCasos from "./TablaCasos";

const MAX_MODELOS = 4;
/** El mismo que usa el backend por defecto: respuestas cortas, comparables con la referencia. */
const SYSTEM_POR_DEFECTO = "Respondé solo con la respuesta, en una línea y sin explicaciones.";

const esEmbeddings = (nombre: string, familia: string | null) => /embed|bert/i.test(`${nombre} ${familia ?? ""}`);

type Mapa = { estado: "nada" | "cargando" | "listo" | "error"; puntos: PuntoMapa[]; modelo: string | null; error?: string };
const SIN_MAPA: Mapa = { estado: "nada", puntos: [], modelo: null };

const casosDe = (c: Conjunto) => c.casos.map((x, i) => ({ orden: x.orden ?? i, pregunta: x.pregunta, referencia: x.referencia }));

export default function Evaluacion({ activa = true }: { activa?: boolean }) {
  const { modelos, error: errorModelos } = useModelos();
  const t = useTelemetria();
  const generadores = modelos.filter((m) => !esEmbeddings(m.name, m.family));
  const ordenados = [...generadores].sort((a, b) => parametrosEnNumero(a.parameters) - parametrosEnNumero(b.parameters));
  const baseCaida = t.salud?.db && !t.salud.db.ok;

  // Conjuntos
  const [conjuntos, setConjuntos] = useState<ConjuntoResumen[]>([]);
  const [errorConjuntos, setErrorConjuntos] = useState<string | null>(null);
  const [conjuntoId, setConjuntoId] = useState<number | null>(null);
  const [conjunto, setConjunto] = useState<Conjunto | null>(null);
  const [editor, setEditor] = useState<{ inicial: Conjunto | null } | null>(null);
  const [guardando, setGuardando] = useState(false);
  const [errorEditor, setErrorEditor] = useState<string | null>(null);
  const [borrandoConjunto, setBorrandoConjunto] = useState(false);

  // Corrida
  const [slots, setSlots] = useState<Record<string, number>>({});
  const [temperatura, setTemperatura] = useState(0);
  const [maxTokens, setMaxTokens] = useState(128);
  const [system, setSystem] = useState(SYSTEM_POR_DEFECTO);
  const [modeloEmb, setModeloEmb] = useState("");
  const [conSemanticaPedida, setConSemanticaPedida] = useState(true);
  const embPorDefecto = t.salud?.modelo_embeddings ?? "qwen3-embedding:0.6b";
  const [tabla, setTabla] = useState<Tabla | null>(null);
  const [corriendo, setCorriendo] = useState(false);
  const [avisos, setAvisos] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [metrica, setMetrica] = useState<IdMetrica>("contiene");
  const [mapa, setMapa] = useState<Mapa>(SIN_MAPA);
  const cancelar = useRef<AbortController | null>(null);

  // Historial
  const [pestana, setPestana] = useState<"resultados" | "historial">("resultados");
  const [historial, setHistorial] = useState<CorridaResumen[]>([]);
  const [cargandoHistorial, setCargandoHistorial] = useState(true);
  const [errorHistorial, setErrorHistorial] = useState<string | null>(null);

  // Los modelos corren (y se listan) de menor a mayor; el color es el de cada uno.
  const posicion = (n: string) => {
    const i = ordenados.findIndex((m) => m.name === n);
    return i < 0 ? Infinity : i;
  };
  const elegidos = Object.keys(slots).sort((a, b) => posicion(a) - posicion(b));

  const refrescarConjuntos = useCallback(async (elegir?: number) => {
    try {
      const lista = await listarConjuntos();
      setConjuntos(lista);
      setErrorConjuntos(null);
      setConjuntoId((actual) => elegir ?? (lista.some((c) => c.id === actual) ? actual : (lista[0]?.id ?? null)));
    } catch (e) {
      setErrorConjuntos((e as Error).message);
    }
  }, []);

  const refrescarHistorial = useCallback(async () => {
    try {
      setHistorial(await historialCorridas());
      setErrorHistorial(null);
    } catch (e) {
      setErrorHistorial(`No pude leer el historial: ${(e as Error).message}`);
    } finally {
      setCargandoHistorial(false);
    }
  }, []);

  useEffect(() => {
    refrescarConjuntos();
    refrescarHistorial();
  }, [refrescarConjuntos, refrescarHistorial]);

  // Al elegir un conjunto se ven sus casos, todavía sin respuestas.
  useEffect(() => {
    if (conjuntoId === null) return;
    let vigente = true;
    verConjunto(conjuntoId)
      .then((c) => {
        if (!vigente) return;
        setConjunto(c);
        if (!cancelar.current) {
          setTabla({ conjunto: c.nombre, casos: casosDe(c), series: [], origen: "vivo" });
          setMapa(SIN_MAPA);
          setAvisos([]);
          setError(null);
        }
      })
      .catch((e) => vigente && setErrorConjuntos((e as Error).message));
    return () => {
      vigente = false;
    };
  }, [conjuntoId]);

  // Por defecto, dos modelos de distinto tamaño: la diferencia se ve enseguida.
  useEffect(() => {
    if (Object.keys(slots).length || !ordenados.length) return;
    const sugeridos = ["qwen3:0.6b", "qwen3:8b"].filter((n) => ordenados.some((m) => m.name === n));
    const lista = sugeridos.length ? sugeridos : ordenados.slice(0, 2).map((m) => m.name);
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

  const cargarMapa = async (series: Serie[]) => {
    const ids = series.filter((s) => Object.values(s.resultados).some((r) => r.semantica !== null)).map((s) => s.corrida_id);
    if (!ids.length) return setMapa(SIN_MAPA);
    setMapa({ ...SIN_MAPA, estado: "cargando" });
    try {
      const m = await mapaEmbeddings(ids);
      setMapa({ estado: "listo", puntos: m.puntos, modelo: m.modelo_embeddings });
    } catch (e) {
      setMapa({ ...SIN_MAPA, estado: "error", error: (e as Error).message });
    }
  };

  async function correr() {
    if (!conjunto || !elegidos.length || corriendo) return;
    const ctrl = new AbortController();
    cancelar.current = ctrl;
    setCorriendo(true);
    setError(null);
    setAvisos([]);
    setMapa(SIN_MAPA);
    setEditor(null);
    setPestana("resultados");
    const casos = casosDe(conjunto);
    setTabla({ conjunto: conjunto.nombre, casos, series: [], origen: "vivo" });

    const series: Serie[] = [];
    const publicar = () => setTabla((tb) => tb && { ...tb, series: series.map((s) => ({ ...s, resultados: { ...s.resultados } })) });
    const serie = (id: number) => series.find((s) => s.corrida_id === id);
    try {
      for await (const ev of evaluar(
        {
          conjunto_id: conjunto.id,
          modelos: elegidos,
          temperatura,
          max_tokens: maxTokens,
          system: system.trim() || null,
          seed: 42,
          modelo_embeddings: conSemanticaPedida ? modeloEmb.trim() || embPorDefecto : null,
        },
        ctrl.signal,
      )) {
        if (ev.type === "modelo") {
          series.push({ corrida_id: ev.corrida_id, modelo: ev.modelo, slot: slots[ev.modelo] ?? series.length, estado: "corriendo", resultados: {}, agregados: null });
        } else if (ev.type === "caso") {
          const s = serie(ev.corrida_id);
          if (s) s.resultados[ev.orden] = ev;
        } else if (ev.type === "semantica") {
          const s = serie(ev.corrida_id);
          if (s) for (const [orden, v] of Object.entries(ev.valores)) if (s.resultados[+orden]) s.resultados[+orden] = { ...s.resultados[+orden], semantica: v };
        } else if (ev.type === "modelo_fin") {
          const s = serie(ev.corrida_id);
          if (s) Object.assign(s, { estado: "lista", agregados: ev.agregados });
        } else if (ev.type === "aviso") {
          setAvisos((a) => [...a, ev.message]);
        } else if (ev.type === "error") {
          setError(ev.message);
          for (const s of series) if (s.estado === "corriendo") Object.assign(s, { estado: "error", error: ev.message });
        }
        publicar();
      }
    } catch (e) {
      const cortada = ctrl.signal.aborted;
      for (const s of series) if (s.estado === "corriendo") s.estado = cortada ? "cancelada" : "error";
      if (!cortada) setError((e as Error).message);
      publicar();
    } finally {
      cancelar.current = null;
      setCorriendo(false);
      refrescarHistorial();
      cargarMapa(series);
    }
  }

  const detener = () => cancelar.current?.abort();

  async function abrirCorridas(ids: number[]) {
    try {
      const corridas = await Promise.all(ids.map(verCorrida));
      const casos = new Map<number, { orden: number; pregunta: string; referencia: string }>();
      for (const c of corridas) for (const r of c.resultados) if (!casos.has(r.orden)) casos.set(r.orden, r);
      // El mismo modelo dos veces (otra temperatura, otro día): el nombre dice cuál es cuál.
      const repetidos = new Set(corridas.map((c) => c.modelo).filter((m, i, a) => a.indexOf(m) !== i));
      const series: Serie[] = corridas.map((c, i) => ({
        corrida_id: c.id,
        modelo: repetidos.has(c.modelo) ? `${c.modelo} · T ${c.temperatura} · #${c.id}` : c.modelo,
        slot: i % SERIES.length,
        estado: c.estado,
        error: c.error,
        resultados: Object.fromEntries(c.resultados.map((r) => [r.orden, r])),
        agregados: c.agregados,
      }));
      setTabla({
        conjunto: corridas[0].conjunto_nombre,
        casos: [...casos.values()].sort((a, b) => a.orden - b.orden).map(({ orden, pregunta, referencia }) => ({ orden, pregunta, referencia })),
        series,
        origen: "historial",
      });
      setError(null);
      setAvisos([]);
      setEditor(null);
      setPestana("resultados");
      cargarMapa(series);
    } catch (e) {
      setErrorHistorial(`No pude abrir la corrida: ${(e as Error).message}`);
    }
  }

  async function borrarDelHistorial(id: number) {
    try {
      await borrarCorrida(id);
      setTabla((tb) => tb && { ...tb, series: tb.series.filter((s) => s.corrida_id !== id) });
      refrescarHistorial();
    } catch (e) {
      setErrorHistorial(`No pude borrar la corrida: ${(e as Error).message}`);
    }
  }

  async function guardarConjunto(datos: { nombre: string; descripcion: string; casos: CasoEval[] }) {
    setGuardando(true);
    setErrorEditor(null);
    try {
      const inicial = editor?.inicial;
      const c = inicial && !inicial.curado ? await editarConjunto(inicial.id, datos) : await crearConjunto(datos);
      setEditor(null);
      await refrescarConjuntos(c.id);
      setConjunto(c);
      setTabla({ conjunto: c.nombre, casos: casosDe(c), series: [], origen: "vivo" });
    } catch (e) {
      setErrorEditor((e as Error).message);
    } finally {
      setGuardando(false);
    }
  }

  async function duplicar() {
    if (!conjunto) return;
    try {
      const copia = await duplicarConjunto(conjunto.id);
      await refrescarConjuntos(copia.id);
      setErrorEditor(null);
      setEditor({ inicial: copia });
    } catch (e) {
      setErrorConjuntos((e as Error).message);
    }
  }

  async function borrarElegido() {
    if (!conjunto || conjunto.curado) return;
    try {
      await borrarConjunto(conjunto.id);
      setBorrandoConjunto(false);
      setConjuntoId(null);
      await refrescarConjuntos();
    } catch (e) {
      setErrorConjuntos((e as Error).message);
    }
  }

  // Teclado: Esc detiene la corrida.
  const vivo = useRef({ corriendo });
  vivo.current = { corriendo };
  useEffect(() => {
    if (!activa) return;
    const alTeclear = (e: KeyboardEvent) => {
      if (e.key !== "Escape" || escribiendo(e) || document.querySelector(".overlay")) return;
      if (vivo.current.corriendo) detener();
    };
    window.addEventListener("keydown", alTeclear);
    return () => window.removeEventListener("keydown", alTeclear);
  }, [activa]);

  useComandos(
    "evaluacion",
    activa
      ? [
          { id: "eval-correr", titulo: "Evaluar el conjunto elegido", grupo: "Evaluación", ejecutar: correr },
          { id: "eval-historial", titulo: "Ver el historial de evaluaciones", grupo: "Evaluación", claves: "corridas guardadas", ejecutar: () => setPestana("historial") },
          { id: "eval-nuevo", titulo: "Crear un conjunto de casos", grupo: "Evaluación", claves: "editor preguntas referencias", ejecutar: () => setEditor({ inicial: null }) },
          ...(corriendo ? [{ id: "eval-detener", titulo: "Detener la evaluación", grupo: "Evaluación", atajo: ["Esc"], ejecutar: detener }] : []),
        ]
      : [],
  );

  const totalCasos = tabla?.casos.length ?? conjunto?.casos.length ?? 0;
  const hechos = tabla?.series.reduce((a, s) => a + Object.keys(s.resultados).length, 0) ?? 0;
  const series = tabla?.series ?? [];
  const conSemantica = series.some((s) => Object.values(s.resultados).some((r) => r.semantica !== null));
  const puntosNube = mapa.puntos.map((p) => {
    const s = series.find((x) => x.corrida_id === p.corrida_id);
    return { ...p, color: s ? SERIES_HEX[s.slot] : undefined, etiqueta: s?.modelo ?? p.modelo };
  });

  return (
    <div className="flex h-full flex-col px-3 pb-3 max-lg:h-auto">
      <EncabezadoVista
        capitulo="Cap. 3"
        titulo="Evaluación"
        descripcion="Cada respuesta contra su referencia: de la coincidencia exacta a la similitud de los embeddings."
        acciones={
          <Segmentado
            etiqueta="Sección de la evaluación"
            valor={pestana}
            onChange={setPestana}
            opciones={[
              { valor: "resultados", etiqueta: "Resultados", icono: <Target aria-hidden /> },
              { valor: "historial", etiqueta: `Historial${historial.length ? ` · ${historial.length}` : ""}`, icono: <History aria-hidden /> },
            ]}
          />
        }
      />
      <div className="grid min-h-0 flex-1 grid-cols-[19rem_minmax(0,1fr)] gap-3 max-xl:grid-cols-[17.5rem_minmax(0,1fr)] max-lg:h-auto max-lg:flex-none max-lg:grid-cols-1">
        <PanelConfig
          titulo="Corrida"
          meta={`${elegidos.length} de ${MAX_MODELOS} modelos`}
          pie={
            <BotonCorrer
              corriendo={corriendo}
              onCorrer={correr}
              onDetener={detener}
              texto={conjunto ? `Evaluar ${conjunto.casos.length} casos` : "Evaluar"}
              hecho={hechos}
              total={totalCasos * elegidos.length}
              deshabilitado={!conjunto || !elegidos.length || !!baseCaida}
            />
          }
        >
          <Seccion
            titulo="Conjunto"
            extra={
              <button type="button" className="btn btn--quiet btn--sm" onClick={() => setEditor({ inicial: null })} disabled={corriendo}>
                <Plus aria-hidden /> Nuevo
              </button>
            }
          >
            {errorConjuntos && (
              <p className="text-label text-danger" role="alert">
                {errorConjuntos}
              </p>
            )}
            <ul className="space-y-1" aria-label="Conjuntos de casos">
              {conjuntos.map((c) => {
                const activo = c.id === conjuntoId;
                return (
                  <li key={c.id}>
                    <button
                      type="button"
                      aria-pressed={activo}
                      disabled={corriendo}
                      onClick={() => {
                        setConjuntoId(c.id);
                        setBorrandoConjunto(false);
                        setEditor(null);
                      }}
                      className={`flex w-full items-center gap-2.5 border px-2.5 py-2 text-left transition-colors ${
                        activo ? "border-line-2 bg-raised" : "border-transparent hover:bg-raised"
                      } disabled:opacity-60`}
                    >
                      <span className={`h-2.5 w-2.5 flex-none border ${activo ? "border-transparent bg-accent" : "border-line-2"}`} aria-hidden />
                      <span className="min-w-0 flex-1 truncate text-label text-ink">{c.nombre}</span>
                      {c.curado && <span className="tag">curado</span>}
                      <span className="num text-label text-muted">{c.casos}</span>
                    </button>
                  </li>
                );
              })}
            </ul>
            {conjunto && conjunto.id === conjuntoId && (
              <div className="space-y-2.5">
                {conjunto.descripcion && <p className="hint">{conjunto.descripcion}</p>}
                <div className="flex flex-wrap gap-2">
                  {conjunto.curado ? (
                    <button type="button" className="btn btn--sm" onClick={duplicar} disabled={corriendo} data-tip="Los curados no se editan: se copian">
                      <Copy aria-hidden /> Duplicar para editar
                    </button>
                  ) : (
                    <>
                      <button
                        type="button"
                        className="btn btn--sm"
                        disabled={corriendo}
                        onClick={() => {
                          setErrorEditor(null);
                          setEditor({ inicial: conjunto });
                        }}
                      >
                        <Pencil aria-hidden /> Editar
                      </button>
                      {borrandoConjunto ? (
                        <button type="button" className="btn btn--danger btn--sm" onClick={borrarElegido} onBlur={() => setBorrandoConjunto(false)} autoFocus>
                          Borrar «{conjunto.nombre}»
                        </button>
                      ) : (
                        <button type="button" className="btn btn--quiet btn--sm" disabled={corriendo} onClick={() => setBorrandoConjunto(true)}>
                          <Trash2 aria-hidden /> Borrar
                        </button>
                      )}
                    </>
                  )}
                </div>
              </div>
            )}
          </Seccion>

          <Seccion titulo="Modelos">
            {errorModelos && <p className="text-label text-danger">{errorModelos}</p>}
            <ul className="space-y-1" aria-label="Modelos para evaluar">
              {ordenados.map((m) => {
                const slot = slots[m.name];
                const activo = slot !== undefined;
                const lleno = !activo && elegidos.length >= MAX_MODELOS;
                return (
                  <li key={m.name}>
                    <button
                      type="button"
                      aria-pressed={activo}
                      disabled={lleno || corriendo}
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

          <Seccion titulo="Generación">
            <Deslizador etiqueta="Temperatura" valor={temperatura} min={0} max={1.5} paso={0.05} decimales={2} onChange={setTemperatura} />
            <Deslizador etiqueta="Máximo de tokens" valor={maxTokens} min={16} max={512} paso={16} onChange={setMaxTokens} />
            <div>
              <label htmlFor="eval-system" className="label mb-1.5 block">
                System prompt
              </label>
              <textarea id="eval-system" rows={3} value={system} onChange={(e) => setSystem(e.target.value)} className="field prosa resize-y text-small" />
            </div>
            <p className="hint">Con temperatura 0 y la misma semilla, cada modelo responde siempre igual: las métricas comparan modelos y no el azar.</p>
          </Seccion>

          <Seccion titulo="Similitud semántica">
            <Interruptor valor={conSemanticaPedida} onChange={setConSemanticaPedida}>
              Comparar los significados
            </Interruptor>
            <div>
              <label htmlFor="eval-emb" className="label mb-1.5 block">
                Modelo de embeddings
              </label>
              <input
                id="eval-emb"
                value={modeloEmb}
                onChange={(e) => setModeloEmb(e.target.value)}
                placeholder={embPorDefecto}
                disabled={!conSemanticaPedida}
                className="field field--mono disabled:opacity-50"
                spellCheck={false}
              />
            </div>
            <p className="hint">Convierte cada texto en un vector: dos textos que quieren decir lo mismo quedan cerca aunque no compartan palabras.</p>
          </Seccion>
        </PanelConfig>

        <section className="min-h-0 space-y-3 overflow-y-auto pr-1 max-lg:overflow-visible max-lg:pr-0" aria-label={pestana === "historial" ? "Corridas guardadas" : "Resultados"}>
          {pestana === "historial" ? (
            <Historial corridas={historial} cargando={cargandoHistorial} error={errorHistorial} onAbrir={abrirCorridas} onBorrar={borrarDelHistorial} />
          ) : editor ? (
            <EditorConjunto key={editor.inicial?.id ?? "nuevo"} inicial={editor.inicial} guardando={guardando} error={errorEditor} onGuardar={guardarConjunto} onCancelar={() => setEditor(null)} />
          ) : baseCaida ? (
            <div className="panel h-full">
              <Vacio escena={escenaDiana} etiquetaEscena="Dardos que caen sobre una diana" titulo="La base de datos no responde">
                Las evaluaciones se guardan en Postgres. Levantala con <span className="mono">docker compose up -d db</span> y recargá la página.
              </Vacio>
            </div>
          ) : (
            <>
              {(error || avisos.length > 0) && (
                <div className="space-y-2" role="status">
                  {error && <p className="panel border-[var(--danger)] px-4 py-3 text-small text-danger">{error}</p>}
                  {avisos.map((a) => (
                    <p key={a} className="panel px-4 py-3 text-small text-doubt">
                      {a}
                    </p>
                  ))}
                </div>
              )}

              {series.length ? (
                <Resumen series={series} totalCasos={totalCasos} />
              ) : (
                <div className="panel">
                  <Vacio escena={escenaDiana} etiquetaEscena="Dardos que caen sobre una diana: los que quedan cerca del centro se encienden" titulo="Cada respuesta contra su referencia" altoEscena={200}>
                    Elegí un conjunto y hasta cuatro modelos. Cada respuesta se mide contra la correcta con siete métricas, de la coincidencia exacta a la similitud de los embeddings.
                  </Vacio>
                </div>
              )}

              {series.length > 0 && (
                <section className="panel rise-in" aria-labelledby="eval-lexico">
                  <div className="panel-head">
                    <h2 id="eval-lexico" className="panel-title">
                      Palabras contra significado
                    </h2>
                    {mapa.modelo && <span className="panel-meta mono ml-auto max-sm:hidden">{mapa.modelo}</span>}
                  </div>
                  {conSemantica ? (
                    <div className="grid lg:grid-cols-2 lg:divide-x lg:divide-line max-lg:divide-y max-lg:divide-line">
                      <div className="h-[380px]">
                        <Dispersion series={series} casos={tabla?.casos ?? []} />
                      </div>
                      <div className="min-w-0">
                        {mapa.estado === "listo" && puntosNube.length ? (
                          <Nube titulo="Mapa de los embeddings en 3D" puntos={puntosNube} alto={380} />
                        ) : (
                          <div className="flex h-[380px] items-center justify-center gap-2 px-6 text-center text-label text-muted">
                            {mapa.estado === "error" ? (
                              <span>No pude dibujar el mapa: {mapa.error}</span>
                            ) : corriendo || mapa.estado === "cargando" ? (
                              <>
                                <Giro /> el mapa se dibuja al terminar la corrida
                              </>
                            ) : (
                              <span>Sin mapa para estas corridas.</span>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  ) : (
                    <p className="hint px-4 py-5">
                      {corriendo
                        ? "La similitud semántica se calcula cuando el modelo termina todos los casos: los embeddings van en un solo lote."
                        : "Estas corridas no tienen similitud semántica: se corrieron sin modelo de embeddings, o no estaba bajado."}
                    </p>
                  )}
                </section>
              )}

              {tabla && <TablaCasos casos={tabla.casos} series={series} metrica={metrica} onMetrica={setMetrica} />}
            </>
          )}
        </section>
      </div>
    </div>
  );
}
