# AI Workbench JBetes

Plataforma web propia para experimentar con modelos de lenguaje locales, construida
módulo a módulo mientras leo *AI Engineering* (Chip Huyen). Corre en mi servidor
casero con una RTX 3060 Ti y Ollama, y se accede desde cualquier lado por Tailscale.

## Stack

| Capa | Tecnología |
|---|---|
| Backend | Python · FastAPI · cliente oficial de Ollama |
| Frontend | React 19 · TypeScript · Vite · Tailwind CSS · three.js (React Three Fiber) |
| Comunicación | API REST + Server-Sent Events (streaming de tokens) |
| Modelos | Ollama, corriendo directo en el servidor |
| Datos | PostgreSQL 18 con pgvector · SQLAlchemy (async) · Alembic |
| Despliegue | Docker Compose (una sola imagen sirve API y frontend) |

## Estructura

```
ai-workbench-jbetes/
├── backend/
│   ├── pyproject.toml          dependencias de Python
│   ├── alembic.ini · migrations/   migraciones de la base (Alembic)
│   ├── tests/                  pytest (plantilla, salidas estructuradas, métricas)
│   └── app/
│       ├── main.py             arranque de FastAPI, /api/health, sirve el frontend
│       ├── config.py           configuración (OLLAMA_HOST, DATABASE_URL, etc.)
│       ├── db.py               conexión a Postgres (SQLAlchemy async)
│       ├── ollama_client.py    cliente de Ollama compartido
│       ├── structured.py       extraer, reparar, validar y puntuar JSON
│       ├── eval/
│       │   ├── modelos.py      tablas: conjuntos, casos, corridas, resultados, embeddings
│       │   ├── metricas.py     exacta, normalizada, contiene, edición, ROUGE-L, BLEU, coseno, perplejidad
│       │   ├── arranque.py     migraciones al iniciar y carga de los conjuntos curados
│       │   └── conjuntos/      los conjuntos curados (JSON)
│       └── routers/
│           ├── models.py       GET  /api/models          modelos disponibles
│           ├── structured.py   POST /api/structured/sample  salidas estructuradas (3 métodos)
│           ├── chat.py         POST /api/chat/stream     chat con streaming y logprobs
│           │                   POST /api/chat/continue   seguir una respuesta desde un prefijo (ramas)
│           └── evaluacion.py   /api/eval/conjuntos        conjuntos de casos (CRUD)
│                               POST /api/eval/corridas    evaluar modelos contra un conjunto (SSE)
│                               GET  /api/eval/mapa        embeddings proyectados a 3D
├── frontend/
│   ├── package.json
│   ├── vite.config.ts          en desarrollo reenvía /api al backend
│   ├── scripts/revisar-diseno.mjs  comprueba las reglas de DESIGN.md (npm run lint:diseno)
│   └── src/
│       ├── App.tsx                 shell: vistas, atajos globales, paleta de comandos, fondo vivo
│       ├── index.css               sistema visual (tokens, paneles, botones, movimiento)
│       ├── lib/
│       │   ├── ascii.ts            motor de arte ASCII: placa con pulsos, chip, globo, ojo y más
│       │   ├── tintas.ts           los colores de index.css en hex, para three.js y recharts
│       │   ├── movimiento.ts       un solo interruptor para pausar todo lo que se mueve
│       │   ├── paisaje.ts          datos de la cordillera 3D (una cresta por token)
│       │   ├── api.ts              cliente de la API (incluye el lector de SSE)
│       │   ├── evaluacion.ts       cliente de la evaluación (conjuntos, corridas, mapa)
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
│           ├── ui/                 piezas compartidas (controles, selector de modelo, compositor)
│           ├── ascii/              lienzo ASCII, fondo vivo y efectos de texto (descifrar, barras)
│           ├── graficos3d/         cordillera, barras y nube de embeddings en 3D, con modo ASCII
│           ├── Chat.tsx            chat simple
│           ├── playground/         capítulo 2: playground, inspector y ramas
│           ├── comparador/         capítulo 2: comparador de modelos
│           └── evaluacion/         capítulo 3: evaluación con referencia
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
- [x] **Modo texto:** arte ASCII animado y gráficos 3D con modo ASCII
- [x] **Fósforo:** consola de los 90 en verde fósforo sobre una placa de circuito; cada token dispara un pulso
- [x] **Pulido:** contraste, tipografía de lectura, menos ruido, control de movimiento y accesibilidad WCAG 2.2 AA
- [x] **Cap. 3 · Entrega 4a — Evaluación con referencia:** conjuntos de casos (curados y propios), siete métricas contra la respuesta correcta, similitud de embeddings, mapa 3D e historial en Postgres
- [ ] **Cap. 3-4 · Entrega 4b — LLM juez:** criterios, rúbricas y sesgos del juez (posición, largo, propio)
- [ ] **Cap. 3-4 · Entrega 4c — Arena:** comparaciones a ciegas y ranking Elo / Bradley-Terry
- [ ] **Cap. 5 — Prompt studio:** versionado, A/B, pruebas de inyección
- [ ] **Cap. 6 — RAG y agentes:** documentos, chunks, mapa de embeddings, trazas de agente
- [ ] **Cap. 7-8 — Fine-tuning studio:** datos sintéticos, QLoRA, curva de pérdida, publicar en Ollama
- [ ] **Cap. 9 — Panel de inferencia:** TTFT, tokens/s, VRAM, pruebas de carga
- [ ] **Cap. 10 — Gateway y observabilidad:** guardrails, caché, trazas, feedback

## Interfaz

"Fósforo": una consola de los 90 en verde fósforo, con arte ASCII animado, montada sobre una
placa de circuito. El negro manda y el verde es la voz; ámbar para la duda y rojo para los
errores. Las reglas completas están en [DESIGN.md](DESIGN.md).

- **La placa del fondo trabaja con el modelo:** pistas, vías y chips con nombres de las piezas
  de un modelo (ATTN, SOFTMAX, KV CACHE…). Cada token que llega dispara un pulso que recorre
  una pista. Vive en los márgenes: hacia el centro de la pantalla se apaga.
- **Un solo botón pausa todo lo que se mueve** ("pausar animaciones", en la barra de estado o en
  la paleta de comandos). Si el sistema pide reducir movimiento, arranca en pausa.
- **Arte ASCII animado** en los estados vacíos: un chip que sortea tokens, un globo de
  ciberespacio, un ojo tramado que sigue al puntero, el toro de Sloane, lluvia de muestras y un cubo.
- **Gráficos 3D:** la respuesta del playground como cordillera (una cresta por token), resúmenes
  del comparador, el histograma de variabilidad y las métricas de evaluación en barras 3D, y las
  respuestas evaluadas como nube de embeddings. Se giran con el mouse y tienen un modo ASCII.
- **Letras:** VT323 (títulos y números grandes), IBM Plex Mono (interfaz y números) e IBM Plex
  Sans (lo que escribe el modelo y los textos para leer). Están dentro del proyecto, así que
  funciona sin internet.
- **Accesible:** contraste medido con WCAG y APCA, foco visible, objetivos de 24 px (44 en
  pantallas táctiles) y 0 problemas de axe-core (WCAG 2.2 AA) en todas las vistas.

| Atajo | Qué hace |
|---|---|
| `Ctrl` `K` | Paleta de comandos |
| `Alt` `1` / `2` / `3` / `4` | Playground, Comparador, Evaluación, Chat (Chrome se reserva Ctrl + número) |
| `/` | Escribir en el prompt de la vista |
| `←` `→` | Recorrer los tokens en el inspector |
| `1` … `9` | Forzar esa alternativa del token elegido (crea una rama) |
| `Esc` | Detener la generación o soltar el token |
| `?` | Lista de atajos |

## Evaluación (capítulo 3)

Cada respuesta se compara con una referencia, la respuesta correcta que escribió una persona:

| Métrica | Qué mide |
|---|---|
| Exacta | Igual carácter por carácter |
| Normalizada | Igual sin mayúsculas, tildes, puntuación ni artículos |
| Contiene | La referencia aparece entera dentro de la respuesta |
| Edición | 1 − distancia de Levenshtein (sobre el texto normalizado) |
| ROUGE-L | La secuencia de palabras en común más larga (F1) |
| BLEU | Grupos de hasta 4 palabras compartidos, con penalización por brevedad |
| Semántica | Coseno entre los embeddings de la respuesta y de la referencia |

Se corre con temperatura 0 y semilla fija, así las diferencias son de los modelos y no del azar.
Hay cuatro conjuntos curados (datos concretos, cuentas, traducción y extracción); para editarlos
se duplican. Las corridas quedan en Postgres y se pueden abrir de nuevo, varias juntas. La
dispersión ROUGE-L contra semántica muestra dónde fallan las métricas léxicas: arriba a la
izquierda quedan las respuestas que dicen lo mismo con otras palabras.

La similitud semántica usa un modelo de embeddings de Ollama:

```bash
ollama pull qwen3-embedding:0.6b
```

Si no está bajado, la corrida termina igual, sin la columna semántica, y la vista avisa.

## Desarrollo (en el servidor, con VS Code Remote)

Requisitos: `uv`, Node.js 22+ y Docker (para Postgres).

**Base de datos** (una vez; queda corriendo):
```bash
docker compose up -d db
```
Escucha solo en `127.0.0.1:5432`. El backend aplica las migraciones al arrancar.

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
App: `http://<servidor>:8501`. Arranca sola cuando se prende el servidor, junto con Postgres
(`ai-workbench-db`, con los datos en el volumen `datos-db`).

Para actualizar después de cambios: `docker compose up -d --build`.
Logs: `docker compose logs -f`.
