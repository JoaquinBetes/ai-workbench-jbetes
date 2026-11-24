import { useState } from "react";
import { crearEscenaFondo } from "../../lib/ascii";
import LienzoAscii from "./LienzoAscii";

/**
 * Fondo vivo de la app: una placa de circuito en ASCII, casi apagada, con
 * señales que recorren las pistas. Cada token que genera el modelo dispara un
 * pulso. Detrás de todo; se puede apagar desde la barra de estado o la paleta.
 */
export default function Fondo({ apagado }: { apagado: boolean }) {
  const [escena] = useState(crearEscenaFondo);
  return (
    // La placa vive en los márgenes: hacia el centro, donde está el trabajo, se apaga.
    <div className="fondo-placa pointer-events-none fixed inset-0 z-0" aria-hidden>
      {!apagado && <LienzoAscii escena={escena} celda={16} fps={15} interactivo />}
    </div>
  );
}
