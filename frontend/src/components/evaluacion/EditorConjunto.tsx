import { Plus, Trash2, X } from "lucide-react";
import { useId, useState } from "react";
import type { CasoEval, Conjunto } from "../../lib/evaluacion";

/**
 * Editor de un conjunto de casos: nombre, descripción y una fila por caso
 * (pregunta y respuesta de referencia). Pegar varias líneas en la primera
 * pregunta con el formato "pregunta | referencia" crea un caso por línea.
 */
export default function EditorConjunto({
  inicial,
  guardando,
  error,
  onGuardar,
  onCancelar,
}: {
  inicial: Conjunto | null;
  guardando: boolean;
  error: string | null;
  onGuardar: (datos: { nombre: string; descripcion: string; casos: CasoEval[] }) => void;
  onCancelar: () => void;
}) {
  const id = useId();
  const [nombre, setNombre] = useState(inicial?.nombre ?? "");
  const [descripcion, setDescripcion] = useState(inicial?.descripcion ?? "");
  const [casos, setCasos] = useState<CasoEval[]>(
    inicial?.casos.map((c) => ({ pregunta: c.pregunta, referencia: c.referencia })) ?? [{ pregunta: "", referencia: "" }],
  );
  const [aviso, setAviso] = useState<string | null>(null);

  const cambiar = (i: number, campo: keyof CasoEval, valor: string) =>
    setCasos((prev) => prev.map((c, j) => (j === i ? { ...c, [campo]: valor } : c)));

  const pegar = (i: number, texto: string) => {
    const lineas = texto.split(/\r?\n/).filter((l) => l.includes("|"));
    if (lineas.length < 2) return false;
    const nuevos = lineas.map((l) => {
      const [p, ...r] = l.split("|");
      return { pregunta: p.trim(), referencia: r.join("|").trim() };
    });
    setCasos((prev) => [...prev.slice(0, i), ...nuevos, ...prev.slice(i + 1)].filter((c) => c.pregunta || c.referencia));
    return true;
  };

  const guardar = () => {
    const completos = casos.filter((c) => c.pregunta.trim() || c.referencia.trim());
    if (!nombre.trim()) return setAviso("Ponele un nombre al conjunto.");
    if (!completos.length) return setAviso("Agregá al menos un caso.");
    const incompleto = completos.findIndex((c) => !c.pregunta.trim() || !c.referencia.trim());
    if (incompleto >= 0) return setAviso(`Al caso ${incompleto + 1} le falta la pregunta o la referencia.`);
    setAviso(null);
    onGuardar({ nombre: nombre.trim(), descripcion: descripcion.trim(), casos: completos });
  };

  return (
    <section className="panel enter flex min-h-0 flex-col" aria-labelledby={`${id}-t`}>
      <div className="panel-head">
        <h2 id={`${id}-t`} className="panel-title">
          {inicial ? "Editar conjunto" : "Conjunto nuevo"}
        </h2>
        <span className="panel-meta ml-auto">{casos.length} casos</span>
        <button type="button" className="btn btn--quiet btn--icon btn--sm" onClick={onCancelar} aria-label="Cerrar el editor">
          <X aria-hidden />
        </button>
      </div>
      <div className="grid gap-3 border-b border-line p-4 sm:grid-cols-[minmax(0,1fr)_minmax(0,2fr)]">
        <div>
          <label htmlFor={`${id}-n`} className="label mb-1.5 block">
            Nombre
          </label>
          <input id={`${id}-n`} className="field" value={nombre} maxLength={80} onChange={(e) => setNombre(e.target.value)} />
        </div>
        <div>
          <label htmlFor={`${id}-d`} className="label mb-1.5 block">
            Descripción (opcional)
          </label>
          <input id={`${id}-d`} className="field" value={descripcion} maxLength={500} onChange={(e) => setDescripcion(e.target.value)} />
        </div>
      </div>
      <p className="hint px-4 pt-3">
        Una fila por caso. Para cargar muchos de una vez, pegá líneas con el formato <span className="mono">pregunta | referencia</span> en
        cualquier pregunta.
      </p>
      <ol className="min-h-0 flex-1 space-y-2 overflow-y-auto p-4" aria-label="Casos">
        {casos.map((c, i) => (
          <li key={i} className="grid grid-cols-[2rem_minmax(0,3fr)_minmax(0,2fr)_2.5rem] items-start gap-2 max-sm:grid-cols-[2rem_minmax(0,1fr)_2.5rem]">
            <span className="num pt-2.5 text-label text-muted">{i + 1}</span>
            <textarea
              className="field prosa min-h-[40px] resize-y text-small [field-sizing:content]"
              rows={1}
              value={c.pregunta}
              placeholder="¿Cuál es la capital de Australia?"
              aria-label={`Pregunta del caso ${i + 1}`}
              onChange={(e) => cambiar(i, "pregunta", e.target.value)}
              onPaste={(e) => {
                if (pegar(i, e.clipboardData.getData("text"))) e.preventDefault();
              }}
            />
            <textarea
              className="field prosa min-h-[40px] resize-y text-small [field-sizing:content] max-sm:col-start-2"
              rows={1}
              value={c.referencia}
              placeholder="Canberra"
              aria-label={`Referencia del caso ${i + 1}`}
              onChange={(e) => cambiar(i, "referencia", e.target.value)}
            />
            <button
              type="button"
              className="btn btn--quiet btn--icon max-sm:col-start-3 max-sm:row-start-1"
              onClick={() => setCasos((prev) => (prev.length > 1 ? prev.filter((_, j) => j !== i) : [{ pregunta: "", referencia: "" }]))}
              aria-label={`Quitar el caso ${i + 1}`}
            >
              <Trash2 aria-hidden />
            </button>
          </li>
        ))}
      </ol>
      <div className="flex flex-wrap items-center gap-2 border-t border-line p-3">
        <button type="button" className="btn" onClick={() => setCasos((prev) => [...prev, { pregunta: "", referencia: "" }])}>
          <Plus aria-hidden /> Agregar caso
        </button>
        {(aviso || error) && (
          <p className="text-label text-danger" role="alert">
            {aviso ?? error}
          </p>
        )}
        <span className="ml-auto flex gap-2">
          <button type="button" className="btn" onClick={onCancelar}>
            Cancelar
          </button>
          <button type="button" className="btn btn--primary" onClick={guardar} disabled={guardando}>
            {guardando ? "Guardando…" : "Guardar conjunto"}
          </button>
        </span>
      </div>
    </section>
  );
}
