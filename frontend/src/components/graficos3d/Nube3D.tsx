import { useMemo, useState } from "react";
import { BufferGeometry, Float32BufferAttribute } from "three";
import Lienzo3D, { Etiqueta } from "./Lienzo3D";
import { TINTA } from "../../lib/tintas";

export type PuntoNube = {
  /** referencia (la respuesta correcta) o respuesta de un modelo */
  tipo: "referencia" | "respuesta";
  /** número de caso: une cada respuesta con su referencia */
  orden: number;
  texto: string;
  x: number;
  y: number;
  z: number;
  /** color de la serie (solo respuestas) */
  color?: string;
  etiqueta?: string;
};

const ESCALA = 3.4;
const ejes = (() => {
  const g = new BufferGeometry();
  const L = ESCALA * 1.1;
  g.setAttribute("position", new Float32BufferAttribute([-L, 0, 0, L, 0, 0, 0, -L, 0, 0, L, 0, 0, 0, -L, 0, 0, L], 3));
  return g;
})();
const recortar = (t: string, n = 70) => (t.length > n ? `${t.slice(0, n - 1)}…` : t);

/**
 * Nube de embeddings en 3D. Cada punto es un texto proyectado con PCA desde el
 * espacio del modelo de embeddings: los que quieren decir lo mismo quedan cerca.
 * Las referencias son cubos blancos; las respuestas, esferas del color de su
 * modelo, unidas por una línea a la referencia de su caso: cuanto más corta la
 * línea, más se parece lo que dijo el modelo a lo que había que decir.
 */
export default function Nube3D({ puntos, titulo, alto = 360, extra }: { puntos: PuntoNube[]; titulo: string; alto?: number; extra?: React.ReactNode }) {
  const [sobre, setSobre] = useState<number | null>(null);
  const posicion = (p: PuntoNube): [number, number, number] => [p.x * ESCALA, p.y * ESCALA, p.z * ESCALA];

  // Líneas respuesta → referencia, agrupadas por color (un objeto por serie).
  const lineas = useMemo(() => {
    const refs = new Map(puntos.filter((p) => p.tipo === "referencia").map((p) => [p.orden, p]));
    const porColor = new Map<string, number[]>();
    for (const p of puntos) {
      const r = refs.get(p.orden);
      if (p.tipo !== "respuesta" || !r) continue;
      const lista = porColor.get(p.color ?? TINTA.tinta) ?? [];
      lista.push(...posicion(p), ...posicion(r));
      porColor.set(p.color ?? TINTA.tinta, lista);
    }
    return [...porColor].map(([color, coords]) => {
      const g = new BufferGeometry();
      g.setAttribute("position", new Float32BufferAttribute(coords, 3));
      return { color, g };
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [puntos]);

  const firma = `${puntos.length}|${puntos.map((p) => `${p.x}${p.y}`).join(",").slice(0, 400)}|${sobre}`;
  const activo = sobre !== null ? puntos[sobre] : null;

  return (
    <Lienzo3D titulo={titulo} firma={firma} alto={alto} escena={[ESCALA * 2.8, ESCALA * 2.3]} posicion={[6, 4.5, 9]} extra={extra}>
      <group>
        {/* los tres ejes del espacio, tenues: dan volumen sin competir con los puntos */}
        <lineSegments geometry={ejes}>
          <lineBasicMaterial color={TINTA.pista} transparent opacity={0.6} />
        </lineSegments>
        {lineas.map(({ color, g }) => (
          <lineSegments key={color} geometry={g}>
            <lineBasicMaterial color={color} transparent opacity={0.45} />
          </lineSegments>
        ))}
        {puntos.map((p, i) => {
          const resaltado = sobre === i || (activo !== null && activo.orden === p.orden);
          return (
            <mesh
              key={i}
              position={posicion(p)}
              onPointerOver={(e) => {
                e.stopPropagation();
                setSobre(i);
              }}
              onPointerOut={() => setSobre((s) => (s === i ? null : s))}
              scale={resaltado ? 1.5 : 1}
            >
              {p.tipo === "referencia" ? <boxGeometry args={[0.2, 0.2, 0.2]} /> : <sphereGeometry args={[0.1, 14, 10]} />}
              <meshBasicMaterial color={p.tipo === "referencia" ? TINTA.serigrafia : (p.color ?? TINTA.tinta)} />
            </mesh>
          );
        })}
        {activo && (
          <Etiqueta position={posicion(activo)} center zIndexRange={[40, 0]}>
            <span className="tip3d">
              {activo.tipo === "referencia" ? `referencia #${activo.orden + 1}` : `${activo.etiqueta} · #${activo.orden + 1}`}: {recortar(activo.texto)}
            </span>
          </Etiqueta>
        )}
      </group>
    </Lienzo3D>
  );
}
