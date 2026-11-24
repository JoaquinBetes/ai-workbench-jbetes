#!/usr/bin/env node
// Revisa las reglas de DESIGN.md que se pueden comprobar leyendo el código.
// Uso: npm run lint:diseno   (sale con código 1 si encuentra algo)

import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";

const raiz = new URL("../src/", import.meta.url).pathname;

// Archivos donde un color crudo está permitido: los tokens, las tintas del motor ASCII
// (el canvas necesita un color concreto si la variable no está) y los gráficos
// (three.js y recharts necesitan el hex, no la variable CSS).
const HEX_PERMITIDO = [
  "index.css",
  "lib/ascii.ts",
  "components/ascii/LienzoAscii.tsx",
  "components/graficos3d/",
  "components/comparador/comun.tsx",
  "components/ui/Vista.tsx",
];

const REGLAS = [
  {
    nombre: "sin-glow",
    regla: "DESIGN.md › Superficies: nada de halos ni luces que giren alrededor de un campo",
    patron: /conic-gradient|edge-glow|fx-prompt|box-shadow:\s*0 0 \d+px|drop-shadow\(0 0|text-shadow:\s*0 0 \d+px/,
  },
  {
    nombre: "sin-degradado-en-texto",
    regla: "DESIGN.md › Tipografía: el texto nunca lleva degradado",
    patron: /background-clip:\s*text|bg-clip-text/,
  },
  {
    nombre: "sin-tema-claro",
    regla: "DESIGN.md › Color: solo modo oscuro",
    patron: /prefers-color-scheme:\s*light|data-theme=["']light/,
  },
];

const HEX = /#[0-9a-fA-F]{6}\b|#[0-9a-fA-F]{3}\b/;

function* archivos(dir) {
  for (const nombre of readdirSync(dir)) {
    const ruta = join(dir, nombre);
    if (statSync(ruta).isDirectory()) yield* archivos(ruta);
    else if (/\.(tsx?|css)$/.test(nombre)) yield ruta;
  }
}

const hallazgos = [];
for (const ruta of archivos(raiz)) {
  const rel = relative(raiz, ruta);
  const lineas = readFileSync(ruta, "utf8").split("\n");
  lineas.forEach((linea, i) => {
    for (const r of REGLAS) {
      if (r.patron.test(linea)) hallazgos.push(`${rel}:${i + 1}  ${r.nombre}  (${r.regla})\n    ${linea.trim()}`);
    }
    const esComentario = /^\s*(\/\/|\/\*|\*)/.test(linea);
    if (!esComentario && HEX.test(linea) && !HEX_PERMITIDO.some((p) => rel.startsWith(p))) {
      hallazgos.push(`${rel}:${i + 1}  color-crudo  (DESIGN.md › Color: los colores salen de los tokens de index.css)\n    ${linea.trim()}`);
    }
  });
}

if (hallazgos.length) {
  console.log(`${hallazgos.length} hallazgo(s):\n`);
  console.log(hallazgos.join("\n"));
  process.exit(1);
}
console.log("Diseño: sin hallazgos.");
