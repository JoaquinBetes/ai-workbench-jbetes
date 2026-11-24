import { lazy, Suspense, type ComponentProps } from "react";
import { Giro } from "../ascii/Texto";

// three.js pesa: los gráficos 3D se cargan recién cuando hacen falta.
const CordilleraDiferida = lazy(() => import("./Cordillera3D"));
const BarrasDiferidas = lazy(() => import("./Barras3D"));

function Cargando({ alto = 300 }: { alto?: number }) {
  return (
    <div className="flex items-center justify-center gap-2 text-label text-muted" style={{ height: alto }}>
      <Giro /> cargando el gráfico 3D…
    </div>
  );
}

export function Cordillera(props: ComponentProps<typeof CordilleraDiferida>) {
  return (
    <Suspense fallback={<Cargando alto={props.alto} />}>
      <CordilleraDiferida {...props} />
    </Suspense>
  );
}

export function Barras(props: ComponentProps<typeof BarrasDiferidas>) {
  return (
    <Suspense fallback={<Cargando alto={props.alto} />}>
      <BarrasDiferidas {...props} />
    </Suspense>
  );
}
