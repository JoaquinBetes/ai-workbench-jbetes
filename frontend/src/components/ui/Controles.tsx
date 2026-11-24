import { useId, type ReactNode } from "react";
import { num } from "../../lib/formato";

/** Interruptor accesible (role="switch") con su etiqueta. */
export function Interruptor({
  valor,
  onChange,
  children,
  detalle,
  onAyuda,
}: {
  valor: boolean;
  onChange: (v: boolean) => void;
  children: ReactNode;
  detalle?: ReactNode;
  onAyuda?: () => void;
}) {
  const id = useId();
  return (
    <div className="flex items-center gap-3" onPointerEnter={onAyuda} onFocus={onAyuda}>
      <button
        id={id}
        type="button"
        role="switch"
        aria-checked={valor}
        aria-labelledby={`${id}-l`}
        className="switch"
        onClick={() => onChange(!valor)}
      />
      <label id={`${id}-l`} htmlFor={id} className="flex-1 cursor-pointer select-none text-label text-ink-2">
        {children}
      </label>
      {detalle}
    </div>
  );
}

/** Deslizador con etiqueta y valor en mono. La pista se llena en lima hasta el valor. */
export function Deslizador({
  etiqueta,
  valor,
  min,
  max,
  paso,
  onChange,
  decimales,
  onAyuda,
  sufijo = "",
}: {
  etiqueta: string;
  valor: number;
  min: number;
  max: number;
  paso: number;
  onChange: (v: number) => void;
  decimales?: number;
  onAyuda?: () => void;
  sufijo?: string;
}) {
  const id = useId();
  const pct = ((valor - min) / (max - min)) * 100;
  const dec = decimales ?? (paso < 1 ? (paso < 0.1 ? 2 : 1) : 0);
  return (
    <div className="space-y-1.5" onPointerEnter={onAyuda} onFocus={onAyuda}>
      <div className="flex items-baseline justify-between gap-2">
        <label htmlFor={id} className="text-label text-ink-2">
          {etiqueta}
        </label>
        <output htmlFor={id} className="num text-label text-ink">
          {num(valor, dec)}
          {sufijo}
        </output>
      </div>
      <input
        id={id}
        type="range"
        className="range"
        min={min}
        max={max}
        step={paso}
        value={valor}
        style={{ ["--pct" as string]: `${pct}%` }}
        onChange={(e) => onChange(Number(e.target.value))}
      />
    </div>
  );
}

/** Encabezado de una sección dentro de un panel. */
export function Seccion({ titulo, extra, children, para }: { titulo: string; extra?: ReactNode; children: ReactNode; para?: string }) {
  return (
    <section className="space-y-3 px-4 py-4">
      <div className="flex items-center justify-between gap-2">
        {para ? (
          <label htmlFor={para} className="panel-title">
            {titulo}
          </label>
        ) : (
          <h2 className="panel-title">{titulo}</h2>
        )}
        {extra}
      </div>
      {children}
    </section>
  );
}

/** Teclas de un atajo: ["Alt", "1"] → [Alt] [1]. */
export function Teclas({ teclas }: { teclas: string[] }) {
  return (
    <span className="inline-flex items-center gap-1">
      {teclas.map((t) => (
        <kbd key={t} className="kbd">
          {t}
        </kbd>
      ))}
    </span>
  );
}

/** Lectura de instrumento: etiqueta chica arriba, número grande en mono. */
export function Lectura({
  etiqueta,
  valor,
  unidad,
  detalle,
  tono = "ink",
  tip,
  onClick,
}: {
  etiqueta: string;
  valor: ReactNode;
  unidad?: string;
  detalle?: ReactNode;
  tono?: "ink" | "accent" | "doubt";
  tip?: string;
  onClick?: () => void;
}) {
  const color = tono === "accent" ? "text-accent" : tono === "doubt" ? "text-doubt" : "text-ink";
  const Comp = onClick ? "button" : "div";
  return (
    <Comp
      onClick={onClick}
      data-tip={tip}
      className={`min-w-0 px-4 py-3 text-left ${onClick ? "transition-colors hover:bg-raised" : ""}`}
    >
      <div className="label truncate">{etiqueta}</div>
      <div className={`lectura mt-1 truncate text-[24px] leading-none ${color}`}>
        {valor}
        {unidad && <span className="ml-1 text-label text-muted">{unidad}</span>}
      </div>
      {detalle && <div className="hint mt-1.5 truncate">{detalle}</div>}
    </Comp>
  );
}

/** Mini gráfico de línea (SVG), para tendencias chicas: velocidad de la sesión, etc. */
export function Sparkline({
  valores,
  ancho = 96,
  alto = 18,
  color = "var(--accent)",
}: {
  valores: number[];
  ancho?: number;
  alto?: number;
  color?: string;
}) {
  if (valores.length < 2) return <svg width={ancho} height={alto} aria-hidden />;
  const max = Math.max(...valores);
  const min = Math.min(...valores);
  const rango = max - min || 1;
  const pts = valores.map((v, i) => [
    (i / (valores.length - 1)) * (ancho - 4) + 2,
    alto - 3 - ((v - min) / rango) * (alto - 6),
  ]);
  const linea = pts.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(" ");
  const ultimo = pts[pts.length - 1];
  return (
    <svg width={ancho} height={alto} aria-hidden className="overflow-visible">
      <polygon points={`2,${alto} ${linea} ${ultimo[0]},${alto}`} fill={color} opacity={0.1} />
      <polyline points={linea} fill="none" stroke={color} strokeWidth={1.5} strokeLinejoin="round" strokeLinecap="round" />
      <circle cx={ultimo[0]} cy={ultimo[1]} r={2.5} fill={color} stroke="var(--bg)" strokeWidth={1.5} />
    </svg>
  );
}
