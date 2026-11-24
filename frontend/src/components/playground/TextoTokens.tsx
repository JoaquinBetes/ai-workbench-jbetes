import { memo, useEffect, useState } from "react";
import { CIFRA } from "../../lib/ascii";
import type { TokenLogprob } from "../../lib/api";
import { duda, pct, prob } from "../../lib/probs";

/**
 * "duda": subrayado ámbar cuya intensidad es la entropía normalizada del paso
 *         (el modelo dudaba entre varias opciones parecidas). Lo seguro queda limpio.
 * "probabilidad": fondo ámbar cuanto menos probable fue el token elegido.
 * "ninguno": texto plano (igual se puede hacer clic).
 */
export type ModoColor = "duda" | "probabilidad" | "ninguno";

const reducido = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches;
const cifrar = (s: string) => s.replace(/\S/g, () => CIFRA[Math.floor(Math.random() * CIFRA.length)]);

/** Un token recién llegado: tres cuadros de glifos al azar y después el texto real (~135 ms). */
function Cifrado({ texto, animar }: { texto: string; animar: boolean }) {
  const [vista, setVista] = useState(() => (animar && !reducido() ? cifrar(texto) : texto));
  useEffect(() => {
    if (vista === texto) return;
    let n = 0;
    const id = setInterval(() => {
      n++;
      if (n >= 3) {
        setVista(texto);
        clearInterval(id);
      } else setVista(cifrar(texto));
    }, 45);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [texto]);
  return <>{vista}</>;
}

function TextoTokens({
  tokens,
  modo,
  seleccionado,
  onSeleccionar,
  corte = null,
  cursor = false,
}: {
  tokens: TokenLogprob[];
  modo: ModoColor;
  seleccionado: number | null;
  onSeleccionar: (i: number) => void;
  /** En una rama: índice del token forzado. Lo anterior se muestra atenuado (heredado). */
  corte?: number | null;
  /** Cursor al final mientras se genera. */
  cursor?: boolean;
}) {
  return (
    <div className={`tokens ${modo === "ninguno" ? "tokens--plain" : ""}`}>
      {tokens.map((t, i) => {
        const p = prob(t.logprob);
        const heredado = corte !== null && i < corte;
        const forzado = corte !== null && i === corte;
        const d = modo === "duda" ? Math.max(0, (duda(t) - 0.12) / 0.88) : 0;
        const f = modo === "probabilidad" ? (1 - p) * 42 : 0;
        const clases = ["tok"];
        if (heredado) clases.push("tok--inh");
        if (forzado) clases.push("tok--forced");
        if (seleccionado === i) clases.push("tok--sel");
        return (
          <span
            key={i}
            onClick={() => onSeleccionar(i)}
            title={forzado ? `Token forzado · ${pct(p)}` : `${pct(p)}`}
            style={{ ["--d" as string]: `${(d * 100).toFixed(0)}%`, ["--f" as string]: `${f.toFixed(0)}%` }}
            className={clases.join(" ")}
          >
            <Cifrado texto={t.token} animar={cursor && i >= tokens.length - 6} />
          </span>
        );
      })}
      {cursor && <span className="caret" aria-hidden />}
    </div>
  );
}

export default memo(TextoTokens);
