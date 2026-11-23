import { useState } from "react";
import Chat from "./components/Chat";
import Comparador from "./components/comparador/Comparador";
import HealthBadge from "./components/HealthBadge";
import Playground from "./components/playground/Playground";

// Cada módulo del Workbench es una pestaña. Se van sumando capítulo a capítulo.
const MODULOS = [
  { id: "playground", nombre: "Playground", capitulo: "Cap. 2", componente: Playground },
  { id: "comparador", nombre: "Comparador", capitulo: "Cap. 2", componente: Comparador },
  { id: "chat", nombre: "Chat", capitulo: null, componente: Chat },
] as const;

type IdModulo = (typeof MODULOS)[number]["id"];

export default function App() {
  const [activo, setActivo] = useState<IdModulo>("playground");
  const Modulo = MODULOS.find((m) => m.id === activo)!.componente;

  return (
    <div className="flex h-screen flex-col">
      <header className="flex items-center gap-6 border-b border-zinc-800 px-6 py-3">
        <h1 className="text-lg font-semibold">
          AI Workbench <span className="text-indigo-400">JBetes</span>
        </h1>
        <nav className="flex gap-1 text-sm">
          {MODULOS.map((m) => (
            <button
              key={m.id}
              onClick={() => setActivo(m.id)}
              className={`rounded-md px-3 py-1 ${
                activo === m.id ? "bg-zinc-800 text-white" : "text-zinc-400 hover:bg-zinc-900 hover:text-zinc-200"
              }`}
            >
              {m.nombre}
              {m.capitulo && <span className="ml-1.5 text-[10px] text-indigo-400">{m.capitulo}</span>}
            </button>
          ))}
        </nav>
        <div className="ml-auto">
          <HealthBadge />
        </div>
      </header>
      <main className="min-h-0 flex-1 p-4">
        <Modulo />
      </main>
    </div>
  );
}
