// Un solo interruptor para todo lo que se mueve solo: la placa del fondo, las
// escenas ASCII, el vaivén de los gráficos 3D, el LED y el cursor.
// WCAG 2.2.2 (Pausar, detener, ocultar): lo que se mueve más de cinco segundos
// en paralelo con el contenido tiene que poder pausarse, y al reanudar sigue
// desde donde quedó. Arranca en pausa si el sistema pide reducir movimiento.

import { useSyncExternalStore } from "react";

const CLAVE = "workbench:movimiento";

function inicial() {
  try {
    const guardado = localStorage.getItem(CLAVE);
    if (guardado) return guardado === "si";
  } catch {
    /* sin almacenamiento: se usa la preferencia del sistema */
  }
  return !window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

let activo = inicial();
const avisos = new Set<() => void>();

function reflejar() {
  document.documentElement.dataset.movimiento = activo ? "si" : "pausa";
}
reflejar();

export const movimiento = {
  activo: () => activo,
  poner(valor: boolean) {
    activo = valor;
    try {
      localStorage.setItem(CLAVE, valor ? "si" : "no");
    } catch {
      /* la preferencia vale solo para esta visita */
    }
    reflejar();
    avisos.forEach((f) => f());
  },
  alternar() {
    movimiento.poner(!activo);
  },
  suscribir(f: () => void) {
    avisos.add(f);
    return () => avisos.delete(f);
  },
};

export function useMovimiento() {
  return useSyncExternalStore(movimiento.suscribir, movimiento.activo);
}
