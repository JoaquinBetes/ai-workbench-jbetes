// Registro de comandos para la paleta (Ctrl+K). La app registra los globales
// (navegación) y cada vista suma los suyos mientras está montada.
import { useEffect, useRef, useSyncExternalStore } from "react";

export type Comando = {
  id: string;
  titulo: string;
  grupo: string;
  /** Teclas a mostrar, por ejemplo ["Alt", "1"]. Solo informativo. */
  atajo?: string[];
  /** Palabras extra para la búsqueda. */
  claves?: string;
  ejecutar: () => void;
};

const fuentes = new Map<string, Comando[]>();
const oyentes = new Set<() => void>();
let lista: Comando[] = [];

function recalcular() {
  lista = [...fuentes.values()].flat();
  oyentes.forEach((o) => o());
}

export function registrar(fuente: string, comandos: Comando[]) {
  fuentes.set(fuente, comandos);
  recalcular();
  return () => {
    fuentes.delete(fuente);
    recalcular();
  };
}

export function useListaComandos() {
  return useSyncExternalStore(
    (o) => {
      oyentes.add(o);
      return () => oyentes.delete(o);
    },
    () => lista,
  );
}

/**
 * Registra los comandos de un componente. `comandos` puede cambiar en cada
 * render: se guarda la última versión y la paleta siempre ejecuta esa.
 */
export function useComandos(fuente: string, comandos: Comando[]) {
  const ultimo = useRef(comandos);
  ultimo.current = comandos;
  const firma = comandos.map((c) => `${c.id}:${c.titulo}`).join("|");

  useEffect(() => {
    const envueltos = ultimo.current.map((c) => ({
      ...c,
      ejecutar: () => ultimo.current.find((x) => x.id === c.id)?.ejecutar(),
    }));
    return registrar(fuente, envueltos);
  }, [fuente, firma]);
}

/** ¿El foco está en un lugar donde se escribe? (para no robar teclas). */
export function escribiendo(e: KeyboardEvent) {
  const el = e.target as HTMLElement | null;
  if (!el) return false;
  return el.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(el.tagName);
}
