# DESIGN.md — Workbench

Sistema visual "fósforo". Antes de construir o cambiar la interfaz, leé este archivo.
Las reglas en **negrita** salen de correcciones del dueño del proyecto; el comentario debajo de
cada una guarda la fecha y sus palabras. `npm run lint:diseno` (en `frontend/`) comprueba las que
se pueden leer en el código.

## Mundo

Una herramienta de laboratorio (modo **Operate**): la gente viene a probar un modelo, no a mirar
una vidriera. La navegación y los controles son los de siempre (pestañas, botones, campos); el
mundo pone la letra, la paleta, la densidad y una firma.

El mundo es una consola de hacker de los 90 en verde fósforo, con arte ASCII animado, montada
sobre una placa de circuito. Toma de cada fuente una idea:

| Fuente | Qué se toma |
|---|---|
| Páginas viejas y redes de texto (cyberspace.online, BBS, Telehack) | Dibujos y animaciones hechos con caracteres; botones y etiquetas entre corchetes `[ ]` |
| Monitores de fósforo | Verde sobre negro, brillo que se corre alrededor de lo encendido, líneas de barrido |
| Placas de circuito | Pistas con giros, vías, chips con pines, designadores de serigrafía (U1, U2…) |
| Imágenes de 1 bit | Tramado ordenado (Bayer) para sombrear: el ojo, el océano del globo |
| Terminales | Cursor de bloque que titila, spinners `\| / - \`, barras `###···` |

**La firma:** la placa del fondo trabaja cuando el modelo trabaja. Cada token que llega dispara
un pulso que recorre una pista; los chips llevan nombres de las piezas de un modelo (ATTN,
SOFTMAX, KV CACHE, LOGITS…).

- **Nada japonés: ni paleta, ni kanji, ni kana, ni arte japonés. "Retro" quiere decir la web y
  las terminales viejas que dibujaban con ASCII.**
  Por qué: la referencia a páginas japonesas fue un malentendido; lo que importaba era el ASCII retro.
  <!-- 2026-11-23: "No era por asociarlo con el estilo japonés o la paleta de colores japonés, ni caracteres japoneses. Era más por decir algo muy retro, donde en páginas antiguas se usaban muchos dibujos o animaciones con códigos ASCII... Eso borralo porque fue un malentendido." -->
- **Nunca copiar una sola referencia: abstraer la idea de varias y fundirla en un criterio propio.**
  Por qué: el dueño pidió un criterio propio, no el estilo de un ejemplo.
  <!-- 2026-11-23: "No te bases completamente en un ejemplo particular, sino que abstraete la idea base de estos ejemplos y arma un criterio que sea ciertamente una fusión de todo esto." -->

## Color

- **Solo modo oscuro. No hay tema claro.**
  Por qué: el dueño lo pidió así.
  <!-- 2026-11-22: "dark mode only" -->
- **El negro manda y el verde fósforo es la voz: texto, bordes, selección y lo encendido son
  verdes. Otro color aparece solo cuando significa algo (ámbar = duda, rojo = error) o en las
  series de un gráfico.** Reemplaza a la regla anterior de blanco y negro con colores diluidos.
  Por qué: el dueño quiere el verde medio neón de las consolas de los 90.
  <!-- 2026-11-23: "esa estética y ese color verde medio neón que parece propio de una consola que remite a la idea como de hackers en los 90... podríamos usar una paleta de colores con ese verde de neón y no la paleta que estamos usando actualmente." -->

| Token | Valor | Trabajo |
|---|---|---|
| `--bg` | #030806 | Fondo, negro con un dejo verde |
| `--panel` / `--raised` / `--sunken` | #050d08 / #0a1a10 / #010302 | Superficies (máscara de soldadura) |
| `--ink` / `--ink-2` / `--muted` | #8af7ad / 82 % / #55ad77 | Texto (fósforo suave) |
| `--ink-3`, `--faint` | 50 % / 20 % | Solo decoración (corchetes, vías). Nunca texto |
| `--accent` | #3dff7f | Fósforo encendido: lo elegido, el botón principal (video inverso), los pulsos |
| `--doubt` | #ffb238 | La duda: subrayado punteado ámbar de los tokens inciertos |
| `--danger` | #ff5f52 | Error (LED rojo) |
| `--silk` | #dce8d9 | Serigrafía: designadores y nombres de chips. Nada más |
| `--pista` | #1d6a3b | Cobre bajo la máscara: las pistas de la placa |
| `--s1..--s4` | #2aa961 · #3a93d0 · #c4831c · #c75a8d | Serie de gráficos (fósforo, azul, ámbar, magenta), validada para fondo oscuro con el validador de dataviz |
| `--syn-texto`, `--syn-numero` | #8ccfe6 · #e39ac0 | JSON resaltado |

- three.js y recharts no leen variables CSS: los mismos valores viven en hex en `lib/tintas.ts`.
  `lint:diseno` falla si un hex de ahí no está en `index.css`, o si aparece un color crudo en
  otro archivo.
- Se subraya la duda con punteado; el dueño lo aprobó (ahora en ámbar).
  <!-- 2026-11-22: la línea punteada de duda "está OK" -->

## Tipografía

| Voz | Fuente | Dónde |
|---|---|---|
| Terminal | VT323, con `size-adjust: 128%` (familia `"Terminal"` en `index.css`) | Títulos, lecturas, números, etiquetas, designadores |
| Interfaz y modelo | IBM Plex Mono (400, 500, 600) | Todo lo demás, y el texto que genera el modelo |

- Escala: 13 / 14 / 15 / 18 px (`--t-label`, `--t-small`, `--t-body`, `--t-lead`). VT323 está
  agrandada en su `@font-face`, así que 13 px se leen como 13 px.
- Los títulos de panel van en mayúsculas con su designador de serigrafía (`U1`, `U2`…),
  numerados solos con un contador CSS por vista. No hay barra lateral ni "eyebrow" sobre los títulos.
- El título de cada vista termina en un cursor de bloque que titila (uno por pantalla).
- Nada de degradados en el texto (lo comprueba `lint:diseno`).

## Espaciado y layout

- Escala de 4 px (`--s-1` a `--s-7`). Radios 0 o 2 px.
- Escritorio: tres columnas (parámetros · trabajo · inspector), alto de la ventana, cada columna
  con su propio scroll. Debajo de 1024 px se apila y la página scrollea.
- La conversación del chat va en un carril de lectura (`.carril`) que tapa la placa del fondo.
- En teléfono el compositor queda fijo abajo y los ejemplos se deslizan en una sola fila.
- Sin scroll lateral a 390 ni a 320 px (los tooltips no existen sin mouse).

## Superficies

- **Ningún halo, glow ni luz que gire alrededor de un campo de texto o un panel.** El foco de un
  campo es un filo de 1 px. Cuando el modelo genera, una sola línea fina recorre el borde superior
  del compositor. El brillo de fósforo vive solo dentro del arte ASCII (en el canvas), nunca en
  campos, paneles ni texto de interfaz.
  Por qué: al dueño no le gustó el efecto de luz que circulaba por el input.
  <!-- 2026-11-23: "Sobre todo lo que no me gusta es en el cuadro para escribir ese efecto de glow que va circulando por el input de texto. No me gusta." -->
- **Criterios de placa de circuito: pistas, vías, chips y serigrafía.** Los paneles son piezas
  sobre la placa: máscara casi negra, borde de 1 px, una vía en cada esquina y designador en el
  título. Separadores internos punteados. Detrás de todo, la placa ASCII.
  Por qué: el dueño pidió tomar la estética de las placas verdes con circuitos impresos.
  <!-- 2026-11-23: "tomar también algunos criterios estéticos de las placas. Me refiero a las placas de silicio, de circuitos y demás, las clásicas placas verdes que tienen circuitos eh, impresas en él." -->
- Pantalla de fósforo: líneas de barrido y viñeta en `body::after`, quietas (sin parpadeo).
- La selección de texto se invierte (fósforo sobre negro).

## Movimiento

- **El sitio tiene que sentirse vivo: muchas animaciones, sobre todo de arte ASCII.** Pero la
  vida no frena al que trabaja: lo que se usa cientos de veces (atajos, paleta de comandos,
  cambiar de vista con el teclado) no se anima.
  Por qué: el dueño pidió algo caro, interactivo y con vida; no minimalista ni aburrido.
  <!-- 2026-11-22: "Me gustaría que parezca un producto que es caro, que parezca un producto muy interactivo, como con cierta vida... no quiero algo tan minimalista o tan aburrido." -->
  <!-- 2026-11-23: "Agrega bastante animaciones, que el sitio web se sienta vivo." -->
- Duraciones: presión 90 ms, entrada 150 ms, salida 120 ms, panel 200 ms, desliz 240 ms.
  Curvas `--ease` y `--ease-enter`. Botones: `scale(.97)` al presionar.
- Entradas: los paneles se revelan con `clip-path` (`.enter`), las respuestas nuevas se
  "imprimen" de arriba abajo (`.rise-in`), los títulos se descifran (`Decodificar`), los tokens
  nuevos llegan cifrados y se asientan (`Cifrado`).
- Con `prefers-reduced-motion`, todo queda en su estado final y las escenas ASCII en un cuadro.

## Arte ASCII

- **Mucho arte ASCII y muchas animaciones ASCII, hechas como dibujos que se mueven.**
  Por qué: es lo que el dueño rescata de las páginas viejas y de cyberspace.online.
  <!-- 2026-11-23: "Me interesa mucho esa estética que mezcla mucho código ASCII, armar animaciones como dibujos con cierta animación o movimiento con código ASCII." -->
- Motor: `lib/ascii.ts` + `components/ascii/LienzoAscii.tsx`. Canvas con atlas de glifos por
  tinta, tope de fps, pausa fuera de pantalla y con la pestaña oculta. Los caracteres de caja
  (─ │ ┌ ═ ║ …) se dibujan con rectángulos, así las pistas quedan continuas.
- Brillo de fósforo: lo que se dibuja con la tinta `accent` se copia a un lienzo a 1/4 de
  resolución y se suma encima agrandado.
- Rampa de brillo: `" .:-=+*#%@"`. Tramado: matriz de Bayer 4×4 (`BAYER`).
- Escenas: placa de fondo con pulsos (`crearEscenaFondo`), chip SAMPLER con tokens que salen
  (`crearEscenaChip`), globo de ciberespacio (`escenaGlobo`), ojo tramado que sigue al puntero
  (`escenaOjo`), toro de Sloane (`escenaToro`), lluvia de muestras (`escenaMuestras`), cubo
  (`escenaCubo`). Cada estado vacío lleva una.
- `emitirPulso()` (en `lib/api.ts`, por cada token) es lo que hace trabajar a la placa.
- El fondo vivo se puede apagar (barra de estado o paleta); la preferencia se guarda.

## Gráficos

- **Si un gráfico puede ser tridimensional, es 3D e interactivo: se gira y se acerca con el mouse.**
  Por qué: el dueño pidió gráficos como la cordillera que mandó de referencia, en 3D.
  <!-- 2026-11-23: "me gustaría ver si podemos agregar gráficos como este que estoy cargando, que es como en 3D" / "quiero que haya muchos gráficos que tengan cierto componente interactivo, de ser posible que sean tridimensionales" -->
- `components/graficos3d/`: `Cordillera3D` (una cresta por token, la opción más probable al
  centro) y `Barras3D`. React Three Fiber, cámara ortográfica que encuadra sola, vaivén suave,
  giro limitado. Cada uno tiene un modo ASCII (`EfectoAscii`, shader que conserva el color).
- Ejes recesivos (`EJE`, `GRILLA` en `ui/Vista.tsx`), números en letra de terminal, el texto en
  tokens de texto, nunca en el color de la serie.
- En listas cortas, barras de texto `###···` en vez de gráficos (`BarraTexto`).

## Interacción

- Atajos: `Ctrl K` paleta, `Alt 1/2/3` vistas, `/` al campo, `← →` tokens, `1…9` forzar
  alternativa, `Esc` detener, `?` lista de atajos.
- En pantallas táctiles, todo lo que se toca mide 44 px o tiene un área de toque de 44 px.
- Foco de teclado siempre visible: filo de 1 px, también en los nodos de React Flow.
- Hay un enlace para saltar al contenido.

## Texto

- Español rioplatense, voseo. Botones con verbo y objeto ("Ejecutar 10 veces").
- Las etiquetas de los campos están visibles y asociadas al campo (`<label for>`).

## Comprobaciones

| Qué | Cómo |
|---|---|
| Glow, degradado en texto, tema claro, japonés, colores crudos, tintas desincronizadas | `cd frontend && npm run lint:diseno` |
| Paleta de gráficos | validador de la skill de dataviz, modo oscuro, contra `--panel` |
| Contraste, foco, toque, desbordes | checker de consistencia de la skill de taste a 1440, 390 y 320 |
