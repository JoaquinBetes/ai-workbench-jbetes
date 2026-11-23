import { Braces, Columns3, Shuffle } from "lucide-react";
import Segmentado from "../ui/Segmentado";
import { EncabezadoVista } from "../ui/Vista";
import Estructuradas from "./Estructuradas";
import LadoALado from "./LadoALado";
import Variabilidad from "./Variabilidad";

// Los tres modos del comparador (capítulo 2).
export const MODOS_COMPARADOR = [
  {
    id: "lado-a-lado",
    nombre: "Modelos lado a lado",
    corto: "Lado a lado",
    claves: "comparar modelos tamaño velocidad",
    descripcion: "El mismo prompt a varios modelos: velocidad, carga y certeza.",
    icono: Columns3,
  },
  {
    id: "variabilidad",
    nombre: "Variabilidad",
    corto: "Variabilidad",
    claves: "repetir autoconsistencia temperatura muestras",
    descripcion: "El mismo prompt muchas veces: cuántas respuestas distintas da.",
    icono: Shuffle,
  },
  {
    id: "estructuradas",
    nombre: "Salidas estructuradas",
    corto: "Salidas estructuradas",
    claves: "json esquema schema",
    descripcion: "Tres formas de obtener JSON válido, medidas sobre las mismas semillas.",
    icono: Braces,
  },
] as const;

export type IdModo = (typeof MODOS_COMPARADOR)[number]["id"];

export default function Comparador({
  activa = true,
  modo,
  onModo,
}: {
  activa?: boolean;
  modo: IdModo;
  onModo: (m: IdModo) => void;
}) {
  const actual = MODOS_COMPARADOR.find((m) => m.id === modo)!;
  return (
    <div className="flex h-full flex-col px-3 pb-3">
      <EncabezadoVista
        capitulo="Cap. 2"
        titulo="Comparador"
        descripcion={actual.descripcion}
        acciones={
          <Segmentado
            etiqueta="Modo del comparador"
            valor={modo}
            onChange={onModo}
            opciones={MODOS_COMPARADOR.map((m) => {
              const Icono = m.icono;
              return { valor: m.id, etiqueta: m.corto, icono: <Icono aria-hidden /> };
            })}
          />
        }
      />
      <div className="min-h-0 flex-1">
        {/* Los tres modos quedan montados para no perder resultados al cambiar de pestaña. */}
        <div hidden={modo !== "lado-a-lado"} className="h-full">
          <LadoALado activa={activa && modo === "lado-a-lado"} />
        </div>
        <div hidden={modo !== "variabilidad"} className="h-full">
          <Variabilidad activa={activa && modo === "variabilidad"} />
        </div>
        <div hidden={modo !== "estructuradas"} className="h-full">
          <Estructuradas activa={activa && modo === "estructuradas"} />
        </div>
      </div>
    </div>
  );
}
