import { Edges, Html } from "@react-three/drei";
import { useState } from "react";
import Lienzo3D from "./Lienzo3D";
import { TINTA } from "../../lib/tintas";

export type SerieBarras = { etiqueta: string; color: string };

const ALTO = 3;
const LADO = 0.62;

/**
 * Barras 3D: columnas (eje x) por series (eje z). Cada serie con su color de
 * la paleta categórica; los valores van de 0 a 1 (normalizados por columna si
 * las medidas tienen escalas distintas). Pasar el mouse muestra el valor real.
 */
export default function Barras3D({
  columnas,
  series,
  valores,
  textos,
  titulo,
  alto = 300,
  extra,
}: {
  columnas: string[];
  series: SerieBarras[];
  /** valores[serie][columna], de 0 a 1 (null = sin dato) */
  valores: (number | null)[][];
  /** texto del tooltip de cada barra */
  textos: string[][];
  titulo: string;
  alto?: number;
  extra?: React.ReactNode;
}) {
  const [sobre, setSobre] = useState<[number, number] | null>(null);
  // Con pocas columnas o series, más aire entre barras (así no se tapan las etiquetas).
  const PASO_X = columnas.length <= 4 ? 1.9 : 1.3;
  const PASO_Z = series.length <= 3 ? 1.6 : 1.25;
  const ancho = (columnas.length - 1) * PASO_X;
  const fondo = (series.length - 1) * PASO_Z;
  const firma = `${columnas.join(",")}|${series.map((s) => s.etiqueta).join(",")}|${valores.flat().join(",")}|${sobre}`;

  return (
    <Lienzo3D titulo={titulo} firma={firma} alto={alto} escena={[ancho + fondo * 0.6 + 4.5, ALTO + fondo * 0.45 + 1.6]} posicion={[7, 7.5, 9]} extra={extra}>
      <group position={[-ancho / 2, -1.4, -fondo / 2]}>
        {/* piso tramado: una grilla fina */}
        {columnas.map((_, x) =>
          series.map((__, z) => (
            <mesh key={`p${x}-${z}`} position={[x * PASO_X, -0.001, z * PASO_Z]} rotation={[-Math.PI / 2, 0, 0]}>
              <planeGeometry args={[LADO + 0.3, LADO + 0.3]} />
              <meshBasicMaterial color={TINTA.tinta} transparent opacity={0.04} />
            </mesh>
          )),
        )}
        {series.map((s, z) =>
          columnas.map((_, x) => {
            const v = valores[z]?.[x];
            if (v === null || v === undefined) return null;
            const h = Math.max(0.04, v * ALTO);
            const activa = sobre?.[0] === z && sobre?.[1] === x;
            return (
              <mesh
                key={`${z}-${x}`}
                position={[x * PASO_X, h / 2, z * PASO_Z]}
                onPointerOver={(e) => {
                  e.stopPropagation();
                  setSobre([z, x]);
                  document.body.style.cursor = "pointer";
                }}
                onPointerOut={() => {
                  setSobre((p) => (p?.[0] === z && p?.[1] === x ? null : p));
                  document.body.style.cursor = "";
                }}
              >
                <boxGeometry args={[LADO, h, LADO]} />
                <meshLambertMaterial color={activa ? TINTA.senal : s.color} />
                <Edges color={activa ? TINTA.serigrafia : TINTA.fondo} threshold={15} />
              </mesh>
            );
          }),
        )}
        {columnas.map((c, x) => (
          <Html key={`cx${c}`} position={[x * PASO_X, 0, fondo + 1.05]} center>
            <span className="eje3d">{c}</span>
          </Html>
        ))}
        {series.map((s, z) => (
          <Html key={`sz${s.etiqueta}`} position={[ancho + 1.1, 0, z * PASO_Z]} center>
            <span className="eje3d" style={{ color: s.color }}>
              ■ {s.etiqueta}
            </span>
          </Html>
        ))}
        {sobre && (
          <Html position={[sobre[1] * PASO_X, (valores[sobre[0]][sobre[1]] ?? 0) * ALTO + 0.5, sobre[0] * PASO_Z]} center zIndexRange={[40, 0]}>
            <span className="tip3d">{textos[sobre[0]]?.[sobre[1]]}</span>
          </Html>
        )}
      </group>
    </Lienzo3D>
  );
}
