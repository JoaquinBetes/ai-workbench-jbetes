import { Background, Handle, Position, ReactFlow, type Edge, type Node, type NodeProps } from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { useMemo } from "react";
import { metricas, mostrarToken } from "../../lib/probs";
import { ID_RAIZ, resumenNuevo, type Rama } from "../../lib/ramas";

// Layout tipo "árbol de carpetas": cada nivel se corre un poco a la derecha y
// cada rama ocupa una fila. Así entra bien en un panel angosto.
const ANCHO = 230;
const SANGRIA = 28;
const SEP_Y = 92;

type DatosNodo = {
  rama: Rama;
  titulo: string;
  activa: boolean;
  perplejidad: number | null;
};

function NodoRama({ data }: NodeProps<Node<DatosNodo>>) {
  const { rama, titulo, activa, perplejidad } = data;
  return (
    <div
      style={{ width: ANCHO }}
      className={`cursor-pointer rounded-lg border px-3 py-2 text-left text-xs shadow-sm transition-colors ${
        activa ? "border-indigo-400 bg-indigo-500/15" : "border-zinc-700 bg-zinc-900 hover:border-zinc-500"
      }`}
    >
      <Handle type="target" position={Position.Left} className="!border-0 !bg-zinc-500" />
      <div className="mb-1 flex items-center justify-between gap-2">
        <span className="font-medium text-zinc-100">{titulo}</span>
        {rama.generando ? (
          <span className="animate-pulse text-[10px] text-amber-300">generando…</span>
        ) : (
          perplejidad !== null && <span className="text-[10px] text-zinc-400">PPL {perplejidad.toFixed(2)}</span>
        )}
      </div>
      {rama.corte !== null && (
        <div className="mb-1 text-[11px] text-zinc-400">
          forzado <span className="font-mono text-amber-300">{mostrarToken(rama.tokens[rama.corte].token)}</span> · token #
          {rama.corte + 1}
        </div>
      )}
      <div className="line-clamp-2 text-[11px] leading-snug text-zinc-300">{resumenNuevo(rama) || "…"}</div>
      <Handle type="source" position={Position.Bottom} style={{ left: 14 }} className="!border-0 !bg-zinc-500" />
    </div>
  );
}

const tiposNodo = { rama: NodoRama };

/**
 * Árbol de las ramas de una respuesta. Cada nodo es una versión de la respuesta;
 * las flechas van de la rama madre a la hija, en el token donde se bifurcó.
 */
export default function ArbolRamas({
  ramas,
  activa,
  onElegir,
}: {
  ramas: Rama[];
  activa: string;
  onElegir: (id: string) => void;
}) {
  const { nodes, edges } = useMemo(() => {
    // x por profundidad (sangría), y por orden de recorrido (DFS).
    const hijos = (id: string) => ramas.filter((r) => r.padreId === id);
    const nodos: Node<DatosNodo>[] = [];
    const aristas: Edge[] = [];
    let fila = 0;

    const visitar = (rama: Rama, nivel: number) => {
      const indice = ramas.findIndex((r) => r.id === rama.id);
      const desde = rama.corte === null ? 0 : rama.corte + 1;
      const m = metricas(rama.tokens.slice(desde));
      nodos.push({
        id: rama.id,
        type: "rama",
        position: { x: nivel * SANGRIA, y: fila * SEP_Y },
        data: {
          rama,
          titulo: rama.id === ID_RAIZ ? "Original" : `Rama ${indice}`,
          activa: rama.id === activa,
          perplejidad: m && !rama.generando ? m.perplejidad : null,
        },
      });
      fila++;
      for (const hija of hijos(rama.id)) {
        aristas.push({
          id: `${rama.id}->${hija.id}`,
          source: rama.id,
          target: hija.id,
          type: "smoothstep",
          style: { stroke: hija.id === activa ? "#818cf8" : "#52525b" },
          animated: hija.generando,
        });
        visitar(hija, nivel + 1);
      }
    };

    const raiz = ramas.find((r) => r.padreId === null);
    if (raiz) visitar(raiz, 0);
    return { nodes: nodos, edges: aristas };
  }, [ramas, activa]);

  return (
    <div className="h-full min-h-64 rounded-lg border border-zinc-800 bg-zinc-950/60">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={tiposNodo}
        onNodeClick={(_, nodo) => onElegir(nodo.id)}
        nodesDraggable={false}
        nodesConnectable={false}
        fitView
        fitViewOptions={{ padding: 0.1, maxZoom: 1 }}
        minZoom={0.4}
        colorMode="dark"
      >
        <Background gap={18} size={1} color="#27272a" />
      </ReactFlow>
    </div>
  );
}
