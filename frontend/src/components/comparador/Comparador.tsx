import { useState } from "react";
import LadoALado from "./LadoALado";
import Variabilidad from "./Variabilidad";

// Los tres modos del comparador (capítulo 2). Se van habilitando de a uno.
const MODOS = [
  { id: "lado-a-lado", nombre: "Modelos lado a lado", listo: true },
  { id: "variabilidad", nombre: "Variabilidad", listo: true },
  { id: "estructuradas", nombre: "Salidas estructuradas", listo: false },
] as const;

type IdModo = (typeof MODOS)[number]["id"];

export default function Comparador() {
  const [modo, setModo] = useState<IdModo>("lado-a-lado");

  return (
    <div className="flex h-full min-h-0 flex-col gap-3">
      <div className="flex gap-1 text-sm">
        {MODOS.map((m) => (
          <button
            key={m.id}
            onClick={() => m.listo && setModo(m.id)}
            title={m.listo ? undefined : "Próxima entrega"}
            className={`rounded-md px-3 py-1 ${
              modo === m.id
                ? "bg-zinc-800 text-white"
                : m.listo
                  ? "text-zinc-400 hover:bg-zinc-900"
                  : "cursor-default text-zinc-600"
            }`}
          >
            {m.nombre}
            {!m.listo && <span className="ml-1.5 text-[10px]">pronto</span>}
          </button>
        ))}
      </div>
      <div className="min-h-0 flex-1">
        {modo === "lado-a-lado" && <LadoALado />}
        {modo === "variabilidad" && <Variabilidad />}
      </div>
    </div>
  );
}
