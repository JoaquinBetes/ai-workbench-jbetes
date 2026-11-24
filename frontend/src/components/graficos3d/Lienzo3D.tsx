import { Html, OrbitControls } from "@react-three/drei";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { EffectComposer } from "@react-three/postprocessing";
import { Effect } from "postprocessing";
import { createContext, useContext, useEffect, useMemo, useRef, useState, type ComponentProps, type ReactNode, type RefObject } from "react";
import { CanvasTexture, Group, NearestFilter, OrthographicCamera, RepeatWrapping, Uniform } from "three";
import { useMovimiento } from "../../lib/movimiento";

// Efecto de post-proceso propio: convierte la escena en caracteres según la
// luminancia de cada celda, pero conserva el color de la celda (así lo elegido
// sigue encendido y la duda sigue en ámbar). La rampa va de vacío a lleno.
const RAMPA_3D = " .:-=+*#%@";
const FUENTE = '"IBM Plex Mono", monospace';

const fragmento = /* glsl */ `
  uniform sampler2D uChars;
  uniform float uCount;
  uniform float uCell;
  const vec2 SIZE = vec2(16.0);
  void mainImage(const in vec4 inputColor, const in vec2 uv, out vec4 outputColor) {
    vec2 cell = resolution / uCell;
    vec2 grid = 1.0 / cell;
    vec2 puv = grid * (0.5 + floor(uv / grid));
    vec4 px = texture2D(inputBuffer, puv);
    float lum = dot(px.rgb, vec3(0.299, 0.587, 0.114));
    float idx = floor((uCount - 1.0) * clamp(pow(lum, 0.55) * 1.25, 0.0, 1.0));
    vec2 pos = vec2(mod(idx, SIZE.x), floor(idx / SIZE.y));
    vec2 off = vec2(pos.x, -pos.y) / SIZE;
    vec2 cuv = mod(uv * (cell / SIZE), 1.0 / SIZE) - vec2(0.0, 1.0 / SIZE) + off;
    float glyph = texture2D(uChars, cuv).r;
    vec3 tinta = px.rgb / max(max(px.r, max(px.g, px.b)), 0.0001);
    outputColor = vec4(tinta * glyph * (0.6 + pow(lum, 0.55) * 0.6), px.a * glyph);
  }
`;

function texturaGlifos(chars: string) {
  const canvas = document.createElement("canvas");
  const SIZE = 1024, CELL = SIZE / 16;
  canvas.width = canvas.height = SIZE;
  const ctx = canvas.getContext("2d")!;
  ctx.font = `${CELL * 0.8}px ${FUENTE}`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillStyle = "#fff";
  for (let i = 0; i < chars.length; i++) ctx.fillText(chars[i], (i % 16) * CELL + CELL / 2, Math.floor(i / 16) * CELL + CELL / 2);
  return new CanvasTexture(canvas, undefined, RepeatWrapping, RepeatWrapping, NearestFilter, NearestFilter);
}

class EfectoAscii extends Effect {
  constructor(celda: number) {
    super("EfectoAscii", fragmento, {
      uniforms: new Map<string, Uniform>([
        ["uChars", new Uniform(texturaGlifos(RAMPA_3D))],
        ["uCount", new Uniform(RAMPA_3D.length)],
        ["uCell", new Uniform(celda)],
      ]),
    });
  }
}

function Ascii({ celda }: { celda: number }) {
  const efecto = useMemo(() => new EfectoAscii(celda), [celda]);
  useEffect(() => () => efecto.dispose(), [efecto]);
  return <primitive object={efecto} dispose={null} />;
}

// Las etiquetas HTML van a una capa propia, fija desde el primer render. Si no,
// drei las cuelga primero del contenedor del canvas y después (cuando se
// conectan los eventos) de otro elemento: quedan dos raíces de React sobre el
// mismo nodo y, al desmontar el gráfico, React tira "removeChild" en consola.
const CapaEtiquetas = createContext<RefObject<HTMLDivElement | null> | null>(null);

/** Una etiqueta HTML pegada a un punto de la escena (Html de drei, en la capa del lienzo). */
export function Etiqueta(props: ComponentProps<typeof Html>) {
  const capa = useContext(CapaEtiquetas);
  return <Html {...props} portal={(capa ?? undefined) as RefObject<HTMLElement> | undefined} />;
}

/** Re-dibuja cuando cambia algo de afuera (los datos) en modo "a demanda". */
function Invalidar({ firma }: { firma: string }) {
  const invalidate = useThree((s) => s.invalidate);
  useEffect(() => invalidate(), [firma, invalidate]);
  return null;
}


/** Vaivén: cuando nadie lo toca, el gráfico oscila despacio (±20°) para que se lea el volumen. */
function Vaiven({ activo, children }: { activo: boolean; children: ReactNode }) {
  const g = useRef<Group>(null);
  useFrame((estado) => {
    if (!g.current || !activo) return;
    g.current.rotation.y = Math.sin(estado.clock.elapsedTime * 0.3) * 0.35;
  });
  return <group ref={g}>{children}</group>;
}

/** Ajusta el zoom de la cámara ortográfica para que la escena entre en el lienzo. */
function Encuadre({ ancho, alto }: { ancho: number; alto: number }) {
  const { camera, size, invalidate } = useThree();
  useEffect(() => {
    const c = camera as OrthographicCamera;
    c.zoom = Math.max(8, Math.min(size.width / ancho, size.height / alto));
    c.updateProjectionMatrix();
    invalidate();
  }, [camera, size.width, size.height, ancho, alto, invalidate]);
  return null;
}

/**
 * Marco común de los gráficos 3D: cámara ortográfica, giro con el mouse
 * (arrastrar), zoom con la rueda, rotación lenta cuando nadie lo toca y un
 * interruptor entre líneas y caracteres (modo ASCII).
 */
export default function Lienzo3D({
  children,
  alto = 300,
  titulo,
  firma,
  escena = [13, 7.5],
  posicion = [4.5, 6, 10],
  ascii: asciiInicial = false,
  extra,
}: {
  /** contenido de la escena; si es función, recibe si está en modo ASCII */
  children: ReactNode | ((ascii: boolean) => ReactNode);
  alto?: number;
  titulo: string;
  /** cambia cuando cambian los datos, para re-dibujar */
  firma: string;
  /** ancho y alto (en unidades) que tiene que mostrar la cámara */
  escena?: [number, number];
  posicion?: [number, number, number];
  ascii?: boolean;
  extra?: ReactNode;
}) {
  const [ascii, setAscii] = useState(asciiInicial);
  const [visible, setVisible] = useState(true);
  const [tocando, setTocando] = useState(false);
  const caja = useRef<HTMLDivElement>(null);
  const capa = useRef<HTMLDivElement>(null);
  const quieto = !useMovimiento();

  useEffect(() => {
    if (!caja.current) return;
    const io = new IntersectionObserver(([e]) => setVisible(e.isIntersecting));
    io.observe(caja.current);
    return () => io.disconnect();
  }, []);

  return (
    <div ref={caja} className="relative" style={{ height: alto }} role="group" aria-label={titulo}>
      <CapaEtiquetas.Provider value={capa}>
        <Canvas
          orthographic
          camera={{ position: posicion, zoom: 40, near: 0.1, far: 200 }}
          dpr={[1, 2]}
          gl={{ antialias: true, alpha: true, preserveDrawingBuffer: false }}
          frameloop={!visible ? "never" : quieto ? "demand" : "always"}
          onPointerDown={() => setTocando(true)}
          onPointerUp={() => setTocando(false)}
          onPointerLeave={() => setTocando(false)}
        >
          <ambientLight intensity={0.55} />
          <directionalLight position={[6, 10, 4]} intensity={1.6} />
          <directionalLight position={[-6, 4, -4]} intensity={0.35} />
          <Invalidar firma={`${firma}|${ascii}`} />
          <Encuadre ancho={escena[0]} alto={escena[1]} />
          <Vaiven activo={!quieto && !tocando}>{typeof children === "function" ? children(ascii) : children}</Vaiven>
          <OrbitControls
            makeDefault
            enablePan={false}
            enableDamping
            dampingFactor={0.12}
            minZoom={10}
            maxZoom={200}
            minPolarAngle={0.2}
            maxPolarAngle={Math.PI / 2.1}
            minAzimuthAngle={-1.2}
            maxAzimuthAngle={1.2}
          />
          {ascii && (
            <EffectComposer multisampling={0}>
              <Ascii celda={8} />
            </EffectComposer>
          )}
        </Canvas>
      </CapaEtiquetas.Provider>
      <div ref={capa} className="pointer-events-none absolute inset-0 isolate overflow-hidden" />
      <div className="pointer-events-none absolute inset-x-0 top-0 flex items-center justify-between gap-2 p-2">
        <span className="label">arrastrá para girar · rueda para acercar</span>
        <span className="pointer-events-auto flex items-center gap-2">
          {extra}
          <button
            type="button"
            className="btn btn--sm"
            aria-pressed={ascii}
            onClick={() => setAscii((a) => !a)}
            data-tip="Dibujar el gráfico con caracteres"
            data-tip-pos="left"
          >
            {ascii ? "ver líneas" : "ver en ASCII"}
          </button>
        </span>
      </div>
    </div>
  );
}
