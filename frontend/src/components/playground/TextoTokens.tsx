import type { TokenLogprob } from "../../lib/api";
import { colorIncertidumbre, colorProbabilidad, entropia, pct, prob } from "../../lib/probs";

export type ModoColor = "probabilidad" | "incertidumbre" | "ninguno";

/** Respuesta del modelo con cada token clickeable y coloreado. */
export default function TextoTokens({
  tokens,
  modo,
  seleccionado,
  onSeleccionar,
}: {
  tokens: TokenLogprob[];
  modo: ModoColor;
  seleccionado: number | null;
  onSeleccionar: (i: number) => void;
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
        return (
          <span
            key={i}
            onClick={() => onSeleccionar(i)}
            title={`${pct(p)}`}
            style={{ backgroundColor: fondo }}
            className={`cursor-pointer rounded-sm transition-shadow hover:ring-1 hover:ring-zinc-400 ${
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
