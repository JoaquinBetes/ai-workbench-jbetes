import type { Stats, TokenLogprob } from "../../lib/api";
import { metricas, mostrarToken, pct } from "../../lib/probs";

function Tarjeta({ titulo, valor, ayuda, onClick }: { titulo: string; valor: string; ayuda: string; onClick?: () => void }) {
  const Comp = onClick ? "button" : "div";
  return (
    <Comp
      onClick={onClick}
      title={ayuda}
      className={`rounded-lg bg-zinc-800/60 px-3 py-2 text-left ${onClick ? "hover:bg-zinc-700/60" : ""}`}
    >
      <div className="text-[11px] text-zinc-400">{titulo}</div>
      <div className="truncate font-semibold">{valor}</div>
    </Comp>
  );
}

export default function MetricasRespuesta({
  tokens,
  stats,
  onSeleccionar,
}: {
  tokens: TokenLogprob[];
  stats?: Stats;
  onSeleccionar: (i: number) => void;
}) {
  const m = metricas(tokens);
  if (!m) return null;
  const dudoso = tokens[m.indiceMasDudoso];

  return (
    <div className="mt-3 grid grid-cols-2 gap-2 border-t border-zinc-700 pt-3 text-sm sm:grid-cols-3 lg:grid-cols-6">
      <Tarjeta titulo="Tokens" valor={String(m.tokens)} ayuda="Cantidad de tokens generados" />
      <Tarjeta
        titulo="Velocidad"
        valor={stats?.tokens_per_second ? `${stats.tokens_per_second} tok/s` : "—"}
        ayuda="Tokens generados por segundo (fase de decode)"
      />
      <Tarjeta
        titulo="Primer token"
        valor={stats?.time_to_first_token_s != null ? `${stats.time_to_first_token_s} s` : "—"}
        ayuda="Carga del modelo + lectura del prompt (prefill)"
      />
      <Tarjeta
        titulo="Confianza media"
        valor={pct(m.confianzaPromedio)}
        ayuda="Promedio de la probabilidad de cada token elegido"
      />
      <Tarjeta
        titulo="Perplejidad"
        valor={m.perplejidad.toFixed(2)}
        ayuda="exp(-promedio de logprobs): entre cuántas opciones dudó el modelo, en promedio. 1 = ninguna duda."
      />
      <Tarjeta
        titulo="Más dudoso"
        valor={`${mostrarToken(dudoso.token)} · ${pct(Math.exp(dudoso.logprob))}`}
        ayuda="El token elegido con menor probabilidad. Clic para inspeccionarlo."
        onClick={() => onSeleccionar(m.indiceMasDudoso)}
      />
    </div>
  );
}
