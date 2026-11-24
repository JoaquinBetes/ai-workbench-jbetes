import { useEffect, useState } from "react";
import { CIFRA } from "../../lib/ascii";

const reducido = () => typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
const azar = () => CIFRA[Math.floor(Math.random() * CIFRA.length)];

/**
 * Texto que se decodifica al aparecer: cada letra pasa por glifos al azar y se
 * asienta de izquierda a derecha. Una sola vez, al montarse (~450 ms).
 */
export function Decodificar({ texto, duracion = 450, className = "" }: { texto: string; duracion?: number; className?: string }) {
  const [vista, setVista] = useState(() => (reducido() ? texto : texto.replace(/\S/g, " ")));

  useEffect(() => {
    if (reducido()) {
      setVista(texto);
      return;
    }
    const t0 = performance.now();
    let raf = 0;
    const paso = (ahora: number) => {
      const k = Math.min(1, (ahora - t0) / duracion);
      const fijas = Math.floor(k * texto.length);
      setVista(
        texto
          .split("")
          .map((c, i) => (c === " " || i < fijas ? c : i < fijas + 6 ? azar() : " "))
          .join(""),
      );
      if (k < 1) raf = requestAnimationFrame(paso);
    };
    raf = requestAnimationFrame(paso);
    return () => cancelAnimationFrame(raf);
  }, [texto, duracion]);

  return (
    <span className={className} aria-label={texto}>
      <span aria-hidden>{vista}</span>
    </span>
  );
}

const MARCOS = ["|", "/", "-", "\\"];

/** Indicador de carga en modo texto: | / - \ (100 ms por cuadro). */
export function Giro({ className = "" }: { className?: string }) {
  const [i, setI] = useState(0);
  useEffect(() => {
    if (reducido()) return;
    const id = setInterval(() => setI((x) => (x + 1) % MARCOS.length), 100);
    return () => clearInterval(id);
  }, []);
  return (
    <span className={`num inline-block w-[1ch] text-center ${className}`} aria-hidden>
      {reducido() ? "·" : MARCOS[i]}
    </span>
  );
}

/**
 * Barra hecha de caracteres: ######······ . Alineada en monoespaciada, sirve
 * para cualquier proporción (0 a 1). `largo` es la cantidad de celdas.
 */
export function BarraTexto({
  valor,
  largo = 16,
  tono = "ink",
  className = "",
}: {
  valor: number;
  largo?: number;
  tono?: "ink" | "accent" | "doubt" | "muted";
  className?: string;
}) {
  const llenas = Math.max(0, Math.min(largo, Math.round(valor * largo)));
  const color = { ink: "text-ink", accent: "text-accent", doubt: "text-doubt", muted: "text-muted" }[tono];
  return (
    <span className={`mono whitespace-pre text-label leading-none ${className}`} aria-hidden>
      <span className={color}>{"#".repeat(llenas)}</span>
      <span className="text-faint">{"·".repeat(largo - llenas)}</span>
    </span>
  );
}

/** Mini gráfico hecho con caracteres de densidad creciente: . : - = + * #. */
export function SparkTexto({ valores, className = "" }: { valores: number[]; className?: string }) {
  const g = ".:-=+*#";
  if (valores.length < 2) return null;
  const max = Math.max(...valores), min = Math.min(...valores);
  const r = max - min || 1;
  return (
    <span className={`mono whitespace-pre ${className}`} aria-hidden>
      {valores.map((v) => g[Math.min(g.length - 1, Math.floor(((v - min) / r) * g.length))]).join("")}
    </span>
  );
}
