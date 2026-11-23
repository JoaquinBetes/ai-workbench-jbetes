import { Bar, BarChart, Cell, LabelList, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { TokenLogprob } from "../../lib/api";
import { alternativas, entropia, mostrarToken, pct, prob } from "../../lib/probs";

const CONTEXTO = 8; // tokens previos que se muestran para ubicar el token

export default function InspectorToken({
  tokens,
  indice,
  onMover,
}: {
  tokens: TokenLogprob[] | null;
  indice: number | null;
  onMover: (i: number) => void;
}) {
  if (!tokens || indice === null || !tokens[indice]) {
    return (
      <aside className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-4 text-sm text-zinc-500">
        <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-zinc-400">Inspector de tokens</h3>
        Hacé clic en cualquier token de una respuesta para ver qué otras opciones consideró el modelo en ese paso.
      </aside>
    );
  }

  const t = tokens[indice];
  const p = prob(t.logprob);
  const datos = alternativas(t).map((a) => ({ ...a, etiqueta: mostrarToken(a.token), porcentaje: +(a.p * 100).toFixed(2) }));
  const sumaTop = datos.reduce((s, a) => s + a.p, 0);
  const previos = tokens.slice(Math.max(0, indice - CONTEXTO), indice).map((x) => x.token).join("");

  return (
    <aside className="space-y-4 overflow-y-auto rounded-xl border border-zinc-800 bg-zinc-900/50 p-4 text-sm">
      <div className="flex items-center justify-between">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-zinc-400">Inspector de tokens</h3>
        <div className="flex items-center gap-1 text-xs text-zinc-400">
          <button
            onClick={() => onMover(Math.max(0, indice - 1))}
            className="rounded border border-zinc-700 px-2 hover:bg-zinc-800"
            aria-label="Token anterior"
          >
            ←
          </button>
          <span className="font-mono">
            {indice + 1}/{tokens.length}
          </span>
          <button
            onClick={() => onMover(Math.min(tokens.length - 1, indice + 1))}
            className="rounded border border-zinc-700 px-2 hover:bg-zinc-800"
            aria-label="Token siguiente"
          >
            →
          </button>
        </div>
      </div>

      <div className="rounded-lg bg-zinc-950/60 p-3 font-mono text-xs leading-relaxed text-zinc-400">
        <span className="text-zinc-500">…</span>
        {previos}
        <span className="rounded bg-indigo-500/30 px-0.5 text-indigo-200">{t.token}</span>
      </div>

      <div className="grid grid-cols-3 gap-2 text-center">
        <div className="rounded-lg bg-zinc-800/60 p-2">
          <div className="text-[11px] text-zinc-400">Probabilidad</div>
          <div className="text-lg font-semibold">{pct(p)}</div>
        </div>
        <div className="rounded-lg bg-zinc-800/60 p-2">
          <div className="text-[11px] text-zinc-400">Logprob</div>
          <div className="text-lg font-semibold">{t.logprob.toFixed(2)}</div>
        </div>
        <div className="rounded-lg bg-zinc-800/60 p-2" title="Entropía estimada con las alternativas mostradas">
          <div className="text-[11px] text-zinc-400">Entropía</div>
          <div className="text-lg font-semibold">{entropia(t).toFixed(2)} bits</div>
        </div>
      </div>

      <div>
        <h4 className="mb-1 text-xs text-zinc-400">Alternativas en este paso</h4>
        <div style={{ height: Math.max(120, datos.length * 26 + 20) }}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={datos} layout="vertical" margin={{ top: 0, right: 48, bottom: 0, left: 0 }}>
              <XAxis type="number" domain={[0, 100]} hide />
              <YAxis
                type="category"
                dataKey="etiqueta"
                width={96}
                tick={{ fill: "#d4d4d8", fontSize: 12, fontFamily: "ui-monospace, monospace" }}
                axisLine={false}
                tickLine={false}
              />
              <Tooltip
                cursor={{ fill: "rgba(255,255,255,0.04)" }}
                contentStyle={{ background: "#18181b", border: "1px solid #3f3f46", fontSize: 12 }}
                formatter={(v) => [`${v}%`, "Probabilidad"]}
              />
              <Bar dataKey="porcentaje" radius={[0, 4, 4, 0]} isAnimationActive={false}>
                {datos.map((d) => (
                  <Cell key={d.token} fill={d.elegido ? "#818cf8" : "#52525b"} />
                ))}
                <LabelList
                  dataKey="porcentaje"
                  position="right"
                  formatter={(v) => `${v}%`}
                  style={{ fill: "#a1a1aa", fontSize: 11 }}
                />
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
        <p className="mt-2 text-[11px] leading-snug text-zinc-500">
          En violeta, el token que salió. Estas {datos.length} opciones suman {pct(sumaTop)}; el resto se reparte entre
          los ~150.000 tokens del vocabulario.
        </p>
      </div>
    </aside>
  );
}
