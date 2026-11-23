import { useEffect, useState } from "react";
import { getModels, type ModelInfo } from "./api";

/** Modelos disponibles en Ollama, más el preferido por defecto (qwen3:8b si está). */
export function useModelos() {
  const [modelos, setModelos] = useState<ModelInfo[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getModels()
      .then(setModelos)
      .catch((e) => setError(`No pude leer los modelos: ${e.message}`));
  }, []);

  const preferido = modelos.find((m) => m.name === "qwen3:8b")?.name ?? modelos[0]?.name ?? "";
  return { modelos, preferido, error };
}

/** "8.2B" → 8.2e9, "751.63M" → 7.5e8. Sirve para ordenar modelos por tamaño. */
export function parametrosEnNumero(texto: string | null): number {
  const m = texto?.match(/([\d.]+)\s*([KMBT])?/i);
  if (!m) return 0;
  const escala: Record<string, number> = { K: 1e3, M: 1e6, B: 1e9, T: 1e12 };
  return parseFloat(m[1]) * (escala[(m[2] ?? "").toUpperCase()] ?? 1);
}
