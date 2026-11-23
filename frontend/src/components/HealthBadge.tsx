import { useEffect, useState } from "react";
import { getHealth, type Health } from "../lib/api";

// Indicador de estado: ¿el backend responde? ¿el backend llega a Ollama?
export default function HealthBadge() {
  const [health, setHealth] = useState<Health | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    const consultar = () =>
      getHealth()
        .then((h) => {
          setHealth(h);
          setError(false);
        })
        .catch(() => setError(true));
    consultar();
    const id = setInterval(consultar, 15000);
    return () => clearInterval(id);
  }, []);

  const ok = !error && health?.ollama.ok;
  const texto = error
    ? "Backend sin conexión"
    : !health
      ? "Conectando..."
      : health.ollama.ok
        ? `Ollama ${health.ollama.version ?? ""}`
        : "Ollama no responde";

  return (
    <span
      title={health?.ollama.error ?? health?.ollama.host}
      className={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs ${
        ok ? "bg-emerald-500/15 text-emerald-300" : "bg-rose-500/15 text-rose-300"
      }`}
    >
      <span className={`h-2 w-2 rounded-full ${ok ? "bg-emerald-400" : "bg-rose-400"}`} />
      {texto}
    </span>
  );
}
