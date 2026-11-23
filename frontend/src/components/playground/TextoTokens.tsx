import type { TokenLogprob } from "../../lib/api";
import { colorIncertidumbre, colorProbabilidad, entropia, pct, prob } from "../../lib/probs";

export type ModoColor = "probabilidad" | "incertidumbre" | "ninguno";

/** Respuesta del modelo con cada token clickeable y coloreado. */
export default function TextoTokens({
  tokens,
  modo,
  seleccionado,
  onSeleccionar,
  corte = null,
}: {
  tokens: TokenLogprob[];
  modo: ModoColor;
  seleccionado: number | null;
  onSeleccionar: (i: number) => void;
  /** En una rama: índice del token forzado. Lo anterior se muestra atenuado (heredado). */
  corte?: number | null;
}) {
  return (
    <span className="whitespace-pre-wrap leading-relaxed">
      {tokens.map((t, i) => {
        const p = prob(t.logprob);
        const fondo =
          modo === "probabilidad"
            ? colorProbabilidad(p)
            : modo === "incertidumbre"
              ? colorIncertidumbre(entropia(t), t.top.length)
              : undefined;
        const heredado = corte !== null && i < corte;
        const forzado = corte !== null && i === corte;
        return (
          <span
            key={i}
            onClick={() => onSeleccionar(i)}
            title={forzado ? `Token forzado (${pct(p)})` : heredado ? `Heredado (${pct(p)})` : pct(p)}
            style={{ backgroundColor: forzado ? undefined : fondo }}
            className={`cursor-pointer rounded-sm transition-shadow hover:ring-1 hover:ring-zinc-400 ${
              heredado ? "opacity-45" : ""
            } ${forzado ? "bg-amber-400/25 outline outline-1 outline-dashed outline-amber-400" : ""} ${
              seleccionado === i ? "ring-2 ring-indigo-400" : ""
            }`}
          >
            {t.token}
          </span>
        );
      })}
    </span>
  );
}
