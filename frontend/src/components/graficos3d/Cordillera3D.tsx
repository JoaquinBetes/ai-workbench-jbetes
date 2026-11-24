import { Html, Line } from "@react-three/drei";
import type { ThreeEvent } from "@react-three/fiber";
import { useMemo, useState } from "react";
import { BufferAttribute, Color, DoubleSide, Shape, ShapeGeometry } from "three";
import Lienzo3D from "./Lienzo3D";

export type FilaCordillera = {
  /** texto corto para el tooltip */
  etiqueta: string;
  /** alturas de 0 a 1, todas las filas con el mismo largo */
  valores: number[];
  /** índice del punto a marcar (por ejemplo, el token elegido) */
  marca?: number | null;
  /** color de la línea; por defecto washi */
  color?: string;
};

const ANCHO = 8; // ancho del eje x en unidades de escena
const ALTO = 2.4; // altura máxima

function Cresta({
  fila,
  z,
  activa,
  sobre,
  ascii,
  onSobre,
  onSalir,
  onClick,
}: {
  fila: FilaCordillera;
  z: number;
  activa: boolean;
  sobre: boolean;
  ascii: boolean;
  onSobre: (e: ThreeEvent<PointerEvent>) => void;
  onSalir: () => void;
  onClick: () => void;
}) {
  const n = fila.valores.length;
  const xs = (i: number) => -ANCHO / 2 + (i / Math.max(1, n - 1)) * ANCHO;
  const color = activa ? "#c2583f" : sobre ? "#ffffff" : fila.color ?? "#ece8dc";

  // Superficie bajo la línea: tapa las crestas de atrás (el clásico "joyplot").
  // En modo ASCII se ilumina de abajo hacia arriba para que los caracteres tengan relieve.
  const geometria = useMemo(() => {
    const s = new Shape();
    s.moveTo(xs(0), 0);
    fila.valores.forEach((v, i) => s.lineTo(xs(i), v * ALTO));
    s.lineTo(xs(n - 1), 0);
    s.lineTo(xs(0), 0);
    const g = new ShapeGeometry(s);
    const pos = g.getAttribute("position");
    const col = new Float32Array(pos.count * 3);
    const base = new Color(color);
    for (let i = 0; i < pos.count; i++) {
      const k = Math.min(1, pos.getY(i) / ALTO);
      const f = 0.08 + 0.92 * Math.pow(k, 0.8);
      col[i * 3] = base.r * f;
      col[i * 3 + 1] = base.g * f;
      col[i * 3 + 2] = base.b * f;
    }
    g.setAttribute("color", new BufferAttribute(col, 3));
    return g;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fila.valores, color]);

  const puntos = useMemo(() => fila.valores.map((v, i) => [xs(i), v * ALTO, 0] as [number, number, number]), [fila.valores]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <group position={[0, 0, z]}>
      <mesh geometry={geometria} onPointerOver={onSobre} onPointerOut={onSalir} onClick={onClick}>
        {ascii ? (
          <meshBasicMaterial key="ascii" vertexColors color="#ffffff" side={DoubleSide} />
        ) : (
          <meshBasicMaterial key="lineas" color="#050505" side={DoubleSide} polygonOffset polygonOffsetFactor={1} polygonOffsetUnits={1} />
        )}
      </mesh>
      {!ascii && <Line points={puntos} color={color} lineWidth={activa || sobre ? 2.2 : 1.15} transparent opacity={activa || sobre ? 1 : 0.82} />}
      {fila.marca !== null && fila.marca !== undefined && fila.valores[fila.marca] !== undefined && (
        <mesh position={[xs(fila.marca), fila.valores[fila.marca] * ALTO + 0.06, 0.01]}>
          <boxGeometry args={[0.09, 0.09, 0.09]} />
          <meshBasicMaterial color={activa ? "#ece8dc" : "#c2583f"} />
        </mesh>
      )}
    </group>
  );
}

/**
 * Cordillera 3D (ridgeline): una cresta por fila, en profundidad. Se gira con
 * el mouse; pasar por una cresta la resalta y hacer clic la elige.
 */
export default function Cordillera3D({
  filas,
  seleccion = null,
  onSeleccionar,
  titulo,
  ejeX,
  ejeZ,
  alto = 300,
  extra,
}: {
  filas: FilaCordillera[];
  seleccion?: number | null;
  onSeleccionar?: (i: number) => void;
  titulo: string;
  /** etiquetas del eje x, repartidas de izquierda a derecha (2 o 3) */
  ejeX: string[];
  ejeZ: [string, string];
  alto?: number;
  extra?: React.ReactNode;
}) {
  const [sobre, setSobre] = useState<number | null>(null);
  const n = filas.length;
  const fondo = Math.min(9, Math.max(3, n * 0.16));
  const dz = n > 1 ? fondo / (n - 1) : 0;
  const z0 = -fondo / 2;
  const firma = `${n}|${seleccion}|${sobre}|${filas.map((f) => f.valores.length).join(",")}`;
  const hover = sobre !== null ? filas[sobre] : null;

  return (
    <Lienzo3D titulo={titulo} firma={firma} alto={alto} extra={extra} escena={[ANCHO + 3.5, ALTO + fondo * 0.5 + 1.4]}>
      {(ascii) => (
        <group position={[0, -0.9, 0]}>
          {/* piso: marco y marcas de registro */}
          <Line
            points={[
              [-ANCHO / 2, 0, z0 - 0.3], [ANCHO / 2, 0, z0 - 0.3], [ANCHO / 2, 0, -z0 + 0.3], [-ANCHO / 2, 0, -z0 + 0.3], [-ANCHO / 2, 0, z0 - 0.3],
            ]}
            color="#ece8dc"
            transparent
            opacity={0.18}
            lineWidth={1}
          />
          {Array.from({ length: 9 }, (_, i) => -ANCHO / 2 + (i * ANCHO) / 8).map((x) => (
            <Line key={x} points={[[x, 0, -z0 + 0.3], [x, 0, -z0 + 0.5]]} color="#ece8dc" transparent opacity={0.35} lineWidth={1} />
          ))}
          {/* de atrás hacia adelante: así cada superficie tapa la de atrás */}
          {filas.map((f, i) => (
            <Cresta
              key={i}
              fila={f}
              z={n > 1 ? z0 + i * dz : 0}
              activa={i === seleccion}
              sobre={i === sobre}
              ascii={ascii}
              onSobre={(e) => {
                e.stopPropagation();
                setSobre(i);
                document.body.style.cursor = "pointer";
              }}
              onSalir={() => {
                setSobre((s) => (s === i ? null : s));
                document.body.style.cursor = "";
              }}
              onClick={() => onSeleccionar?.(i)}
            />
          ))}
          {ejeX.map((e, i) => (
            <Html key={`x${i}`} position={[-ANCHO / 2 + (i * ANCHO) / Math.max(1, ejeX.length - 1), 0, -z0 + 0.9]} center>
              <span className="eje3d">{e}</span>
            </Html>
          ))}
          <Html position={[ANCHO / 2 + 0.9, 0, z0]} center>
            <span className="eje3d">{ejeZ[0]}</span>
          </Html>
          <Html position={[ANCHO / 2 + 0.9, 0, -z0]} center>
            <span className="eje3d">{ejeZ[1]}</span>
          </Html>
          {hover && sobre !== null && (
            <Html position={[0, ALTO + 0.4, n > 1 ? z0 + sobre * dz : 0]} center zIndexRange={[40, 0]}>
              <span className="tip3d">{hover.etiqueta}</span>
            </Html>
          )}
        </group>
      )}
    </Lienzo3D>
  );
}
