# DESIGN.md — Workbench 工房

Sistema visual "modo texto". Antes de construir o cambiar la interfaz, leé este archivo.
Las reglas en **negrita** salen de correcciones del dueño del proyecto; el comentario debajo de
cada una guarda la fecha y sus palabras. `npm run lint:diseno` (en `frontend/`) comprueba las que
se pueden leer en el código.

## Mundo

Una herramienta de laboratorio (modo **Operate**): la gente viene a probar un modelo, no a mirar
una vidriera. La marca vive en los detalles, pero la herramienta tiene que sentirse viva.

El mundo es una **fusión**, no la copia de una referencia: tinta sumi sobre papel washi, dibujada
con caracteres. Toma de cada fuente una idea:

| Fuente | Qué se toma |
|---|---|
| Arte AA japonés (Shift_JIS, 2channel) y ukiyo-e | Dibujar escenas con texto: Fuji, olas, ensō; katakana en las rampas de brillo |
| PC-98 | Tramado ordenado (Bayer) como textura; pocas tintas, puestas con intención |
| Imprenta | Marcas de registro en las esquinas de los paneles; sello hanko (工) como logo |
| Demoscene ASCII (donut de Andy Sloane, efecto ASCII de Maxime Heckel) | Escenas 3D renderizadas a caracteres; un shader que convierte la escena en glifos |
| Terminales | Spinners `\| / - \`, barras `###···`, texto que se descifra |

- **Nunca copiar una sola referencia: abstraer la idea de varias y fundirla en un criterio propio.**
  Por qué: el dueño pidió un criterio propio, no el estilo de un ejemplo.
  <!-- 2026-11-23: "No te bases completamente en un ejemplo particular, sino que abstraete la idea base de estos ejemplos y arma un criterio que sea ciertamente una fusión de todo esto." -->

## Color

- **Solo modo oscuro. No hay tema claro.**
  Por qué: el dueño lo pidió así.
  <!-- 2026-11-22: "dark mode only" -->
- **Predominan el negro (`--bg` #050505) y el blanco washi (`--ink` #ece8dc). El color es la
  excepción: tonos apagados, diluidos, y solo donde algo tiene que resaltar.** Nunca colores
  saturados ni neón (el lima del rediseño anterior se descartó por eso).
  Por qué: en un mundo monocromo, un color apagado resalta más que uno estridente en un mundo de colores.
  <!-- 2026-11-23: "Quiero que predomine el negro y el blanco con algunos colores eh, incluso un poco apagados, medios como diluidos, pero que en ese monocromatismo resalten." / "muy pocos colores en los lugares donde realmente tienen que estar para que destaquen" -->

| Token | Valor | Trabajo |
|---|---|---|
| `--bg` | #050505 | Fondo (sumi) |
| `--panel` / `--raised` / `--sunken` | tinta al 2,5 % / 7 % / #000 | Superficies |
| `--ink` / `--ink-2` / `--muted` | #ece8dc / 80 % / #9a968a | Texto (washi) |
| `--ink-3`, `--faint` | 55 % / 22 % | Solo decoración: marcas de registro, rampas. Nunca texto |
| `--accent` | #c2583f (shu, bermellón de sello) | La señal: el token elegido, lo forzado, la opción más probable, el indicador de vida |
| `--doubt` | #b98d3a (kin, ocre) | La duda: subrayado punteado de tokens inciertos |
| `--s1..--s4` | #6b8ed0 · #cf6448 · #45a689 · #b98d3a | Serie categórica de gráficos (ai, shu, rokushō, kin), validada para fondo oscuro con el validador de dataviz |
| `--syn-texto`, `--syn-numero` | #9fbcae · #9cb1dc | JSON resaltado |

- El botón principal es washi (blanco sobre negro), no bermellón: el bermellón queda para la señal.
- Los colores salen de los tokens de `index.css`. Un hex crudo solo vive en los gráficos (three.js
  y recharts no leen variables CSS) y en las tintas del motor ASCII. Lo comprueba `lint:diseno`.
- Se subraya la duda con punteado ocre; el dueño lo aprobó.
  <!-- 2026-11-22: la línea punteada de duda "está OK" -->

## Tipografía

| Voz | Fuente | Dónde |
|---|---|---|
| Títulos | Zen Antique | `h1` de vista, títulos de estados vacíos (`.display`) |
| Lecturas | DotGothic16 (`--font-dot`) | Números, métricas, etiquetas de ejes, kanji de capítulo |
| Interfaz y modelo | M PLUS 1 Code Variable (`--font-text`) | Todo lo demás, y el texto que genera el modelo |

- Escala: 13 / 14 / 15 / 18 px (`--t-label`, `--t-small`, `--t-body`, `--t-lead`).
- Los títulos de panel llevan un cuadrado de sello `■` en bermellón, no una barra lateral.
- Nada de degradados en el texto ni de etiquetas tipo "eyebrow" sobre los títulos (lo comprueba
  `lint:diseno` para los degradados).
- El número de capítulo va entre corchetes con su kanji: `[ cap. 2 第二章 ]`.

## Espaciado y layout

- Escala de 4 px (`--s-1` a `--s-7`). Radios 0 o 2 px: el papel no se redondea.
- Escritorio: tres columnas (parámetros · trabajo · inspector), alto de la ventana, cada columna
  con su propio scroll. Debajo de 1024 px se apila y la página scrollea.
- En teléfono el compositor queda fijo abajo y los ejemplos se deslizan en una sola fila.
- Sin scroll lateral a 390 ni a 320 px.

## Superficies

- **Ningún halo, glow ni luz que gire alrededor de un campo de texto o un panel.** El foco de un
  campo es un filo de tinta de 1 px (`.campo-compositor:focus-visible`). Cuando el modelo genera,
  una sola línea fina recorre el borde superior del compositor; nada más.
  Por qué: al dueño no le gustó el efecto de luz que circulaba por el input.
  <!-- 2026-11-23: "Sobre todo lo que no me gusta es en el cuadro para escribir ese efecto de glow que va circulando por el input de texto. No me gusta." -->
- Paneles: fondo `--panel`, borde `--line`, y en las esquinas marcas de registro de imprenta
  (`.panel::after`). Los botones repiten las marcas y las abren al pasar el mouse.
- Textura: tramado Bayer (`--dither`) en barras y fondos, nunca sobre texto.
- La selección de texto se invierte (washi sobre sumi).

## Movimiento

- **El sitio tiene que sentirse vivo: muchas animaciones, sobre todo de arte ASCII.** Pero la
  vida no frena al que trabaja: lo que se usa cientos de veces (atajos, paleta de comandos,
  cambiar de vista con el teclado) no se anima.
  Por qué: el dueño pidió algo caro, interactivo y con vida; no minimalista ni aburrido.
  <!-- 2026-11-22: "Me gustaría que parezca un producto que es caro, que parezca un producto muy interactivo, como con cierta vida... no quiero algo tan minimalista o tan aburrido." -->
  <!-- 2026-11-23: "Agrega bastante animaciones, que el sitio web se sienta vivo." -->
- Duraciones: presión 90 ms, entrada 150 ms, salida 120 ms, panel 200 ms, desliz 240 ms.
  Curvas `--ease` y `--ease-enter` (salida rápida). Botones: `scale(.97)` al presionar.
- Entradas: los paneles se revelan con `clip-path` (`.enter`), las respuestas nuevas se
  "imprimen" de arriba abajo (`.rise-in`), los títulos se descifran (`Decodificar`), los tokens
  nuevos llegan cifrados y se asientan (`Cifrado`).
- Con `prefers-reduced-motion`, todo queda en su estado final y las escenas ASCII en un cuadro.

## Arte ASCII

- **Mucho arte ASCII y muchas animaciones ASCII, casi sin color: glifos en washi y, como
  mucho, un punto de bermellón u ocre donde está el foco de la escena.**
  Por qué: el dueño quiere el arte ASCII japonés de las referencias, pero con menos colores que ellas.
  <!-- 2026-11-23: "que haya mucho arte de este tipo ASCII, muchas animaciones de este tipo ASCII, pero quizás sin tantos colores como las imágenes que te pasé" -->
- Motor: `lib/ascii.ts` + `components/ascii/LienzoAscii.tsx`. Canvas con atlas de glifos por
  tinta, tope de fps, pausa fuera de pantalla y con la pestaña oculta.
- Rampa de brillo: `" .:-=+*ﾉﾒ#%@"` (katakana de ancho medio en el medio).
- Escenas: fondo de niebla que sigue al mouse (`escenaFondo`), Fuji con sol y mar
  (`escenaFuji`), ensō (`escenaEnso`), toro de Sloane (`escenaToro`), lluvia de muestras
  (`escenaMuestras`), cubo (`escenaCubo`). Cada estado vacío lleva una.
- El fondo vivo se puede apagar (barra de estado o paleta); la preferencia se guarda.

## Gráficos

- **Si un gráfico puede ser tridimensional, es 3D e interactivo: se gira y se acerca con el mouse.**
  Por qué: el dueño pidió gráficos como la cordillera que mandó de referencia, en 3D.
  <!-- 2026-11-23: "me gustaría ver si podemos agregar gráficos como este que estoy cargando, que es como en 3D" / "quiero que haya muchos gráficos que tengan cierto componente interactivo, de ser posible que sean tridimensionales" -->
- `components/graficos3d/`: `Cordillera3D` (ridgeline: una cresta por token, la opción más
  probable al centro) y `Barras3D`. React Three Fiber, cámara ortográfica que encuadra sola,
  vaivén suave en lugar de rotación automática, giro limitado para no ver el gráfico de canto.
- Cada gráfico 3D tiene un modo ASCII (`EfectoAscii`, un shader de postprocesado que conserva
  el color). Se cargan con `React.lazy` y no dibujan cuando no están en pantalla.
- Ejes recesivos (`EJE`, `GRILLA` en `ui/Vista.tsx`); los números en DotGothic16; el texto usa
  tokens de texto, nunca el color de la serie.
- En listas cortas, barras de texto `###···` en vez de gráficos (`BarraTexto`).

## Interacción

- Atajos: `Ctrl K` paleta, `Alt 1/2/3` vistas, `/` al campo, `← →` tokens, `1…9` forzar
  alternativa, `Esc` detener, `?` lista de atajos.
- En pantallas táctiles, todo lo que se toca mide 44 px o tiene un área de toque de 44 px.
- Foco de teclado siempre visible: filo de tinta de 1 px, también en los nodos de React Flow.
- Hay un enlace para saltar al contenido.

## Texto

- Español rioplatense, voseo. Botones con verbo y objeto ("Ejecutar 10 veces").
- Las etiquetas de los campos están visibles y asociadas al campo (`<label for>`).

## Comprobaciones

| Qué | Cómo |
|---|---|
| Glow, degradado en texto, tema claro, colores crudos | `cd frontend && npm run lint:diseno` |
| Paleta de gráficos | validador de la skill de dataviz, modo oscuro, contra `--panel` |
| Contraste, foco, toque, desbordes | checker de consistencia de la skill de taste a 1440, 390 y 320 |
