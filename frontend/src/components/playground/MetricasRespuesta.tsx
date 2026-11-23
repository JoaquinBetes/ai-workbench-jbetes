import type { Stats, TokenLogprob } from "../../lib/api";
import { num, segundos } from "../../lib/formato";
import { metricas, mostrarToken, pct, prob } from "../../lib/probs";

function Celda({
  etiqueta,
  valor,
  tip,
  tono,
  onClick,
}: {
  etiqueta: string;
  valor: string;
  tip: string;
  tono?: "doubt";
  onClick?: () => void;
}) {
  const Comp = onClick ? "button" : "div";
  return (
    <Comp
      onClick={onClick}
      data-tip={tip}
      data-tip-pos="top"
      className={`min-w-0 border-l border-t border-line px-3 py-2 text-left [&:nth-child(3n+1)]:border-l-0 [&:nth-child(-n+3)]:border-t-0 @4xl:border-t-0 @4xl:[&:nth-child(3n+1)]:border-l @4xl:first:border-l-0 ${
        onClick ? "transition-colors hover:bg-raised" : ""
      }`}
    >
      <div className="label truncate">{etiqueta}</div>
      <div className={`num mt-0.5 truncate text-small ${tono === "doubt" ? "text-doubt" : "text-ink"}`}>{valor}</div>
    </Comp>
  );
}

/** Fila de lecturas debajo de cada respuesta: rendimiento y certeza. */
export default function MetricasRespuesta({
  tokens,
  stats,
  onSeleccionar,
  desde = 0,
}: {
  tokens: TokenLogprob[];
  stats?: Stats;
  onSeleccionar: (i: number) => void;
  /** En una rama, las métricas se calculan solo sobre lo que generó el modelo (después del token forzado). */
  desde?: number;
}) {
  const propios = tokens.slice(desde);
  const m = metricas(propios);
  if (!m) return null;
  const dudoso = propios[m.indiceMasDudoso];

  return (
    <div className="well grid grid-cols-3 overflow-hidden @4xl:grid-cols-[repeat(5,minmax(0,1fr))_minmax(0,1.5fr)]">
      <Celda etiqueta={desde > 0 ? "Tokens nuevos" : "Tokens"} valor={String(m.tokens)} tip="Cantidad de tokens generados" />
      <Celda
        etiqueta="Velocidad"
        valor={stats?.tokens_per_second ? `${num(stats.tokens_per_second, 1)} tok/s` : "—"}
        tip="Tokens por segundo en la fase de decode"
      />
      <Celda
        etiqueta="Primer token"
        valor={segundos(stats?.time_to_first_token_s)}
        tip="Carga del modelo + lectura del prompt (prefill)"
      />
      <Celda etiqueta="Confianza" valor={pct(m.confianzaPromedio)} tip="Probabilidad promedio de cada token elegido" />
      <Celda
        etiqueta="Perplejidad"
        valor={num(m.perplejidad, 2)}
        tip="exp(−promedio de logprobs): entre cuántas opciones dudó, en promedio. 1 = ninguna duda"
      />
      <Celda
        etiqueta="Más dudoso"
        valor={`${mostrarToken(dudoso.token)}  ${pct(prob(dudoso.logprob), 0)}`}
        tip="El token elegido con menor probabilidad. Clic para inspeccionarlo"
        tono="doubt"
        onClick={() => onSeleccionar(desde + m.indiceMasDudoso)}
      />
    </div>
  );
}
