import { escenaFondo } from "../../lib/ascii";
import LienzoAscii from "./LienzoAscii";

/**
 * Fondo vivo de la app: una niebla de caracteres casi invisible que deriva y
 * se aviva alrededor del puntero. Detrás de todo; se puede apagar desde la
 * barra de estado o la paleta de comandos.
 */
export default function Fondo({ apagado }: { apagado: boolean }) {
  return (
    <div className="pointer-events-none fixed inset-0 z-0" aria-hidden>
      {!apagado && <LienzoAscii escena={escenaFondo} celda={16} fps={12} interactivo />}
    </div>
  );
}
