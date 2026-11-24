import { CartesianGrid, ResponsiveContainer, Scatter, ScatterChart, Tooltip, XAxis, YAxis, ZAxis } from "recharts";
import { num } from "../../lib/formato";
import { TINTA } from "../../lib/tintas";
import { SERIES, SERIES_HEX } from "../comparador/comun";
import { EJE, GRILLA } from "../ui/Vista";
import type { CasoTabla, Serie } from "./comun";

type Punto = { x: number; y: number; orden: number; respuesta: string; modelo: string };

const recortar = (t: string, n = 60) => (t.length > n ? `${t.slice(0, n - 1)}…` : t);

function Tip({ active, payload, casos }: { active?: boolean; payload?: { payload: Punto }[]; casos: CasoTabla[] }) {
  if (!active || !payload?.length) return null;
  const p = payload[0].payload;
  return (
    <div className="viz-tip max-w-[300px]">
      <div className="mb-1 opacity-70">
        {p.modelo} · caso {p.orden + 1}
      </div>
      <div>referencia: {recortar(casos.find((c) => c.orden === p.orden)?.referencia ?? "")}</div>
      <div>respuesta: {recortar(p.respuesta)}</div>
      <div className="num mt-1">
        ROUGE-L {num(p.x * 100, 0)} · semántica {num(p.y * 100, 0)}
      </div>
    </div>
  );
}

/**
 * Cada respuesta como un punto: cuántas palabras comparte con la referencia
 * (ROUGE-L, horizontal) contra cuánto se parece su significado (semántica,
 * vertical). Arriba a la izquierda quedan las respuestas que dicen lo mismo
 * con otras palabras: ahí es donde las métricas léxicas se equivocan.
 */
export default function Dispersion({ series, casos }: { series: Serie[]; casos: CasoTabla[] }) {
  const datos = series.map((s) => ({
    serie: s,
    puntos: Object.values(s.resultados)
      .filter((r) => r.semantica !== null)
      .map((r) => ({ x: r.rouge_l, y: r.semantica!, orden: r.orden, respuesta: r.respuesta, modelo: s.modelo })),
  }));
  // La similitud coseno de textos cortos casi nunca baja de 0,3: el eje vertical
  // empieza en el cuarto de punto anterior al menor valor, no en 0.
  const minY = Math.min(1, ...datos.flatMap((d) => d.puntos.map((p) => p.y)));
  const pisoY = Math.min(0.75, Math.floor(minY * 4) / 4);
  const marcasY = Array.from({ length: Math.round((1 - pisoY) * 4) + 1 }, (_, i) => pisoY + i * 0.25);

  return (
    <div className="flex h-full flex-col p-4">
      <ul className="mb-2 flex flex-wrap gap-x-4 gap-y-1 text-label text-ink-2" aria-label="Modelos">
        {series.map((s) => (
          <li key={s.corrida_id} className="flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full" style={{ background: SERIES[s.slot] }} aria-hidden />
            <span className="mono">{s.modelo}</span>
          </li>
        ))}
      </ul>
      <div className="relative min-h-[280px] flex-1">
        <ResponsiveContainer width="100%" height="100%">
          <ScatterChart margin={{ top: 10, right: 16, bottom: 18, left: -6 }}>
            <CartesianGrid {...GRILLA} vertical />
            <XAxis
              type="number"
              dataKey="x"
              domain={[0, 1]}
              ticks={[0, 0.25, 0.5, 0.75, 1]}
              tickFormatter={(v) => num(v * 100, 0)}
              {...EJE}
              label={{ value: "ROUGE-L: palabras en común", position: "insideBottom", offset: -12, fill: TINTA.apagada, fontSize: 12 }}
            />
            <YAxis
              type="number"
              dataKey="y"
              domain={[pisoY, 1]}
              ticks={marcasY}
              allowDataOverflow
              tickFormatter={(v) => num(v * 100, 0)}
              {...EJE}
              label={{ value: "semántica", angle: -90, position: "insideLeft", offset: 18, fill: TINTA.apagada, fontSize: 12 }}
            />
            <ZAxis range={[70, 70]} />
            <Tooltip content={<Tip casos={casos} />} cursor={{ stroke: TINTA.pista, strokeDasharray: "2 3" }} isAnimationActive={false} />
            {datos.map(({ serie, puntos }) => (
              <Scatter
                key={serie.corrida_id}
                name={serie.modelo}
                data={puntos}
                fill={SERIES_HEX[serie.slot]}
                stroke={TINTA.panel}
                strokeWidth={2}
                isAnimationActive={false}
              />
            ))}
          </ScatterChart>
        </ResponsiveContainer>
        {/* Las dos esquinas que importan, nombradas. */}
        <span className="eje3d absolute left-12 top-3">↖ mismo sentido, otras palabras</span>
        <span className="eje3d absolute bottom-12 right-6">mismas palabras, otro sentido ↘</span>
      </div>
    </div>
  );
}
