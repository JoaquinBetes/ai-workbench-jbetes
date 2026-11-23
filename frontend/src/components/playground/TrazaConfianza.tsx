import { useRef, useState } from "react";
import type { TokenLogprob } from "../../lib/api";
import { mostrarToken, pct, prob } from "../../lib/probs";

/**
 * Traza de la respuesta: una barra por token, tan alta como la duda del modelo
 * en ese paso (1 − probabilidad del token elegido). Se lee como un
 * electrocardiograma: los picos son los lugares donde la respuesta pudo ir
 * para otro lado. Clic en un pico para inspeccionarlo.
 */
export default function TrazaConfianza({
  tokens,
  desde = 0,
  seleccionado,
  onSeleccionar,
  alto = 40,
}: {
  tokens: TokenLogprob[];
  /** En una rama, lo anterior al token forzado se dibuja atenuado. */
  desde?: number;
  seleccionado: number | null;
  onSeleccionar: (i: number) => void;
  alto?: number;
}) {
  const svg = useRef<SVGSVGElement>(null);
  const [sobre, setSobre] = useState<number | null>(null);
  const n = tokens.length;
  if (n < 2) return null;

  const indiceEn = (clientX: number) => {
    const r = svg.current!.getBoundingClientRect();
    return Math.min(n - 1, Math.max(0, Math.floor(((clientX - r.left) / r.width) * n)));
  };

  const marcado = sobre ?? seleccionado;
  const t = marcado !== null ? tokens[marcado] : null;

  return (
    <div className="relative">
      <svg
        ref={svg}
        role="img"
        aria-label="Duda del modelo en cada token de la respuesta"
        viewBox={`0 0 ${n} ${alto}`}
        preserveAspectRatio="none"
        width="100%"
        height={alto}
        className="block cursor-crosshair"
        onPointerMove={(e) => setSobre(indiceEn(e.clientX))}
        onPointerLeave={() => setSobre(null)}
        onClick={(e) => onSeleccionar(indiceEn(e.clientX))}
      >
        <line x1={0} x2={n} y1={alto - 0.5} y2={alto - 0.5} stroke="var(--line-2)" strokeWidth={1} vectorEffect="non-scaling-stroke" />
        {tokens.map((tok, i) => {
          const h = Math.max(1, (1 - prob(tok.logprob)) * (alto - 4));
          const sel = i === seleccionado;
          return (
            <rect
              key={i}
              x={i + 0.12}
              y={alto - h}
              width={0.76}
              height={h}
              fill={sel ? "var(--accent)" : i === sobre ? "var(--ink)" : "var(--doubt)"}
              opacity={sel || i === sobre ? 1 : i < desde ? 0.22 : 0.4 + (1 - prob(tok.logprob)) * 0.6}
            />
          );
        })}
      </svg>
      <div className="mt-1.5 flex h-5 items-center justify-between gap-3 text-label text-muted">
        {t && marcado !== null ? (
          <span className="flex min-w-0 items-center gap-2">
            <span className="num">#{marcado + 1}</span>
            <span className="mono truncate text-ink">{mostrarToken(t.token)}</span>
            <span className="num">{pct(prob(t.logprob))}</span>
          </span>
        ) : (
          <span>Duda en cada token · clic en un pico para inspeccionarlo</span>
        )}
        <span className="num flex-none">{n} tokens</span>
      </div>
    </div>
  );
}
