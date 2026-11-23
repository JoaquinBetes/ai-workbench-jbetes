import { useEffect, useRef, useState } from "react";
import { type TokenLogprob } from "../lib/api";
import { colorProbabilidad, pct, prob } from "../lib/probs";
import { useModelos } from "../lib/useModelos";
import { useStreamingChat } from "../lib/useStreamingChat";

// Chat simple: tokens coloreados por probabilidad y alternativas al pasar el mouse.
function TextoConTokens({ tokens }: { tokens: TokenLogprob[] }) {
  return (
    <>
      {tokens.map((t, i) => {
        const p = prob(t.logprob);
        const alternativas = t.top.map((a) => `${JSON.stringify(a.token)}  ${pct(prob(a.logprob))}`).join("\n");
        return (
          <span
            key={i}
            title={`Elegido: ${JSON.stringify(t.token)} (${pct(p)})\n\nAlternativas:\n${alternativas}`}
            style={{ backgroundColor: colorProbabilidad(p) }}
            className="cursor-help rounded-sm"
          >
            {t.token}
          </span>
        );
      })}
    </>
  );
}

export default function Chat() {
  const { modelos, preferido, error: errorModelos } = useModelos();
  const [modelo, setModelo] = useState("");
  const [entrada, setEntrada] = useState("");
  const [colorear, setColorear] = useState(true);
  const { turnos, generando, error, enviar, detener, reiniciar } = useStreamingChat();
  const fin = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!modelo && preferido) setModelo(preferido);
  }, [preferido, modelo]);

  // Llaves a propósito: un efecto solo puede devolver una función de limpieza,
  // y en Chrome nuevo scrollIntoView devuelve una Promise.
  useEffect(() => {
    fin.current?.scrollIntoView({ behavior: "smooth" });
  }, [turnos]);

  function mandar() {
    enviar(entrada, modelo);
    setEntrada("");
  }

  return (
    <div className="mx-auto flex h-full max-w-4xl flex-col gap-4">
      <div className="flex flex-wrap items-center gap-4 text-sm">
        <label className="flex items-center gap-2">
          <span className="text-zinc-400">Modelo</span>
          <select
            value={modelo}
            onChange={(e) => setModelo(e.target.value)}
            className="rounded-md border border-zinc-700 bg-zinc-900 px-2 py-1"
          >
            {modelos.map((m) => (
              <option key={m.name} value={m.name}>
                {m.name} · {m.parameters} · {m.size_gb} GB
              </option>
            ))}
          </select>
        </label>
        <label className="flex cursor-pointer items-center gap-2 text-zinc-300">
          <input type="checkbox" checked={colorear} onChange={(e) => setColorear(e.target.checked)} />
          Colorear tokens por probabilidad
        </label>
        <button
          onClick={reiniciar}
          className="ml-auto rounded-md border border-zinc-700 px-3 py-1 text-zinc-300 hover:bg-zinc-800"
        >
          Nueva conversación
        </button>
      </div>

      <div className="flex-1 space-y-4 overflow-y-auto rounded-xl border border-zinc-800 bg-zinc-900/50 p-4">
        {turnos.length === 0 && (
          <p className="text-center text-sm text-zinc-500">
            Escribile algo al modelo. Pasá el mouse por un token para ver su probabilidad y las alternativas.
          </p>
        )}
        {turnos.map((t, i) => (
          <div key={i} className={t.role === "user" ? "flex justify-end" : ""}>
            <div
              className={`max-w-[85%] whitespace-pre-wrap rounded-xl px-4 py-2 leading-relaxed ${
                t.role === "user" ? "bg-indigo-600/80" : "bg-zinc-800"
              }`}
            >
              {t.role === "assistant" && colorear && t.tokens?.length ? (
                <TextoConTokens tokens={t.tokens} />
              ) : (
                t.content || (generando && i === turnos.length - 1 ? "…" : "")
              )}
              {t.stats && (
                <div className="mt-2 border-t border-zinc-700 pt-1 text-xs text-zinc-400">
                  {t.stats.output_tokens} tokens · {t.stats.tokens_per_second} tok/s · primer token en{" "}
                  {t.stats.time_to_first_token_s} s
                </div>
              )}
            </div>
          </div>
        ))}
        <div ref={fin} />
      </div>

      {(error || errorModelos) && <p className="text-sm text-rose-400">{error ?? errorModelos}</p>}

      <div className="flex gap-2">
        <textarea
          value={entrada}
          onChange={(e) => setEntrada(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              mandar();
            }
          }}
          rows={2}
          placeholder="Escribí tu mensaje (Enter para enviar, Shift+Enter para salto de línea)"
          className="flex-1 resize-none rounded-xl border border-zinc-700 bg-zinc-900 px-4 py-2 outline-none focus:border-indigo-500"
        />
        {generando ? (
          <button onClick={detener} className="rounded-xl bg-rose-600 px-5 font-medium hover:bg-rose-500">
            Detener
          </button>
        ) : (
          <button onClick={mandar} className="rounded-xl bg-indigo-600 px-5 font-medium hover:bg-indigo-500">
            Enviar
          </button>
        )}
      </div>
    </div>
  );
}
