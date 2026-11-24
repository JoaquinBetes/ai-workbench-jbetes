// Los tokens de color de index.css en hex, para lo que no lee variables CSS:
// three.js, recharts y los lienzos. Si cambia la paleta, cambia acá y allá.

export const TINTA = {
  fondo: "#030806",
  panel: "#050d08",
  tinta: "#8af7ad", // fósforo suave: el texto
  apagada: "#55ad77",
  senal: "#3dff7f", // fósforo encendido: lo elegido
  duda: "#ffb238",
  pista: "#1d6a3b", // cobre bajo la máscara
  serigrafia: "#dce8d9",
} as const;

/** Serie categórica validada para fondo oscuro (dataviz): fósforo, azul, ámbar, magenta. */
export const SERIES_HEX = ["#2aa961", "#3a93d0", "#c4831c", "#c75a8d"];
