import { Background, Handle, Position, ReactFlow, type Edge, type Node, type NodeProps } from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { useMemo } from "react";
import { Giro } from "../ascii/Texto";
import { num } from "../../lib/formato";
import { metricas, mostrarToken } from "../../lib/probs";
import { ID_RAIZ, resumenNuevo, type Rama } from "../../lib/ramas";

// Layout tipo "árbol de carpetas": cada nivel se corre a la derecha y cada rama
// ocupa una fila. Así entra bien en un panel angosto.
const ANCHO = 268;
const SANGRIA = 26;
const SEP_Y = 104;

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
      className={`relative cursor-pointer overflow-hidden border px-3 py-2.5 text-left transition-colors ${
        activa ? "border-[var(--accent)] bg-[var(--raised)]" : "border-line bg-panel hover:border-line-2"
      }`}
    >
      <Handle type="target" position={Position.Left} className="!h-1.5 !w-1.5 !rounded-none !border-0 !bg-[var(--ink-3)]" />
      <div className="mb-1 flex items-center justify-between gap-2">
        <span className="dot text-label text-ink">{titulo}</span>
        {rama.generando ? (
          <span className="flex items-center gap-1.5 text-label text-accent">
            <Giro /> generando
          </span>
        ) : (
          perplejidad !== null && <span className="num text-label text-muted">ppl {num(perplejidad, 2)}</span>
        )}
      </div>
      {rama.corte !== null && (
        <div className="mb-1 flex items-center gap-1.5 text-label text-muted">
          forzó
          <span className="mono bg-accent px-1 text-[var(--accent-ink)]">{mostrarToken(rama.tokens[rama.corte].token)}</span>
          <span className="num">en #{rama.corte + 1}</span>
        </div>
      )}
      <div className="line-clamp-2 text-label leading-snug text-ink-2">{resumenNuevo(rama, 70) || "…"}</div>
      <Handle type="source" position={Position.Bottom} style={{ left: 14 }} className="!h-1.5 !w-1.5 !rounded-none !border-0 !bg-[var(--ink-3)]" />
    </div>
  );
}

const tiposNodo = { rama: NodoRama };

/**
 * Árbol de las ramas de una respuesta. Cada nodo es una versión de la respuesta;
 * las líneas van de la rama madre a la hija, en el token donde se bifurcó.
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
          titulo: rama.id === ID_RAIZ ? "Respuesta original" : `Rama ${indice}`,
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
          style: { stroke: hija.id === activa ? "var(--accent)" : "var(--line-2)", strokeWidth: 1.5 },
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
    <div className="h-full min-h-64">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={tiposNodo}
        onNodeClick={(_, nodo) => onElegir(nodo.id)}
        nodesDraggable={false}
        nodesConnectable={false}
        fitView
        fitViewOptions={{ padding: 0.12, maxZoom: 1 }}
        minZoom={0.4}
        colorMode="dark"
        proOptions={{ hideAttribution: true }}
      >
        <Background gap={16} size={1} color="rgba(236,232,220,.09)" />
      </ReactFlow>
    </div>
  );
}
