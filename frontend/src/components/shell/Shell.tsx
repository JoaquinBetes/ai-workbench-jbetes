import { Columns3, Command, FlaskConical, MessageSquareText, Pause, Play, Search, Target } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { useListaComandos, type Comando } from "../../lib/comandos";
import { entero, num, segundos } from "../../lib/formato";
import { useTelemetria } from "../../lib/telemetria";
import { BarraTexto, Giro, SparkTexto } from "../ascii/Texto";
import { Teclas } from "../ui/Controles";
import Segmentado from "../ui/Segmentado";
import { movimiento, useMovimiento } from "../../lib/movimiento";

export type IdVista = "playground" | "comparador" | "evaluacion" | "chat";

export const VISTAS: { id: IdVista; nombre: string; capitulo: string | null; tecla: string }[] = [
  { id: "playground", nombre: "Playground", capitulo: "Cap. 2", tecla: "1" },
  { id: "comparador", nombre: "Comparador", capitulo: "Cap. 2", tecla: "2" },
  { id: "evaluacion", nombre: "Evaluación", capitulo: "Cap. 3", tecla: "3" },
  { id: "chat", nombre: "Chat", capitulo: null, tecla: "4" },
];

const ICONOS: Record<IdVista, typeof FlaskConical> = {
  playground: FlaskConical,
  comparador: Columns3,
  evaluacion: Target,
  chat: MessageSquareText,
};

/** Ícono de la marca: un chip visto desde arriba, con sus pines. */
function Chip() {
  return (
    <svg width="22" height="22" viewBox="0 0 22 22" aria-hidden className="flex-none text-accent">
      <rect x="5" y="5" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="1.5" />
      <rect x="8.5" y="8.5" width="5" height="5" fill="currentColor" />
      {[7.5, 11, 14.5].map((p) => (
        <g key={p} stroke="currentColor" strokeWidth="1.5">
          <line x1={p} y1="1" x2={p} y2="5" />
          <line x1={p} y1="17" x2={p} y2="21" />
          <line x1="1" y1={p} x2="5" y2={p} />
          <line x1="17" y1={p} x2="21" y2={p} />
        </g>
      ))}
    </svg>
  );
}

/**
 * La marca: un chip y el nombre en letra de terminal. Mientras el modelo
 * genera, al lado gira un indicador de texto.
 */
export function Marca({ vivo }: { vivo: boolean }) {
  return (
    <span className="flex items-center gap-2.5">
      <Chip />
      <span className="display text-[21px] leading-none text-ink">WORKBENCH</span>
      <span className="dot text-[14px] leading-none text-muted max-sm:hidden">lab.llm</span>
      {vivo && <Giro className="text-accent" />}
    </span>
  );
}

export function BarraSuperior({
  vista,
  onVista,
  onPaleta,
}: {
  vista: IdVista;
  onVista: (v: IdVista) => void;
  onPaleta: () => void;
}) {
  const t = useTelemetria();
  const ok = !t.saludError && !!t.salud?.ollama.ok;
  const mac = typeof navigator !== "undefined" && /Mac/.test(navigator.platform);

  return (
    <header className="enter relative z-20 flex h-[var(--bar-top)] items-center gap-5 border-b border-line bg-[var(--bg)] px-4 max-lg:gap-3 max-sm:h-auto max-sm:flex-wrap max-sm:py-2" style={{ ["--delay" as string]: "0ms" }}>
      <Marca vivo={t.activas.length > 0} />

      <span className="h-5 w-px bg-line-2 max-sm:hidden" aria-hidden />

      <Segmentado
        etiqueta="Vistas"
        valor={vista}
        onChange={onVista}
        opciones={VISTAS.map((v) => {
          const Icono = ICONOS[v.id];
          return {
            valor: v.id,
            // En el teléfono, solo la vista actual muestra su nombre (las otras, el ícono).
            etiqueta: <span className={v.id === vista ? undefined : "max-sm:sr-only"}>{v.nombre}</span>,
            icono: <Icono aria-hidden />,
            tip: `Alt ${v.tecla}`,
          };
        })}
      />

      <div className="ml-auto flex items-center gap-3 max-sm:gap-2">
        <button
          type="button"
          onClick={onPaleta}
          aria-label="Abrir la paleta de comandos"
          className="field flex h-[34px] w-72 items-center gap-2 whitespace-nowrap text-left text-muted transition-colors hover:border-[var(--ink-3)] max-lg:w-auto"
        >
          <Search className="h-3.5 w-3.5" aria-hidden />
          <span className="flex-1 truncate text-label max-lg:hidden">Buscar o ejecutar…</span>
          <span className="solo-teclado"><Teclas teclas={[mac ? "⌘" : "Ctrl", "K"]} /></span>
        </button>
        <span
          className="flex items-center gap-2 text-[12px] text-muted max-sm:hidden"
          data-tip={ok ? `Backend y Ollama responden · ${t.salud?.ollama.host ?? ""}` : t.salud?.ollama.error ?? "Sin conexión con el backend"}
          data-tip-pos="left"
        >
          <span className={`live ${ok ? "live--ok" : "live--off"}`} aria-hidden />
          <span className="max-md:hidden">{ok ? "en línea" : t.salud ? "Ollama no responde" : t.saludError ? "sin backend" : "conectando"}</span>
        </span>
      </div>
    </header>
  );
}

/** Barra de estado: conexión, modelo y la telemetría de la sesión, en vivo y en modo texto. */
export function BarraEstado({ onAtajos }: { onAtajos: () => void }) {
  const t = useTelemetria();
  const enMovimiento = useMovimiento();
  const ok = !t.saludError && !!t.salud?.ollama.ok;
  const velocidades = t.historial.map((c) => c.tokS).filter((v): v is number => v !== null);
  const ultima = t.historial[t.historial.length - 1];
  const media = velocidades.length ? velocidades.reduce((a, b) => a + b, 0) / velocidades.length : null;
  const maxima = velocidades.length ? Math.max(...velocidades, 1) : 100;
  const activa = t.activas[t.activas.length - 1];

  return (
    <footer
      className="enter relative z-20 flex min-h-[var(--bar-bottom)] flex-wrap items-center gap-x-4 gap-y-1 border-t border-line bg-[var(--bg)] px-4 py-1 text-label text-muted"
      style={{ ["--delay" as string]: "160ms" }}
    >
      <span className="dot flex items-center gap-2">
        <span className={`live ${ok ? "live--ok live--idle" : "live--off"}`} aria-hidden />
        {ok ? `ollama ${t.salud?.ollama.version ?? ""}` : "ollama sin conexión"}
        {t.latenciaMs !== null && <span className="num">· {t.latenciaMs} ms</span>}
      </span>

      {t.ultimoModelo && (
        <span className="dot hidden md:inline" data-tip="El último modelo que se usó: probablemente sigue cargado en la GPU" data-tip-pos="top">
          gpu · {t.ultimoModelo}
        </span>
      )}

      <span className="ml-auto flex flex-wrap items-center gap-3" aria-live="polite">
        {activa ? (
          <span className="flex items-center gap-2 text-ink">
            <Giro className="text-accent" />
            <span className="dot">{activa.modelo}</span>
            <BarraTexto valor={(activa.tokS ?? 0) / Math.max(maxima, activa.tokS ?? 0, 1)} largo={12} tono="accent" />
            <span className="num text-accent">{activa.tokS !== null ? `${num(activa.tokS, 0)} tok/s` : "cargando"}</span>
            <span className="num">{entero(activa.tokens)} tokens</span>
            {t.activas.length > 1 && <span className="num">+{t.activas.length - 1}</span>}
          </span>
        ) : ultima ? (
          <span className="dot flex items-center gap-2">
            <span>última</span>
            <span className="num text-ink-2">{num(ultima.tokS, 1)} tok/s</span>
            <span className="num">ttft {segundos(ultima.ttft)}</span>
          </span>
        ) : (
          <span className="dot">sin generaciones todavía</span>
        )}
        {velocidades.length > 1 && (
          <span className="hidden lg:inline" data-tip={`Velocidad de las últimas ${velocidades.length} respuestas · media ${num(media, 1)} tok/s`} data-tip-pos="top">
            <SparkTexto valores={velocidades.slice(-20)} className="text-ink-2" />
          </span>
        )}
        <span className="num hidden lg:inline">{entero(t.tokensSesion)} tokens en la sesión</span>
        <button
          type="button"
          onClick={movimiento.alternar}
          aria-pressed={!enMovimiento}
          className="dot flex min-h-6 items-center gap-1.5 px-1 transition-colors hover:text-ink"
          data-tip={enMovimiento ? "Pausar todas las animaciones" : "Reanudar las animaciones"}
          data-tip-pos="top"
        >
          {enMovimiento ? <Pause className="h-3.5 w-3.5" aria-hidden /> : <Play className="h-3.5 w-3.5" aria-hidden />}
          {enMovimiento ? "pausar animaciones" : "animaciones en pausa"}
        </button>
        <button type="button" onClick={onAtajos} className="dot flex min-h-6 items-center gap-1.5 px-1 transition-colors hover:text-ink">
          <Command className="h-3.5 w-3.5" aria-hidden />
          atajos
          <kbd className="kbd">?</kbd>
        </button>
      </span>
    </footer>
  );
}

/** Paleta de comandos (Ctrl+K). Sin animación de apertura: se usa todo el tiempo. */
export function PaletaComandos({ onCerrar }: { onCerrar: () => void }) {
  const comandos = useListaComandos();
  const [consulta, setConsulta] = useState("");
  const [activo, setActivo] = useState(0);
  const entrada = useRef<HTMLInputElement>(null);
  const lista = useRef<HTMLDivElement>(null);

  const filtrados = useMemo(() => {
    const palabras = consulta
      .toLowerCase()
      .normalize("NFD")
      .replace(/\p{M}/gu, "")
      .split(/\s+/)
      .filter(Boolean);
    const texto = (c: Comando) =>
      `${c.titulo} ${c.grupo} ${c.claves ?? ""}`.toLowerCase().normalize("NFD").replace(/\p{M}/gu, "");
    return comandos.filter((c) => palabras.every((p) => texto(c).includes(p)));
  }, [comandos, consulta]);

  useEffect(() => entrada.current?.focus(), []);
  useEffect(() => setActivo(0), [consulta]);
  useEffect(() => {
    lista.current?.querySelector(`[data-i="${activo}"]`)?.scrollIntoView({ block: "nearest" });
  }, [activo]);

  const ejecutar = (c: Comando | undefined) => {
    if (!c) return;
    onCerrar();
    c.ejecutar();
  };

  const grupos: { grupo: string; items: { c: Comando; i: number }[] }[] = [];
  filtrados.forEach((c, i) => {
    const g = grupos.find((x) => x.grupo === c.grupo);
    if (g) g.items.push({ c, i });
    else grupos.push({ grupo: c.grupo, items: [{ c, i }] });
  });

  return (
    <div className="overlay" onPointerDown={(e) => e.target === e.currentTarget && onCerrar()}>
      <div className="sheet" role="dialog" aria-modal="true" aria-label="Paleta de comandos">
        <div className="flex items-center gap-3 border-b border-line px-4">
          <Search className="h-4 w-4 text-muted" aria-hidden />
          <input
            ref={entrada}
            value={consulta}
            onChange={(e) => setConsulta(e.target.value)}
            placeholder="Escribí un comando: comparar, ramas, nueva conversación…"
            aria-label="Buscar comandos"
            className="h-12 flex-1 bg-transparent text-body text-ink outline-none placeholder:text-muted"
            onKeyDown={(e) => {
              if (e.key === "ArrowDown") {
                e.preventDefault();
                setActivo((a) => Math.min(filtrados.length - 1, a + 1));
              } else if (e.key === "ArrowUp") {
                e.preventDefault();
                setActivo((a) => Math.max(0, a - 1));
              } else if (e.key === "Enter") {
                e.preventDefault();
                ejecutar(filtrados[activo]);
              } else if (e.key === "Escape") {
                e.preventDefault();
                onCerrar();
              }
            }}
          />
          <kbd className="kbd">Esc</kbd>
        </div>
        <div ref={lista} className="max-h-[min(420px,60vh)] overflow-y-auto p-2" role="listbox" aria-label="Comandos">
          {filtrados.length === 0 && <p className="hint px-3 py-6 text-center">Ningún comando coincide con “{consulta}”.</p>}
          {grupos.map((g) => (
            <div key={g.grupo} className="mb-1">
              <div className="label px-3 pb-1 pt-2">{g.grupo}</div>
              {g.items.map(({ c, i }) => (
                <button
                  key={c.id}
                  type="button"
                  role="option"
                  aria-selected={i === activo}
                  data-i={i}
                  data-active={i === activo}
                  onPointerMove={() => setActivo(i)}
                  onClick={() => ejecutar(c)}
                  className="opt"
                >
                  <span className="flex-1 text-small">{c.titulo}</span>
                  {c.atajo && <Teclas teclas={c.atajo} />}
                </button>
              ))}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

const ATAJOS: { grupo: string; filas: [string[], string][] }[] = [
  {
    grupo: "En toda la app",
    filas: [
      [["Ctrl", "K"], "Abrir la paleta de comandos"],
      [["Alt", "1"], "Ir al Playground"],
      [["Alt", "2"], "Ir al Comparador"],
      [["Alt", "3"], "Ir a Evaluación"],
      [["Alt", "4"], "Ir al Chat"],
      [["/"], "Escribir en el prompt de la vista"],
      [["?"], "Ver esta lista"],
    ],
  },
  {
    grupo: "Mientras escribís",
    filas: [
      [["↵"], "Enviar"],
      [["Shift", "↵"], "Salto de línea"],
      [["Esc"], "Detener la generación"],
    ],
  },
  {
    grupo: "Inspector de tokens",
    filas: [
      [["←"], "Token anterior"],
      [["→"], "Token siguiente"],
      [["1", "…", "9"], "Forzar la alternativa número n (crea una rama)"],
      [["Esc"], "Soltar el token elegido"],
    ],
  },
];

export function HojaAtajos({ onCerrar }: { onCerrar: () => void }) {
  const cerrar = useRef<HTMLButtonElement>(null);
  useEffect(() => cerrar.current?.focus(), []);
  return (
    <div className="overlay" onPointerDown={(e) => e.target === e.currentTarget && onCerrar()}>
      <div
        className="sheet"
        role="dialog"
        aria-modal="true"
        aria-label="Atajos de teclado"
        onKeyDown={(e) => e.key === "Escape" && onCerrar()}
      >
        <div className="flex h-12 items-center justify-between border-b border-line px-4">
          <span className="panel-title">Atajos de teclado</span>
          <button ref={cerrar} type="button" onClick={onCerrar} className="btn btn--quiet btn--sm">
            Cerrar <kbd className="kbd">Esc</kbd>
          </button>
        </div>
        <div className="grid gap-6 p-5 sm:grid-cols-2">
          {ATAJOS.map((g) => (
            <section key={g.grupo} className={g.grupo === "Inspector de tokens" ? "sm:col-span-2" : ""}>
              <h3 className="label mb-2">{g.grupo}</h3>
              <ul className="space-y-1.5">
                {g.filas.map(([teclas, que]) => (
                  <li key={que} className="flex items-center justify-between gap-4 text-small text-ink-2">
                    <span>{que}</span>
                    <Teclas teclas={teclas} />
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
        <p className="hint border-t border-line px-5 py-3">
          Los atajos de vista usan Alt porque Chrome se reserva Ctrl + número para cambiar de pestaña.
        </p>
      </div>
    </div>
  );
}
