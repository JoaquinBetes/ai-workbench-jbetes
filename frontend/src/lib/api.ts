// Cliente de la API del backend (FastAPI).

export type ModelInfo = {
  name: string;
  size_gb: number;
  parameters: string | null;
  quantization: string | null;
  family: string | null;
};

export type Health = {
  status: string;
  ollama: { ok: boolean; host: string; version?: string; error?: string };
};

export type TokenLogprob = {
  token: string;
  logprob: number;
  top: { token: string; logprob: number }[];
};

export type Stats = {
  prompt_tokens: number | null;
  output_tokens: number | null;
  tokens_per_second: number | null;
  time_to_first_token_s: number | null;
  total_s: number | null;
};

export type ChatEvent =
  | { type: "token"; content: string; logprobs: TokenLogprob[] }
  | { type: "thinking"; content: string }
  | { type: "done"; stats: Stats }
  | { type: "error"; message: string };

export type ChatMessage = { role: "system" | "user" | "assistant"; content: string };

export type ChatRequest = {
  model: string;
  messages: ChatMessage[];
  temperature?: number;
  top_p?: number;
  top_k?: number;
  seed?: number | null;
  think?: boolean;
  top_logprobs?: number;
};

export async function getHealth(): Promise<Health> {
  const res = await fetch("/api/health");
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

export async function getModels(): Promise<ModelInfo[]> {
  const res = await fetch("/api/models");
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

/**
 * Manda un chat y devuelve los eventos a medida que llegan (streaming SSE).
 * Se usa con `for await (const ev of streamChat(...))`.
 */
export async function* streamChat(
  body: ChatRequest,
  signal?: AbortSignal,
): AsyncGenerator<ChatEvent> {
  const res = await fetch("/api/chat/stream", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    signal,
  });
  if (!res.ok || !res.body) throw new Error(`HTTP ${res.status}`);

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });

    // Cada evento SSE termina con una línea en blanco.
    let corte: number;
    while ((corte = buffer.indexOf("\n\n")) >= 0) {
      const bloque = buffer.slice(0, corte);
      buffer = buffer.slice(corte + 2);
      const linea = bloque.split("\n").find((l) => l.startsWith("data: "));
      if (linea) yield JSON.parse(linea.slice(6)) as ChatEvent;
    }
  }
}
