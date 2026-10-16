/// <reference types="vitest" />
import { defineConfig } from "vite";

export default defineConfig({
  // Relative paths so the build can be served from any subfolder (e.g. GitHub Pages).
  base: "./",
  test: {
    environment: "jsdom",
  },
});
