import { useEffect, useState } from "react";
import Fondo from "./components/ascii/Fondo";
import Chat from "./components/Chat";
import Comparador, { MODOS_COMPARADOR, type IdModo } from "./components/comparador/Comparador";
import Evaluacion from "./components/evaluacion/Evaluacion";
import Playground from "./components/playground/Playground";
import { BarraEstado, BarraSuperior, HojaAtajos, PaletaComandos, VISTAS, type IdVista } from "./components/shell/Shell";
import { escribiendo, useComandos } from "./lib/comandos";
import { movimiento, useMovimiento } from "./lib/movimiento";

/** Las vistas piden el foco del prompt con este evento (atajo "/"). */
export const EVENTO_ENFOCAR = "workbench:enfocar-prompt";

export default function App() {
  const [vista, setVista] = useState<IdVista>("playground");
  const [visitadas, setVisitadas] = useState<Set<IdVista>>(() => new Set(["playground"]));
  const [modoComparador, setModoComparador] = useState<IdModo>("lado-a-lado");
  const [paleta, setPaleta] = useState(false);
  const [atajos, setAtajos] = useState(false);
  // El fondo animado se puede apagar; la preferencia queda en este navegador.
  const [fondoApagado, setFondoApagado] = useState(() => {
    try {
      return localStorage.getItem("workbench:fondo") === "apagado";
    } catch {
      return false;
    }
  });
  const alternarFondo = () =>
    setFondoApagado((a) => {
      try {
        localStorage.setItem("workbench:fondo", a ? "vivo" : "apagado");
      } catch {
        /* sin almacenamiento: solo dura esta sesión */
      }
      return !a;
    });

  // Una vista que ya se mostró no repite sus entradas al volver: cambiar de
  // vista es frecuente (y muchas veces con el teclado), así que es instantáneo.
  const [quietas, setQuietas] = useState<Set<IdVista>>(() => new Set());
  const ir = (v: IdVista) => {
    setQuietas((prev) => (prev.has(vista) ? prev : new Set(prev).add(vista)));
    setVista(v);
    setVisitadas((prev) => (prev.has(v) ? prev : new Set(prev).add(v)));
  };
  const enMovimiento = useMovimiento();

  useComandos("app", [
    ...VISTAS.map((v) => ({
      id: `ir-${v.id}`,
      titulo: `Ir a ${v.nombre}`,
      grupo: "Navegación",
      atajo: ["Alt", v.tecla],
      ejecutar: () => ir(v.id),
    })),
    ...MODOS_COMPARADOR.map((m) => ({
      id: `comparador-${m.id}`,
      titulo: `Comparador: ${m.nombre}`,
      grupo: "Navegación",
      claves: m.claves,
      ejecutar: () => {
        ir("comparador");
        setModoComparador(m.id);
      },
    })),
    { id: "atajos", titulo: "Ver los atajos de teclado", grupo: "Ayuda", atajo: ["?"], ejecutar: () => setAtajos(true) },
    {
      id: "movimiento",
      titulo: enMovimiento ? "Pausar las animaciones" : "Reanudar las animaciones",
      grupo: "Apariencia",
      claves: "movimiento animación ascii quieto",
      ejecutar: movimiento.alternar,
    },
    {
      id: "fondo",
      titulo: fondoApagado ? "Mostrar la placa del fondo" : "Ocultar la placa del fondo",
      grupo: "Apariencia",
      claves: "fondo placa circuito ascii",
      ejecutar: alternarFondo,
    },
  ]);

  // Atajos globales. Las acciones de teclado nunca se animan: la vista cambia al instante.
  useEffect(() => {
    const alTeclear = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setAtajos(false);
        setPaleta((p) => !p);
        return;
      }
      const digito = /^Digit([1-4])$/.exec(e.code);
      if (digito && (e.altKey || e.ctrlKey || e.metaKey) && !e.shiftKey) {
        e.preventDefault();
        ir(VISTAS[Number(digito[1]) - 1].id);
        return;
      }
      if (paleta || atajos || escribiendo(e) || e.ctrlKey || e.metaKey || e.altKey) return;
      if (e.key === "?") {
        e.preventDefault();
        setAtajos(true);
      } else if (e.key === "/") {
        e.preventDefault();
        window.dispatchEvent(new CustomEvent(EVENTO_ENFOCAR, { detail: vista }));
      }
    };
    window.addEventListener("keydown", alTeclear);
    return () => window.removeEventListener("keydown", alTeclear);
  }, [paleta, atajos, vista]);

  // Tooltips: después del primero, los siguientes aparecen sin demora.
  useEffect(() => {
    let encender: ReturnType<typeof setTimeout> | undefined;
    let apagar: ReturnType<typeof setTimeout> | undefined;
    const raiz = document.documentElement;
    const sobre = (e: PointerEvent) => {
      if (!(e.target as Element).closest?.("[data-tip]")) return;
      clearTimeout(apagar);
      encender = setTimeout(() => raiz.classList.add("tips-calientes"), 450);
    };
    const fuera = (e: PointerEvent) => {
      if (!(e.target as Element).closest?.("[data-tip]")) return;
      clearTimeout(encender);
      apagar = setTimeout(() => raiz.classList.remove("tips-calientes"), 700);
    };
    document.addEventListener("pointerover", sobre);
    document.addEventListener("pointerout", fuera);
    return () => {
      document.removeEventListener("pointerover", sobre);
      document.removeEventListener("pointerout", fuera);
    };
  }, []);

  return (
    <>
      <a href="#contenido" className="salto">
        Saltar al contenido
      </a>
      <Fondo apagado={fondoApagado} />
      <div className="relative z-10 flex h-full flex-col max-lg:h-auto max-lg:min-h-full">
        <BarraSuperior vista={vista} onVista={ir} onPaleta={() => setPaleta(true)} />
        <main id="contenido" tabIndex={-1} className="relative min-h-0 flex-1 outline-none max-lg:flex-none">
          {/* Las vistas quedan montadas: cambiar de vista no pierde la conversación. */}
          {visitadas.has("playground") && (
            <div hidden={vista !== "playground"} className={`h-full max-lg:h-auto ${quietas.has("playground") ? "quieta" : ""}`}>
              <Playground activa={vista === "playground"} />
            </div>
          )}
          {visitadas.has("comparador") && (
            <div hidden={vista !== "comparador"} className={`h-full max-lg:h-auto ${quietas.has("comparador") ? "quieta" : ""}`}>
              <Comparador activa={vista === "comparador"} modo={modoComparador} onModo={setModoComparador} />
            </div>
          )}
          {visitadas.has("evaluacion") && (
            <div hidden={vista !== "evaluacion"} className={`h-full max-lg:h-auto ${quietas.has("evaluacion") ? "quieta" : ""}`}>
              <Evaluacion activa={vista === "evaluacion"} />
            </div>
          )}
          {visitadas.has("chat") && (
            <div hidden={vista !== "chat"} className={`h-full max-lg:h-auto ${quietas.has("chat") ? "quieta" : ""}`}>
              <Chat activa={vista === "chat"} />
            </div>
          )}
        </main>
        <BarraEstado onAtajos={() => setAtajos(true)} />
      </div>
      {paleta && <PaletaComandos onCerrar={() => setPaleta(false)} />}
      {atajos && <HojaAtajos onCerrar={() => setAtajos(false)} />}
    </>
  );
}
