import { useState } from "react";
import type { TokenLogprob } from "../../lib/api";
import { nombreCorto, num } from "../../lib/formato";
import { crestaDeDuda } from "../../lib/paisaje";
import { Barras, Cordillera } from "../graficos3d";
import Segmentado from "../ui/Segmentado";

export type FilaResumen = {
  modelo: string;
  color: string;
  tokS: number | null;
  carga: number | null;
  perplejidad: number | null;
  confianza: number | null;
  tokens: TokenLogprob[];
};

const MEDIDAS: { clave: "tokS" | "carga" | "confianza" | "perplejidad"; titulo: string; mejor: "alto" | "bajo"; formato: (v: number) => string }[] = [
  { clave: "tokS", titulo: "velocidad", mejor: "alto", formato: (v) => `${num(v, 0)} tok/s` },
  { clave: "carga", titulo: "carga", mejor: "bajo", formato: (v) => `${num(v, 1)} s de carga` },
  { clave: "confianza", titulo: "confianza", mejor: "alto", formato: (v) => `${num(v * 100, 0)} % de confianza` },
  { clave: "perplejidad", titulo: "perplejidad", mejor: "bajo", formato: (v) => `perplejidad ${num(v, 2)}` },
];

/**
 * Resumen de la comparación en 3D, en dos lecturas:
 * - barras: cada medida escalada a su máximo (el mejor de cada una se ve de un vistazo);
 * - cordillera: la duda token a token de cada modelo, una cresta por modelo.
 * Se muestra una a la vez (cada gráfico 3D es un contexto WebGL).
 */
export default function ResumenModelos3D({ filas }: { filas: FilaResumen[] }) {
  const [vista, setVista] = useState<"barras" | "duda">("barras");

  const valores = filas.map((f) =>
    MEDIDAS.map((m) => {
      // Puntaje de 0 a 1 donde 1 es el mejor modelo en esa medida (alto o bajo, según la medida).
      const v = f[m.clave];
      if (v === null) return null;
      const todos = filas.map((g) => g[m.clave]).filter((x): x is number => x !== null);
      if (m.mejor === "alto") return v / Math.max(...todos, 1e-9);
      return v <= 0 ? 1 : Math.min(...todos) / v;
    }),
  );
  const textos = filas.map((f) =>
    MEDIDAS.map((m) => {
      const v = f[m.clave];
      return `${nombreCorto(f.modelo)} · ${v === null ? "sin dato" : m.formato(v)} · ${m.mejor === "alto" ? "más es mejor" : "menos es mejor"}`;
    }),
  );

  return (
    <div className="panel rise-in">
      <div className="panel-head flex-wrap py-2">
        <span className="panel-title">Resumen en 3D</span>
        <Segmentado
          etiqueta="Qué gráfico ver"
          sm
          valor={vista}
          onChange={setVista}
          className="ml-auto"
          opciones={[
            { valor: "barras", etiqueta: "medidas" },
            { valor: "duda", etiqueta: "duda por token" },
          ]}
        />
      </div>
      {vista === "barras" ? (
        <Barras
          titulo="Barras 3D: una fila por modelo y una columna por medida; la barra más alta es el mejor modelo en esa medida"
          columnas={MEDIDAS.map((m) => m.titulo)}
          series={filas.map((f) => ({ etiqueta: nombreCorto(f.modelo), color: f.color }))}
          valores={valores}
          textos={textos}
          alto={340}
        />
      ) : (
        <Cordillera
          titulo="Cordillera 3D: la duda de cada modelo a lo largo de su respuesta, una cresta por modelo"
          filas={filas.map((f) => ({ etiqueta: `${nombreCorto(f.modelo)} · ${f.tokens.length} tokens`, valores: crestaDeDuda(f.tokens), color: f.color }))}
          ejeX={["inicio de la respuesta", "fin"]}
          ejeZ={[nombreCorto(filas[0].modelo), nombreCorto(filas[filas.length - 1].modelo)]}
          alto={340}
        />
      )}
      <p className="hint border-t border-line px-4 py-2.5">
        {vista === "barras"
          ? "Cada columna es un puntaje: la barra más alta es el mejor modelo en esa medida (en carga y perplejidad, el que tiene menos). El valor real aparece al pasar el mouse."
          : "Cuanto más alta la cresta, más dudó el modelo en ese tramo de la respuesta."}
      </p>
    </div>
  );
}
