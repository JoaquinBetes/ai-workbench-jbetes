import { RotateCcw } from "lucide-react";
import { escenaEnso } from "../lib/ascii";
import { Giro } from "./ascii/Texto";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { EVENTO_ENFOCAR } from "../App";
import { escribiendo, useComandos } from "../lib/comandos";
import { num, segundos } from "../lib/formato";
import { useModelos } from "../lib/useModelos";
import { useStreamingChat } from "../lib/useStreamingChat";
import TextoTokens from "./playground/TextoTokens";
import { Interruptor } from "./ui/Controles";
import Compositor from "./ui/Compositor";
import SelectorModelo from "./ui/SelectorModelo";
import { EncabezadoVista, Vacio } from "./ui/Vista";

/** Chat simple: para conversar con un modelo sin instrumentos de por medio. */
export default function Chat({ activa = true }: { activa?: boolean }) {
  const { modelos, preferido, error: errorModelos } = useModelos();
  const [modelo, setModelo] = useState("");
  const [entrada, setEntrada] = useState("");
  const [marcar, setMarcar] = useState(true);
  const { turnos, generando, error, enviar, detener, reiniciar } = useStreamingChat();
  const scroll = useRef<HTMLDivElement>(null);
  const prompt = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (!modelo && preferido) setModelo(preferido);
  }, [preferido, modelo]);

  useLayoutEffect(() => {
    const el = scroll.current;
    if (el && turnos.length && el.scrollHeight - el.scrollTop - el.clientHeight < 160) el.scrollTop = el.scrollHeight;
  });

  function mandar() {
    enviar(entrada, modelo);
    setEntrada("");
  }

  function nueva() {
    reiniciar();
    prompt.current?.focus();
  }

  const detenerRef = useRef(detener);
  detenerRef.current = detener;
  useEffect(() => {
    if (!activa) return;
    const alTeclear = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !escribiendo(e) && !document.querySelector(".overlay")) detenerRef.current();
    };
    const enfocar = (e: Event) => (e as CustomEvent).detail === "chat" && prompt.current?.focus();
    window.addEventListener("keydown", alTeclear);
    window.addEventListener(EVENTO_ENFOCAR, enfocar);
    return () => {
      window.removeEventListener("keydown", alTeclear);
      window.removeEventListener(EVENTO_ENFOCAR, enfocar);
    };
  }, [activa]);

  useComandos(
    "chat",
    activa
      ? [
          { id: "chat-nueva", titulo: "Nueva conversación en el chat", grupo: "Chat", ejecutar: nueva },
          { id: "chat-marcas", titulo: marcar ? "Chat: quitar las marcas de duda" : "Chat: marcar la duda de cada token", grupo: "Chat", ejecutar: () => setMarcar((m) => !m) },
        ]
      : [],
  );

  return (
    <div className="flex h-full flex-col px-3 pb-3 max-lg:h-auto max-lg:min-h-[calc(100vh-var(--bar-top)-var(--bar-bottom))]">
      <EncabezadoVista
        titulo="Chat"
        descripcion="Conversación libre con un modelo, con la duda de cada token a la vista."
        acciones={
          <>
            <div className="w-64 max-sm:w-full">
              <SelectorModelo modelos={modelos} valor={modelo} onChange={setModelo} />
            </div>
            <div className="w-44">
              <Interruptor valor={marcar} onChange={setMarcar}>
                Marcar la duda
              </Interruptor>
            </div>
            <button type="button" onClick={nueva} className="btn btn--sm" disabled={!turnos.length}>
              <RotateCcw aria-hidden /> Nueva conversación
            </button>
          </>
        }
      />

      <div ref={scroll} className="min-h-0 flex-1 overflow-y-auto">
        <div className="mx-auto flex min-h-full max-w-[760px] flex-col px-3">
          {turnos.length === 0 ? (
            <div className="flex-1">
              <Vacio escena={escenaEnso} etiquetaEscena="Un ensō, el círculo zen de un trazo, dibujado con caracteres" titulo="Escribile algo al modelo">
                Pasá el mouse por un token de la respuesta para ver con qué probabilidad lo eligió.
              </Vacio>
            </div>
          ) : (
            <div className="space-y-6 py-4">
              {turnos.map((t, i) =>
                t.role === "user" ? (
                  <div key={i} className="rise-in flex justify-end">
                    <p className="max-w-[80%] whitespace-pre-wrap border border-line-2 bg-raised px-4 py-2.5 text-body text-ink">
                      {t.content}
                    </p>
                  </div>
                ) : (
                  <div key={i} className="rise-in space-y-2">
                    <div className="flex items-center gap-2 text-label text-muted">
                      <span className="live live--idle" aria-hidden />
                      <span className="dot">{modelo}</span>
                    </div>
                    {t.tokens?.length ? (
                      <TextoTokens
                        tokens={t.tokens}
                        modo={marcar ? "duda" : "ninguno"}
                        seleccionado={null}
                        onSeleccionar={() => {}}
                        cursor={generando && i === turnos.length - 1}
                      />
                    ) : (
                      <div className="tokens">
                        {t.content}
                        {generando && i === turnos.length - 1 && (
                          <span className="flex items-center gap-2 text-label text-muted">
                            <Giro /> pensando…
                          </span>
                        )}
                      </div>
                    )}
                    {t.stats && (
                      <p className="num text-label text-muted">
                        {t.stats.output_tokens} tokens · {num(t.stats.tokens_per_second, 1)} tok/s · primer token en{" "}
                        {segundos(t.stats.time_to_first_token_s)}
                      </p>
                    )}
                  </div>
                ),
              )}
            </div>
          )}
        </div>
      </div>

      {(error || errorModelos) && (
        <p className="tag tag--danger mx-auto mb-2 h-auto max-w-[760px] py-1">{error ?? errorModelos}</p>
      )}

      <div className="mx-auto w-full max-w-[784px] px-3 pt-2 max-lg:sticky max-lg:bottom-0 max-lg:z-30 max-lg:bg-[var(--bg)] max-lg:pb-2">
        <Compositor
          entradaRef={prompt}
          valor={entrada}
          onCambio={setEntrada}
          onEnviar={mandar}
          onDetener={detener}
          generando={generando}
          deshabilitado={!modelo}
          etiqueta="mensaje para el modelo"
          placeholder="Escribí tu mensaje"
          chip={modelo || "sin modelo"}
          ejemplos={turnos.length ? [] : ["¿Qué es un token?", "Recomendame un libro de ciencia ficción corto"]}
        />
      </div>
    </div>
  );
}
