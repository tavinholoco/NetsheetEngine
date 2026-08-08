import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import { fileURLToPath, URL } from "node:url";

// Fase 9 (T9.1) — Vitest + React Testing Library.
// Reusa o plugin React e o alias `@` do vite.config.ts; ambiente jsdom com
// setup de matchers (@testing-library/jest-dom).
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url))
    }
  },
  test: {
    environment: "jsdom",
    setupFiles: ["./src/test/setup.ts"],
    include: ["src/**/*.test.{ts,tsx}"]
  }
});
