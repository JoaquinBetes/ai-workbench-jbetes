# DESIGN.md — Workbench

Sistema visual "fósforo". Antes de construir o cambiar la interfaz, leé este archivo.
Las reglas en **negrita** salen de correcciones del dueño del proyecto; el comentario debajo de
cada una guarda la fecha y sus palabras. `npm run lint:diseno` (en `frontend/`) comprueba las que
se pueden leer en el código.

## Mundo

Una herramienta de laboratorio (modo **Operate**): la gente viene a probar un modelo, no a mirar
una vidriera. La navegación y los controles son los de siempre (pestañas, botones, campos); el
mundo pone la letra, la paleta, la densidad y una firma.

- **La estética nunca le gana a la usabilidad.** Cuando una decisión visual baja la legibilidad,
  el contraste, el foco, el tamaño de toque o la claridad, gana la usabilidad y se busca otra
  forma de lograr el efecto. El aspecto tiene que ser serio y de primera calidad: alternativo en
  el mundo, convencional en el uso.
  Por qué: el dueño quiere mantener la estética sin perder experiencia de usuario ni conceptos de diseño web.
  <!-- 2026-11-24: "No quiero sacrificar tanto de la experiencia de usuario ni de cuestiones como la usabilidad y demás en función de la estética." / "integrar un diseño tan alternativo… con mantener usabilidad, que parezca profesional, que parezca serio y de máxima calidad." -->
- **Un poco más minimalista que lo alternativo: cada adorno tiene que ganarse su lugar.** Lo
  decorativo vive en los márgenes (la placa del fondo se apaga hacia el centro); dentro de los
  paneles manda el contenido.
  Por qué: el dueño pidió que parezca una página cara y de alta calidad, un poco más minimalista sin dejar de ser alternativa.
  <!-- 2026-11-24: "quiero que sea un poquito más minimalista. No quiero que sea minimalista, quiero simplemente que sea un poco más." / "no parece del todo una página web cara." -->

El mundo es una consola de hacker de los 90 en verde fósforo, con arte ASCII animado, montada
sobre una placa de circuito. Toma de cada fuente una idea:

| Fuente | Qué se toma |
|---|---|
| Páginas viejas y redes de texto (cyberspace.online, BBS, Telehack) | Dibujos y animaciones hechos con caracteres; etiquetas entre corchetes `[ ]` |
| Monitores de fósforo | Verde sobre negro; brillo y líneas de barrido, solo dentro del arte ASCII |
| Placas de circuito | Pistas con giros, vías, chips con pines, designadores de serigrafía (U1, U2…) |
| Imágenes de 1 bit | Tramado ordenado (Bayer) para sombrear: el ojo, el océano del globo |
| Terminales | Cursor de bloque, spinners `\| / - \`, barras `###···` |

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
  series de un gráfico.**
  Por qué: el dueño quiere el verde medio neón de las consolas de los 90.
  <!-- 2026-11-23: "esa estética y ese color verde medio neón que parece propio de una consola que remite a la idea como de hackers en los 90... podríamos usar una paleta de colores con ese verde de neón y no la paleta que estamos usando actualmente." -->

### Contraste

Se mide con WCAG 2 (el mínimo legal: 4,5:1 para texto, 3:1 para texto grande y para bordes de
controles) y con APCA (más fiel en modo oscuro: Lc 75 mínimo y Lc 90 preferido para leer; más de
Lc 90 encandila en oscuro y aparece el "halo" alrededor de las letras). Valores contra `--panel`:

| Token | Valor | WCAG | APCA | Trabajo |
|---|---|---|---|---|
| `--ink` | #8af7ad | 15:1 | Lc -88 | Texto de lectura (lo que escribe el modelo, mensajes) |
| `--ink-2` | #7cdf9c | 12:1 | Lc -75 | Texto secundario |
| `--muted` | #72c993 | 10:1 | Lc -64 | Etiquetas y ayudas cortas; nunca párrafos |
| `--accent` | #5ff59a | 14:1 | Lc -84 | Fósforo encendido: lo elegido, el botón principal (video inverso), el foco, los pulsos |
| `--doubt` | #ffb238 | 11:1 | Lc -69 | La duda: subrayado punteado ámbar |
| `--danger` | #ff8a7e | 8,6:1 | Lc -57 | Error |
| `--borde-campo` | #407451 | 3,6:1 | — | Borde de campos, interruptores y deslizadores (WCAG 1.4.11) |
| `--ink-3`, `--faint` | 50 % / 20 % | — | — | Solo decoración (corchetes, trazos). Nunca texto: lo controla `lint:diseno` |
| `--silk` | #dce8d9 | — | — | Serigrafía: designadores y nombres de chips |
| `--pista` | #1d6a3b | — | — | Cobre bajo la máscara: las pistas de la placa |

- Superficies: `--bg` #030806, `--panel` #050d08, `--raised` #0a1a10, `--sunken` #010302.
- El fósforo encendido es un poco menos saturado que el neón puro: en fondo oscuro, un color muy
  saturado "vibra" y cansa la vista (Material Design, tema oscuro).
- Serie de gráficos: #2aa961 · #3a93d0 · #c4831c · #c75a8d (fósforo, azul, ámbar, magenta),
  validada para fondo oscuro con el validador de dataviz.
- three.js y recharts no leen variables CSS: los mismos valores viven en hex en `lib/tintas.ts`.
  `lint:diseno` falla si un hex de ahí no está en `index.css`, o si aparece un color crudo en
  otro archivo.
- Se subraya la duda con punteado; el dueño lo aprobó (ahora en ámbar).
  <!-- 2026-11-22: la línea punteada de duda "está OK" -->

## Tipografía

Tres voces, cada una con un trabajo:

| Voz | Fuente | Dónde |
|---|---|---|
| Pantalla | VT323 (familia `"Terminal"`, con `size-adjust: 128%`) | Solo títulos (`.display`) y números grandes que se miran de un vistazo (`.lectura`). A tamaño chico se desdibuja |
| Interfaz | IBM Plex Mono 400/500/600 | Etiquetas, botones, pestañas, números tabulares (`.num`), código, JSON |
| Prosa | IBM Plex Sans 400/500 (`.prosa`) | Lo que escribe el modelo, mensajes, campos de prompt, ayudas (`.hint`) |

- La prosa no va en monoespaciada: en párrafos se lee más lento. Un campo de prosa es
  `field prosa` (`.field.prosa` gana sobre la mono de `.field`).
- Texto del modelo: 16 px, interlínea 1,7, largo de línea de 68 caracteres como máximo (el
  rango cómodo es de 50 a 75).
- Escala de interfaz: 12 / 13 / 14 / 15 / 16 px. Títulos de panel: Plex Mono 12 px, versalitas,
  espaciado .08em, con su designador U1, U2… (contador CSS por vista; los lectores de pantalla no
  lo leen).
- Números siempre tabulares, con cero tachado.
- El título de cada vista termina en un cursor de bloque que titila cuatro veces y se queda quieto.
- Nada de degradados en el texto (lo comprueba `lint:diseno`).

## Espaciado y layout

- Escala de 4 px (`--s-1` a `--s-7`). Radios 0 o 2 px. Cabeceras de panel de 44 px.
- Escritorio: tres columnas (parámetros · trabajo · inspector), alto de la ventana, cada columna
  con su propio scroll. Debajo de 1024 px se apila y la página scrollea.
- Las zonas de lectura tapan la placa del fondo: carril en el chat (`.carril`), velo en la
  columna central del playground (`.carril-suave`).
- En teléfono el compositor queda fijo abajo, los ejemplos van en una sola fila y se esconden
  cuando ya escribiste algo. En la barra de vistas, solo la actual muestra su nombre; las otras,
  el ícono (el nombre sigue para lectores de pantalla).
- Sin scroll lateral a 390 ni a 320 px (los tooltips no existen sin mouse).

## Superficies

- **Ningún halo, glow ni luz que gire alrededor de un campo de texto o un panel.** El foco del
  compositor pinta el borde del panel en fósforo encendido; el de los campos, un borde doble. El
  brillo de fósforo vive solo dentro del arte ASCII (en el canvas).
  Por qué: al dueño no le gustó el efecto de luz que circulaba por el input.
  <!-- 2026-11-23: "Sobre todo lo que no me gusta es en el cuadro para escribir ese efecto de glow que va circulando por el input de texto. No me gusta." -->
- **Criterios de placa de circuito: pistas, vías, chips y serigrafía.** Los paneles son piezas
  sobre la placa: máscara casi negra, borde de 1 px y designador en el título. Detrás de todo, la
  placa ASCII, que se apaga hacia el centro de la pantalla (`.fondo-placa`, máscara radial).
  Por qué: el dueño pidió tomar la estética de las placas verdes con circuitos impresos.
  <!-- 2026-11-23: "tomar también algunos criterios estéticos de las placas. Me refiero a las placas de silicio, de circuitos y demás, las clásicas placas verdes que tienen circuitos eh, impresas en él." -->
- Separadores lisos de 1 px. Las líneas de barrido van solo sobre el arte ASCII: sobre el texto de
  la interfaz le bajan el contraste.
- La selección de texto se invierte (fósforo sobre negro).

## Movimiento

- **El sitio tiene que sentirse vivo: muchas animaciones, sobre todo de arte ASCII.** Pero la
  vida no frena al que trabaja: lo que se usa cientos de veces (atajos, paleta de comandos,
  cambiar de vista) no se anima.
  Por qué: el dueño pidió algo caro, interactivo y con vida; no minimalista ni aburrido.
  <!-- 2026-11-22: "Me gustaría que parezca un producto que es caro, que parezca un producto muy interactivo, como con cierta vida... no quiero algo tan minimalista o tan aburrido." -->
  <!-- 2026-11-23: "Agrega bastante animaciones, que el sitio web se sienta vivo." -->
- **Todo lo que se mueve solo se pausa con un solo control** ("pausar animaciones", en la barra
  de estado y en la paleta), y al reanudar sigue desde donde quedó (WCAG 2.2.2). Arranca en pausa
  si el sistema pide reducir movimiento. Fuente: `lib/movimiento.ts`.
- Duraciones (NN/g: 100 a 500 ms, lo más corto que no sea brusco): presión 90 ms, entrada 150 ms,
  salida 120 ms, panel 200 ms, desliz 240 ms, revelado de paneles 380 ms. Curvas `--ease` y
  `--ease-enter`. Botones: `scale(.97)` al presionar.
- Entradas: los paneles se revelan con `clip-path` (`.enter`) la primera vez; al volver a una
  vista no se repiten (`.quieta`). Las respuestas nuevas se "imprimen" de arriba abajo
  (`.rise-in`), los títulos se descifran (`Decodificar`), los tokens nuevos llegan cifrados.
- Tooltips: 400 ms de espera la primera vez, instantáneos mientras se recorren otros.

## Arte ASCII

- **Mucho arte ASCII y muchas animaciones ASCII, hechas como dibujos que se mueven.**
  Por qué: es lo que el dueño rescata de las páginas viejas y de cyberspace.online.
  <!-- 2026-11-23: "Me interesa mucho esa estética que mezcla mucho código ASCII, armar animaciones como dibujos con cierta animación o movimiento con código ASCII." -->
- Motor: `lib/ascii.ts` + `components/ascii/LienzoAscii.tsx`. Canvas con atlas de glifos por
  tinta, tope de fps, pausa fuera de pantalla, con la pestaña oculta y con el movimiento en pausa.
  Los caracteres de caja (─ │ ┌ ═ ║ …) se dibujan con rectángulos, así las pistas quedan continuas.
- Brillo de fósforo: lo que se dibuja con la tinta `accent` se copia a un lienzo a 1/4 de
  resolución y se suma encima agrandado. Líneas de barrido: `destination-out` en una fila de cada tres.
- Rampa de brillo: `" .:-=+*#%@"`. Tramado: matriz de Bayer 4×4 (`BAYER`).
- Escenas: placa de fondo con pulsos (`crearEscenaFondo`), chip SAMPLER con tokens que salen
  (`crearEscenaChip`), globo de ciberespacio (`escenaGlobo`), ojo tramado que sigue al puntero
  (`escenaOjo`), toro de Sloane (`escenaToro`), lluvia de muestras (`escenaMuestras`), cubo
  (`escenaCubo`), diana con dardos para la evaluación (`escenaDiana`). Cada estado vacío lleva una,
  con su descripción para lectores de pantalla.
- La placa del fondo es calma: ~9 % de la pantalla con pistas, pocas señales de ambiente; los
  pulsos fuertes son los de los tokens. Se puede ocultar del todo desde la paleta.

## Gráficos

- **Si un gráfico puede ser tridimensional, es 3D e interactivo: se gira y se acerca con el mouse.**
  Por qué: el dueño pidió gráficos como la cordillera que mandó de referencia, en 3D.
  <!-- 2026-11-23: "me gustaría ver si podemos agregar gráficos como este que estoy cargando, que es como en 3D" / "quiero que haya muchos gráficos que tengan cierto componente interactivo, de ser posible que sean tridimensionales" -->
- `components/graficos3d/`: `Cordillera3D`, `Barras3D` y `Nube3D`. React Three Fiber, cámara
  ortográfica que encuadra sola, vaivén suave (se detiene con el movimiento en pausa), giro
  limitado. Cada uno tiene un modo ASCII. El contenedor es un grupo con nombre (`role="group"`),
  no una imagen: adentro hay controles.
- Las etiquetas dentro de una escena 3D se ponen con `Etiqueta` (de `Lienzo3D`), nunca con el
  `Html` de drei directo: `Etiqueta` las cuelga de una capa fija del lienzo. Con `Html` suelto,
  desmontar el gráfico tira un error de React (`removeChild`) en la consola.
- Nube de embeddings (`Nube3D`): referencias como cubos en serigrafía, respuestas como esferas del
  color de su modelo, unidas a su referencia por una línea; cuanto más corta, más se parecen.
- Dispersiones: un punto por respuesta, un color por modelo, leyenda arriba; las dos esquinas que
  importan llevan su nombre en el gráfico.
- Ejes recesivos (`EJE`, `GRILLA` en `ui/Vista.tsx`) en Plex Mono 12 px; el texto en tokens de
  texto, nunca en el color de la serie.
- En listas cortas, barras de texto `###` con un trazo punteado dibujado para lo vacío
  (`BarraTexto`, `.pista-punteada`).

## Interacción

- Foco de teclado: 2 px de fósforo encendido, separado 2 px del borde, en todo (también React
  Flow). Hay un enlace para saltar al contenido.
- Objetivos: 24 px como mínimo (WCAG 2.5.8); en pantallas táctiles, 44 px.
- Campos: borde de 3,6:1, etiqueta visible y asociada (`<label for>`), 16 px en pantallas
  táctiles (así iOS no hace zoom al enfocar).
- Atajos: `Ctrl K` paleta, `Alt 1/2/3/4` vistas, `/` al campo, `← →` tokens, `1…9` forzar
  alternativa, `Esc` detener, `?` lista de atajos. Las pistas de teclado se esconden en pantallas
  táctiles (`.solo-teclado`).
- Las zonas con scroll propio se pueden enfocar con el teclado (`tabIndex={0}` y un nombre).
  Las tablas anchas van en un envoltorio `relative overflow-x-auto`: sin `relative`, un `.sr-only`
  de adentro se escapa y la página entera scrollea de costado.
- Casillas: `.check` dentro de `.area-check` (la casilla mide 16 px; el área que se toca, 28, y
  44 en pantallas táctiles).
- Borrar algo guardado pide una segunda confirmación en el mismo lugar (el botón pasa a "Borrar"
  en rojo y se cancela al perder el foco); sin diálogos del navegador.
- Un `.tag` no lleva tooltip: los dos usan `::after`. El tooltip va en un envoltorio.

## Texto

- Español rioplatense, voseo. Botones con verbo y objeto ("Ejecutar 10 veces").
- Placeholders cortos; las instrucciones largas van en el estado vacío, no en el campo.

## Comprobaciones

| Qué | Cómo |
|---|---|
| Glow, degradado en texto, tema claro, japonés, colores crudos, tintas desincronizadas, texto en colores de decoración, tags con tooltip | `cd frontend && npm run lint:diseno` |
| Accesibilidad (WCAG 2.2 AA y buenas prácticas) | axe-core en cada vista, vacía y con resultados: 0 problemas |
| Paleta de gráficos | validador de la skill de dataviz, modo oscuro, contra `--panel` |
| Contraste, foco, toque, desbordes | checker de consistencia de la skill de taste a 1440, 390 y 320 |
