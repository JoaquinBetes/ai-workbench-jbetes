import { useRef, useState } from "react";
import { streamChat, type ChatMessage, type ChatRequest, type Stats, type TokenLogprob } from "./api";

export type Turno = ChatMessage & {
  tokens?: TokenLogprob[];
  thinking?: string;
  stats?: Stats;
};

export type Parametros = Omit<ChatRequest, "model" | "messages">;

/**
 * Maneja una conversación con streaming: guarda los turnos, va armando la
 * respuesta token a token y permite cancelarla. La usan el Chat y el Playground.
 */
export function useStreamingChat() {
  const [turnos, setTurnos] = useState<Turno[]>([]);
  const [generando, setGenerando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const cancelar = useRef<AbortController | null>(null);

  async function enviar(texto: string, modelo: string, parametros: Parametros = {}, system?: string) {
    if (!texto.trim() || !modelo || generando) return;

    const historial: Turno[] = [...turnos, { role: "user", content: texto.trim() }];
    setTurnos([...historial, { role: "assistant", content: "", tokens: [], thinking: "" }]);
    setError(null);
    setGenerando(true);
    cancelar.current = new AbortController();

    // Actualiza la última respuesta (la que se está generando).
    const actualizar = (f: (t: Turno) => Turno) =>
      setTurnos((prev) => [...prev.slice(0, -1), f(prev[prev.length - 1])]);

    const mensajes: ChatMessage[] = [
      ...(system?.trim() ? [{ role: "system" as const, content: system.trim() }] : []),
      ...historial.map(({ role, content }) => ({ role, content })),
    ];

    try {
      for await (const ev of streamChat({ model: modelo, messages: mensajes, ...parametros }, cancelar.current.signal)) {
        if (ev.type === "token") {
          actualizar((t) => ({ ...t, content: t.content + ev.content, tokens: [...(t.tokens ?? []), ...ev.logprobs] }));
        } else if (ev.type === "thinking") {
          actualizar((t) => ({ ...t, thinking: (t.thinking ?? "") + ev.content }));
        } else if (ev.type === "done") {
          actualizar((t) => ({ ...t, stats: ev.stats }));
        } else if (ev.type === "error") {
          setError(ev.message);
        }
      }
    } catch (e) {
      if ((e as Error).name !== "AbortError") setError((e as Error).message);
    } finally {
      setGenerando(false);
    }
  }

  return {
    turnos,
    generando,
    error,
    enviar,
    detener: () => cancelar.current?.abort(),
    reiniciar: () => setTurnos([]),
  };
}
