import type { ModelInfo } from "../../lib/api";

export type Config = {
  modelo: string;
  system: string;
  temperature: number;
  top_p: number;
  top_k: number;
  seedFija: boolean;
  seed: number;
  think: boolean;
  top_logprobs: number;
  max_tokens: number;
};

export const CONFIG_INICIAL: Config = {
  modelo: "",
  system: "",
  temperature: 0.7,
  top_p: 0.9,
  top_k: 40,
  seedFija: false,
  seed: 42,
  think: false,
  top_logprobs: 10,
  max_tokens: 512,
};

const PRESETS: { nombre: string; ayuda: string; valores: Partial<Config> }[] = [
  { nombre: "Determinista", ayuda: "Siempre elige el token más probable", valores: { temperature: 0, top_p: 1, top_k: 1 } },
  { nombre: "Equilibrado", ayuda: "Valores típicos de un asistente", valores: { temperature: 0.7, top_p: 0.9, top_k: 40 } },
  { nombre: "Creativo", ayuda: "Más variedad, más riesgo", valores: { temperature: 1.2, top_p: 0.95, top_k: 100 } },
];

function Deslizador(props: {
  etiqueta: string;
  ayuda: string;
  valor: number;
  min: number;
  max: number;
  paso: number;
  onChange: (v: number) => void;
}) {
  return (
    <label className="block space-y-1" title={props.ayuda}>
      <div className="flex justify-between text-xs">
        <span className="text-zinc-300">{props.etiqueta}</span>
        <span className="font-mono text-zinc-400">{props.valor}</span>
      </div>
      <input
        type="range"
        min={props.min}
        max={props.max}
        step={props.paso}
        value={props.valor}
        onChange={(e) => props.onChange(Number(e.target.value))}
        className="w-full accent-indigo-500"
      />
      <p className="text-[11px] leading-snug text-zinc-500">{props.ayuda}</p>
    </label>
  );
}

export default function Controles({
  config,
  setConfig,
  modelos,
}: {
  config: Config;
  setConfig: (c: Config) => void;
  modelos: ModelInfo[];
}) {
  const cambiar = <K extends keyof Config>(clave: K, valor: Config[K]) => setConfig({ ...config, [clave]: valor });

  return (
    <aside className="space-y-5 overflow-y-auto rounded-xl border border-zinc-800 bg-zinc-900/50 p-4 text-sm">
      <section className="space-y-2">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-zinc-400">Modelo</h3>
        <select
          value={config.modelo}
          onChange={(e) => cambiar("modelo", e.target.value)}
          className="w-full rounded-md border border-zinc-700 bg-zinc-900 px-2 py-1.5"
        >
          {modelos.map((m) => (
            <option key={m.name} value={m.name}>
              {m.name} · {m.parameters}
            </option>
          ))}
        </select>
        <label className="flex cursor-pointer items-center gap-2 text-zinc-300">
          <input type="checkbox" checked={config.think} onChange={(e) => cambiar("think", e.target.checked)} />
          Modo pensar (think)
        </label>
      </section>

      <section className="space-y-2">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-zinc-400">System prompt</h3>
        <textarea
          value={config.system}
          onChange={(e) => cambiar("system", e.target.value)}
          rows={3}
          placeholder="Sos un asistente que responde en una sola oración."
          className="w-full resize-y rounded-md border border-zinc-700 bg-zinc-900 px-2 py-1.5 text-xs"
        />
      </section>

      <section className="space-y-3">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-zinc-400">Sampling</h3>
        <div className="flex gap-1">
          {PRESETS.map((p) => (
            <button
              key={p.nombre}
              title={p.ayuda}
              onClick={() => setConfig({ ...config, ...p.valores })}
              className="flex-1 rounded-md border border-zinc-700 px-2 py-1 text-xs text-zinc-300 hover:bg-zinc-800"
            >
              {p.nombre}
            </button>
          ))}
        </div>
        <Deslizador
          etiqueta="Temperatura"
          ayuda="Aplana (alta) o afila (baja) la distribución antes de elegir."
          valor={config.temperature}
          min={0}
          max={2}
          paso={0.05}
          onChange={(v) => cambiar("temperature", v)}
        />
        <Deslizador
          etiqueta="Top-p"
          ayuda="Solo considera los tokens más probables hasta sumar esta probabilidad."
          valor={config.top_p}
          min={0.05}
          max={1}
          paso={0.05}
          onChange={(v) => cambiar("top_p", v)}
        />
        <Deslizador
          etiqueta="Top-k"
          ayuda="Solo considera los k tokens más probables."
          valor={config.top_k}
          min={1}
          max={100}
          paso={1}
          onChange={(v) => cambiar("top_k", v)}
        />
        <div className="space-y-1">
          <label className="flex cursor-pointer items-center gap-2 text-zinc-300">
            <input type="checkbox" checked={config.seedFija} onChange={(e) => cambiar("seedFija", e.target.checked)} />
            Semilla fija
          </label>
          {config.seedFija && (
            <input
              type="number"
              value={config.seed}
              onChange={(e) => cambiar("seed", Number(e.target.value))}
              className="w-full rounded-md border border-zinc-700 bg-zinc-900 px-2 py-1 font-mono text-xs"
            />
          )}
          <p className="text-[11px] leading-snug text-zinc-500">
            Con la misma semilla y parámetros, la respuesta se repite.
          </p>
        </div>
      </section>

      <section className="space-y-3">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-zinc-400">Salida</h3>
        <Deslizador
          etiqueta="Alternativas por token"
          ayuda="Cuántas opciones guarda el inspector por cada token (logprobs)."
          valor={config.top_logprobs}
          min={1}
          max={20}
          paso={1}
          onChange={(v) => cambiar("top_logprobs", v)}
        />
        <Deslizador
          etiqueta="Máximo de tokens"
          ayuda="Corta la respuesta al llegar a este largo."
          valor={config.max_tokens}
          min={16}
          max={2048}
          paso={16}
          onChange={(v) => cambiar("max_tokens", v)}
        />
      </section>
    </aside>
  );
}
