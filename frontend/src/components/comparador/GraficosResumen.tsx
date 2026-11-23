import { Bar, BarChart, LabelList, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

export type FilaResumen = {
  modelo: string;
  tokS: number | null;
  carga: number | null;
  perplejidad: number | null;
  confianza: number | null;
};

const GRAFICOS: { clave: keyof Omit<FilaResumen, "modelo">; titulo: string; ayuda: string; formato: (v: number) => string }[] = [
  { clave: "tokS", titulo: "Velocidad", ayuda: "Tokens por segundo. Más alto = más rápido.", formato: (v) => `${v.toFixed(0)}` },
  { clave: "carga", titulo: "Carga del modelo", ayuda: "Segundos en subir el modelo a la GPU.", formato: (v) => `${v.toFixed(1)}s` },
  { clave: "confianza", titulo: "Confianza media", ayuda: "Probabilidad promedio de los tokens elegidos.", formato: (v) => `${(v * 100).toFixed(0)}%` },
  { clave: "perplejidad", titulo: "Perplejidad", ayuda: "Más bajo = el modelo dudó menos.", formato: (v) => v.toFixed(2) },
];

/** Cuatro mini gráficos de barras para comparar los modelos de un vistazo. */
export default function GraficosResumen({ filas }: { filas: FilaResumen[] }) {
  const corto = (m: string) => m.replace(/^qwen3:/, "");
  return (
    <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
      {GRAFICOS.map((g) => {
        const datos = filas
          .filter((f) => f[g.clave] !== null)
          .map((f) => ({ modelo: corto(f.modelo), valor: f[g.clave] as number }));
        return (
          <div key={g.clave} className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-3" title={g.ayuda}>
            <div className="mb-1 text-xs font-medium text-zinc-300">{g.titulo}</div>
            <div className="mb-2 text-[11px] text-zinc-500">{g.ayuda}</div>
            <div className="h-32">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={datos} margin={{ top: 16, right: 4, bottom: 0, left: 4 }}>
                  <XAxis dataKey="modelo" tick={{ fill: "#a1a1aa", fontSize: 11 }} axisLine={false} tickLine={false} />
                  <YAxis hide />
                  <Tooltip
                    cursor={{ fill: "rgba(255,255,255,0.04)" }}
                    contentStyle={{ background: "#18181b", border: "1px solid #3f3f46", fontSize: 12 }}
                    formatter={(v) => [g.formato(Number(v)), g.titulo]}
                  />
                  <Bar dataKey="valor" fill="#818cf8" radius={[4, 4, 0, 0]} maxBarSize={36} isAnimationActive={false}>
                    <LabelList
                      dataKey="valor"
                      position="top"
                      formatter={(v) => g.formato(Number(v))}
                      style={{ fill: "#d4d4d8", fontSize: 11 }}
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
