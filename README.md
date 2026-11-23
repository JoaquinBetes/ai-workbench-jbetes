# AI Workbench JBetes

Plataforma web propia para experimentar con modelos de lenguaje locales, construida
módulo a módulo mientras leo *AI Engineering* (Chip Huyen). Corre en mi servidor
casero con una RTX 3060 Ti y Ollama, y se accede desde cualquier lado por Tailscale.

## Stack

| Capa | Tecnología |
|---|---|
| Backend | Python · FastAPI · cliente oficial de Ollama |
| Frontend | React 19 · TypeScript · Vite · Tailwind CSS |
| Comunicación | API REST + Server-Sent Events (streaming de tokens) |
| Modelos | Ollama, corriendo directo en el servidor |
| Despliegue | Docker Compose (una sola imagen sirve API y frontend) |

## Estructura

```
ai-workbench-jbetes/
├── backend/
│   ├── pyproject.toml          dependencias de Python
│   └── app/
│       ├── main.py             arranque de FastAPI, /api/health, sirve el frontend
│       ├── config.py           configuración (OLLAMA_HOST, etc.)
│       ├── ollama_client.py    cliente de Ollama compartido
│       ├── structured.py       extraer, reparar, validar y puntuar JSON
│       └── routers/
│           ├── models.py       GET  /api/models          modelos disponibles
│           ├── structured.py   POST /api/structured/sample  salidas estructuradas (3 métodos)
│           └── chat.py         POST /api/chat/stream     chat con streaming y logprobs
│                               POST /api/chat/continue   seguir una respuesta desde un prefijo (ramas)
├── frontend/
│   ├── package.json
│   ├── vite.config.ts          en desarrollo reenvía /api al backend
│   ├── public/assets/          kit de la skill de taste (luz del campo de prompt), tal cual
│   └── src/
│       ├── App.tsx                 shell: vistas, atajos globales, paleta de comandos
│       ├── index.css               sistema visual (tokens, paneles, botones, movimiento)
│       ├── lib/
│       │   ├── api.ts              cliente de la API (incluye el lector de SSE)
│       │   ├── telemetria.ts       velocidad en vivo, historial de la sesión, salud
│       │   ├── comandos.ts         registro de comandos para la paleta (Ctrl+K)
│       │   ├── formato.ts          números con formato argentino
│       │   ├── useStreamingChat.ts hook de conversación con streaming
│       │   ├── probs.ts            probabilidad, entropía, duda, perplejidad
│       │   ├── agrupar.ts          agrupar respuestas iguales y su entropía
│       │   ├── ramas.ts            modelo de datos de las ramas
│       │   └── useModelos.ts       lista de modelos de Ollama
│       └── components/
│           ├── shell/              barra superior, barra de estado, paleta y atajos
│           ├── ui/                 piezas compartidas (controles, selector de modelo, prompt)
│           ├── Chat.tsx            chat simple
│           ├── playground/         capítulo 2: playground, inspector y ramas
│           └── comparador/         capítulo 2: comparador de modelos
├── Dockerfile
├── docker-compose.yml
└── .env.example
```

## Hoja de ruta (un módulo por capítulo)

- [x] **Base:** chat con streaming y tokens coloreados por probabilidad
- [x] **Cap. 2 · Entrega 1 — Playground:** controles de sampling, inspector de tokens con alternativas, métricas (confianza, perplejidad, token más dudoso)
- [x] **Cap. 2 · Entrega 2 — Ramas:** forzar un token alternativo, seguir la respuesta desde ahí y navegar las ramas en un árbol
- [x] **Cap. 2 · Entrega 3a — Comparador, lado a lado:** el mismo prompt a varios modelos, con métricas y gráficos de resumen
- [x] **Cap. 2 · Entrega 3b — Variabilidad:** el mismo prompt N veces, histograma de respuestas, respuesta mayoritaria, entropía e historial por temperatura
- [x] **Cap. 2 · Entrega 3c — Salidas estructuradas:** solo prompt vs. post-proceso vs. sampling restringido, con validez, esquema y exactitud
- [x] **Rediseño de la interfaz:** sistema visual propio, barra de estado con telemetría en vivo, paleta de comandos y atajos de teclado
- [ ] **Cap. 3-4 — Arena y evaluador:** comparaciones a ciegas, ranking Elo, datasets de prueba, LLM juez
- [ ] **Cap. 5 — Prompt studio:** versionado, A/B, pruebas de inyección
- [ ] **Cap. 6 — RAG y agentes:** documentos, chunks, mapa de embeddings, trazas de agente
- [ ] **Cap. 7-8 — Fine-tuning studio:** datos sintéticos, QLoRA, curva de pérdida, publicar en Ollama
- [ ] **Cap. 9 — Panel de inferencia:** TTFT, tokens/s, VRAM, pruebas de carga
- [ ] **Cap. 10 — Gateway y observabilidad:** guardrails, caché, trazas, feedback

## Interfaz

Tema oscuro único, pensado como un instrumento de laboratorio. La paleta (soot-pale-lime), la
tipografía (Funnel Display, Funnel Sans y DM Mono) y los radios (sharp) los repartió la skill
de taste; las fuentes están dentro del proyecto, así que funciona sin internet.

| Atajo | Qué hace |
|---|---|
| `Ctrl` `K` | Paleta de comandos |
| `Alt` `1` / `2` / `3` | Playground, Comparador, Chat (Chrome se reserva Ctrl + número) |
| `/` | Escribir en el prompt de la vista |
| `←` `→` | Recorrer los tokens en el inspector |
| `1` … `9` | Forzar esa alternativa del token elegido (crea una rama) |
| `Esc` | Detener la generación o soltar el token |
| `?` | Lista de atajos |

## Desarrollo (en el servidor, con VS Code Remote)

Requisitos: `uv` y Node.js 22+.

**Backend** (terminal 1):
```bash
cd backend
uv sync
uv run uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```
Documentación interactiva de la API: `http://<servidor>:8000/docs`

**Tests del backend:**
```bash
cd backend
uv run --group dev pytest
```

**Frontend** (terminal 2):
```bash
cd frontend
npm install
npm run dev
```
App en modo desarrollo: `http://<servidor>:5173` (se recarga sola al guardar cambios).

## Producción (Docker)

```bash
docker compose up -d --build
```
App: `http://<servidor>:8501`. Arranca sola cuando se prende el servidor.

Para actualizar después de cambios: `docker compose up -d --build`.
Logs: `docker compose logs -f`.
