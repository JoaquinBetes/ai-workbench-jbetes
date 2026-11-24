import "@fontsource-variable/m-plus-1-code";
import "@fontsource/dotgothic16";
import "@fontsource/zen-antique";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
