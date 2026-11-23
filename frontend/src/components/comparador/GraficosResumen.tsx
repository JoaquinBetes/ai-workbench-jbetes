import { Bar, BarChart, Cell, LabelList, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { nombreCorto, num } from "../../lib/formato";
import { EJE, TipGrafico } from "../ui/Vista";

export type FilaResumen = {
  modelo: string;
  color: string;
  tokS: number | null;
  carga: number | null;
  perplejidad: number | null;
  confianza: number | null;
};

const GRAFICOS: {
  clave: "tokS" | "carga" | "confianza" | "perplejidad";
  titulo: string;
  ayuda: string;
  mejor: "alto" | "bajo";
  formato: (v: number) => string;
}[] = [
  { clave: "tokS", titulo: "Velocidad", ayuda: "tokens por segundo", mejor: "alto", formato: (v) => num(v, 0) },
  { clave: "carga", titulo: "Carga en la GPU", ayuda: "segundos", mejor: "bajo", formato: (v) => `${num(v, 1)}s` },
  { clave: "confianza", titulo: "Confianza media", ayuda: "probabilidad promedio", mejor: "alto", formato: (v) => `${num(v * 100, 0)}%` },
  { clave: "perplejidad", titulo: "Perplejidad", ayuda: "más bajo, menos duda", mejor: "bajo", formato: (v) => num(v, 2) },
];

/**
 * Cuatro gráficos chicos (small multiples) para comparar los modelos de un vistazo.
 * Cada barra lleva el color de su modelo, el mismo que su columna.
 */
export default function GraficosResumen({ filas }: { filas: FilaResumen[] }) {
  return (
    <div className="panel rise-in grid grid-cols-2 xl:grid-cols-4">
      {GRAFICOS.map((g, i) => {
        const datos = filas
          .filter((f) => f[g.clave] !== null)
          .map((f) => ({ modelo: nombreCorto(f.modelo), valor: f[g.clave] as number, color: f.color }));
        return (
          <div key={g.clave} className={`p-4 ${i > 0 ? "border-l border-line" : ""} ${i === 2 ? "max-xl:border-l-0 max-xl:border-t" : ""} ${i === 3 ? "max-xl:border-t" : ""}`}>
            <div className="flex items-baseline justify-between gap-2">
              <span className="panel-title">{g.titulo}</span>
              <span className="label">{g.mejor === "alto" ? "↑" : "↓"} mejor</span>
            </div>
            <div className="hint">{g.ayuda}</div>
            <div className="mt-2 h-36">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={datos} margin={{ top: 22, right: 4, bottom: 0, left: 4 }}>
                  <XAxis dataKey="modelo" {...EJE} />
                  <YAxis hide />
                  <Tooltip
                    cursor={{ fill: "rgba(255,255,255,0.04)" }}
                    content={<TipGrafico formato={g.formato} nombres={{ valor: g.titulo }} />}
                  />
                  <Bar dataKey="valor" radius={[4, 4, 0, 0]} maxBarSize={24} isAnimationActive={false}>
                    {datos.map((d) => (
                      <Cell key={d.modelo} fill={d.color} />
                    ))}
                    <LabelList
                      dataKey="valor"
                      position="top"
                      formatter={(v) => g.formato(Number(v))}
                      style={{ fill: "var(--ink-2)", fontSize: 13, fontFamily: "var(--font-mono)" }}
                    />
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        );
      })}
    </div>
  );
}
