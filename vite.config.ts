/// <reference types="vitest" />
import { defineConfig } from "vite";

export default defineConfig({
  // Rutas relativas para poder publicar el build en cualquier subcarpeta (p. ej. GitHub Pages).
  base: "./",
  test: {
    environment: "jsdom",
  },
});
