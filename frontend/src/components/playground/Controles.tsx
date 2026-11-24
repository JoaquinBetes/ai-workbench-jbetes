import { Info } from "lucide-react";
import { useState } from "react";
import type { ModelInfo } from "../../lib/api";
import { Deslizador, Interruptor, Seccion } from "../ui/Controles";
import Segmentado from "../ui/Segmentado";
import SelectorModelo from "../ui/SelectorModelo";

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

type IdPreset = "determinista" | "equilibrado" | "creativo";

const PRESETS: { id: IdPreset; nombre: string; ayuda: string; valores: Pick<Config, "temperature" | "top_p" | "top_k"> }[] = [
  { id: "determinista", nombre: "Determinista", ayuda: "Siempre elige el token más probable: misma pregunta, misma respuesta.", valores: { temperature: 0, top_p: 1, top_k: 1 } },
  { id: "equilibrado", nombre: "Equilibrado", ayuda: "Los valores típicos de un asistente: variado pero sensato.", valores: { temperature: 0.7, top_p: 0.9, top_k: 40 } },
  { id: "creativo", nombre: "Creativo", ayuda: "Más variedad y más riesgo: aparecen palabras poco probables.", valores: { temperature: 1.2, top_p: 0.95, top_k: 100 } },
];

const AYUDAS = {
  inicio: "Pasá el mouse por un parámetro para ver qué hace.",
  modelo: "El modelo que responde. La barra muestra cuánto de la VRAM útil de la GPU ocupa.",
  think: "Los modelos qwen3 pueden razonar antes de responder. El razonamiento se muestra aparte y no se colorea.",
  system: "Instrucciones que el modelo lee antes de cada mensaje. Cambian el tono y el formato de la respuesta.",
  temperature: "Divide los logits antes de sortear. Baja (< 0,5) afila la distribución; alta (> 1) la aplana y aparecen opciones raras.",
  top_p: "Solo sortea entre los tokens más probables hasta sumar esta probabilidad (nucleus sampling).",
  top_k: "Solo sortea entre los k tokens más probables. Con k = 1 siempre sale el primero.",
  seed: "Con la misma semilla y los mismos parámetros, el sorteo se repite y la respuesta sale igual.",
  top_logprobs: "Cuántas alternativas guarda el inspector por cada token (logprobs que devuelve Ollama).",
  max_tokens: "Corta la respuesta al llegar a este largo.",
};

export default function Controles({
  config,
  setConfig,
  modelos,
}: {
  config: Config;
  setConfig: (c: Config) => void;
  modelos: ModelInfo[];
}) {
  const [ayuda, setAyuda] = useState<keyof typeof AYUDAS>("inicio");
  const cambiar = <K extends keyof Config>(clave: K, valor: Config[K]) => setConfig({ ...config, [clave]: valor });
  const preset = PRESETS.find(
    (p) => p.valores.temperature === config.temperature && p.valores.top_p === config.top_p && p.valores.top_k === config.top_k,
  );

  return (
    <aside className="panel enter flex min-h-0 flex-col" style={{ ["--delay" as string]: "90ms" }} aria-label="Parámetros">
      <div className="panel-head">
        <span className="panel-title">Parámetros</span>
        <span className="panel-meta ml-auto">{preset ? preset.nombre.toLowerCase() : "a mano"}</span>
      </div>

      <div className="min-h-0 flex-1 divide-y divide-[var(--line)] overflow-y-auto">
        <Seccion titulo="Modelo">
          <div onPointerEnter={() => setAyuda("modelo")} onFocus={() => setAyuda("modelo")}>
            <SelectorModelo modelos={modelos} valor={config.modelo} onChange={(m) => cambiar("modelo", m)} />
          </div>
          <Interruptor valor={config.think} onChange={(v) => cambiar("think", v)} onAyuda={() => setAyuda("think")}>
            Razonar antes de responder
          </Interruptor>
        </Seccion>

        <Seccion titulo="Muestreo">
          <Segmentado
            etiqueta="Presets de sampling"
            sm
            block
            valor={(preset?.id ?? "") as IdPreset}
            onChange={(id) => {
              const p = PRESETS.find((x) => x.id === id)!;
              setConfig({ ...config, ...p.valores });
            }}
            opciones={PRESETS.map((p) => ({ valor: p.id, etiqueta: p.nombre, tip: p.ayuda }))}
          />
          <Deslizador etiqueta="Temperatura" valor={config.temperature} min={0} max={2} paso={0.05} decimales={2} onChange={(v) => cambiar("temperature", v)} onAyuda={() => setAyuda("temperature")} />
          <Deslizador etiqueta="Top-p" valor={config.top_p} min={0.05} max={1} paso={0.05} decimales={2} onChange={(v) => cambiar("top_p", v)} onAyuda={() => setAyuda("top_p")} />
          <Deslizador etiqueta="Top-k" valor={config.top_k} min={1} max={100} paso={1} onChange={(v) => cambiar("top_k", v)} onAyuda={() => setAyuda("top_k")} />
          <Interruptor
            valor={config.seedFija}
            onChange={(v) => cambiar("seedFija", v)}
            onAyuda={() => setAyuda("seed")}
            detalle={
              config.seedFija && (
                <input
                  type="number"
                  aria-label="Semilla"
                  value={config.seed}
                  onChange={(e) => cambiar("seed", Number(e.target.value))}
                  className="field field--mono h-7 min-h-0 w-20 py-0 text-right"
                />
              )
            }
          >
            Semilla fija
          </Interruptor>
        </Seccion>

        <Seccion titulo="Salida">
          <Deslizador etiqueta="Alternativas por token" valor={config.top_logprobs} min={1} max={20} paso={1} onChange={(v) => cambiar("top_logprobs", v)} onAyuda={() => setAyuda("top_logprobs")} />
          <Deslizador etiqueta="Máximo de tokens" valor={config.max_tokens} min={16} max={2048} paso={16} onChange={(v) => cambiar("max_tokens", v)} onAyuda={() => setAyuda("max_tokens")} />
        </Seccion>

        <Seccion titulo="System prompt" para="system-prompt">
          <textarea
            id="system-prompt"
            value={config.system}
            onChange={(e) => cambiar("system", e.target.value)}
            onFocus={() => setAyuda("system")}
            onPointerEnter={() => setAyuda("system")}
            rows={3}
            placeholder="Sos un asistente que responde en una sola oración."
            className="field text-label"
          />
        </Seccion>
      </div>

      <div className="flex min-h-[76px] gap-2.5 border-t border-line px-4 py-3" aria-live="polite">
        <Info className="mt-0.5 h-3.5 w-3.5 flex-none text-accent" aria-hidden />
        <p key={ayuda} className="hint fade-in">
          {AYUDAS[ayuda]}
        </p>
      </div>
    </aside>
  );
}
