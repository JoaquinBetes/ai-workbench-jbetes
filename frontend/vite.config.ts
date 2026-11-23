import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

// En desarrollo, Vite corre en el puerto 5173 y reenvía todo lo que empiece
// con /api al backend de FastAPI (puerto 8000). En producción no hace falta:
// FastAPI sirve el frontend compilado y la API desde el mismo puerto.
export default defineConfig({
  plugins: [react(), tailwindcss()],
  build: { chunkSizeWarningLimit: 1000 },
  server: {
    host: true,
    port: 5173,
    proxy: {
      "/api": "http://localhost:8000",
    },
  },
});
