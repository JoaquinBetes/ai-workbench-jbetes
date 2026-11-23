import { ArrowUp, Square } from "lucide-react";
import { useEffect, useId, useLayoutEffect, useRef, type ReactNode, type RefObject } from "react";

// El campo de prompt es el "fx-prompt" del kit de la skill de taste: una luz
// lenta recorre su borde (edge-glow, WebGL). Es el único efecto de cada vista.
// El kit vive en /public/assets y se carga tal cual, sin modificarlo.
type Instancia = { destroy?: () => void };

function relabelPausa(raiz: HTMLElement) {
  const btn = raiz.querySelector<HTMLButtonElement>(".cx-pause");
  if (!btn) return;
  const pausado = btn.classList.contains("is-paused");
  const texto = pausado ? "Reanudar la luz del campo" : "Pausar la luz del campo";
  btn.setAttribute("aria-label", texto);
  btn.title = texto;
}

export default function PromptLuminoso({
  valor,
  onCambio,
  onEnviar,
  onDetener,
  generando = false,
  deshabilitado = false,
  placeholder,
  etiqueta,
  ejemplos = [],
  chip,
  herramientas,
  entradaRef,
  textoEnviar = "Enviar",
}: {
  valor: string;
  onCambio: (v: string) => void;
  onEnviar: () => void;
  onDetener?: () => void;
  generando?: boolean;
  deshabilitado?: boolean;
  placeholder: string;
  etiqueta: string;
  ejemplos?: string[];
  chip?: ReactNode;
  herramientas?: ReactNode;
  entradaRef?: RefObject<HTMLTextAreaElement | null>;
  textoEnviar?: string;
}) {
  const raiz = useRef<HTMLFormElement>(null);
  const propia = useRef<HTMLTextAreaElement>(null);
  const entrada = entradaRef ?? propia;
  const id = useId();

  // Monta el efecto del kit una vez; se libera al desmontar.
  useEffect(() => {
    const el = raiz.current;
    if (!el) return;
    let instancia: Instancia | null = null;
    let vivo = true;
    const url = new URL("/assets/components/fx-prompt/component.js", window.location.origin).href;
    import(/* @vite-ignore */ url)
      .then((m: { default: (root: HTMLElement) => Instancia }) => {
        if (!vivo) return;
        instancia = m.default(el);
        relabelPausa(el);
      })
      .catch(() => {
        // Sin WebGL o sin el kit, queda la tarjeta lisa: el campo funciona igual.
      });
    const alPausar = () => relabelPausa(el);
    el.addEventListener("cx-pause", alPausar);
    return () => {
      vivo = false;
      el.removeEventListener("cx-pause", alPausar);
      instancia?.destroy?.();
    };
  }, []);

  // El campo crece con el texto, hasta 200 px.
  useLayoutEffect(() => {
    const t = entrada.current;
    if (!t) return;
    t.style.height = "auto";
    t.style.height = `${Math.min(t.scrollHeight, 200)}px`;
  }, [valor, entrada]);

  const puedeEnviar = !!valor.trim() && !deshabilitado && !generando;

  return (
    <div className="composer">
      <form
        ref={raiz}
        className="cx cx-prompt"
        data-cx-seed="3"
        onSubmit={(e) => {
          e.preventDefault();
          if (puedeEnviar) onEnviar();
        }}
      >
        <div className="cx-prompt__box">
          <label className="cx-sr" htmlFor={id}>
            {etiqueta}
          </label>
          <textarea
            ref={entrada}
            id={id}
            className="cx-prompt__input"
            rows={2}
            value={valor}
            placeholder={placeholder}
            onChange={(e) => onCambio(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
                e.preventDefault();
                if (puedeEnviar) onEnviar();
              } else if (e.key === "Escape" && generando && onDetener) {
                e.preventDefault();
                onDetener();
              }
            }}
          />
          <div className="cx-prompt__bar">
            {chip && (
              <span className="cx-prompt__chip">
                <span className="cx-prompt__dot" aria-hidden />
                {chip}
              </span>
            )}
            {herramientas}
            <span className="ml-auto" />
            {generando && onDetener ? (
              <button type="button" onClick={onDetener} className="cx-prompt__send cx-prompt__send--stop">
                <Square className="h-3 w-3 fill-current" aria-hidden />
                Detener
                <kbd className="kbd">Esc</kbd>
              </button>
            ) : (
              <button type="submit" disabled={!puedeEnviar} className="cx-prompt__send" style={{ marginLeft: 0 }}>
                <ArrowUp className="h-3.5 w-3.5" aria-hidden />
                {textoEnviar}
              </button>
            )}
          </div>
        </div>
        {/* La fila de abajo siempre está: ejemplos o atajos. La pausa de la luz se ubica al final. */}
        <ul className="cx-prompt__hints" aria-label={ejemplos.length ? "Ejemplos de prompt" : "Atajos del campo"}>
          {ejemplos.length > 0 ? (
            ejemplos.map((ej) => (
              <li key={ej}>
                <button type="button" onClick={() => onCambio(ej)}>
                  {ej}
                </button>
              </li>
            ))
          ) : (
            <li className="flex h-[30px] items-center gap-4 text-label text-muted">
              <span className="flex items-center gap-1.5">
                <kbd className="kbd">↵</kbd> enviar
              </span>
              <span className="flex items-center gap-1.5">
                <kbd className="kbd">Shift</kbd>
                <kbd className="kbd">↵</kbd> salto de línea
              </span>
              <span className="flex items-center gap-1.5">
                <kbd className="kbd">/</kbd> volver al campo
              </span>
            </li>
          )}
        </ul>
      </form>
    </div>
  );
}
