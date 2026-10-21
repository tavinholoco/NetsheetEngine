import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { fileURLToPath, URL } from "node:url";

/**
 * L.2 (ARQ-04) — o React e o Supabase em chunks próprios. Os dois estão no boot
 * (o `App.tsx` lê a sessão do Supabase), então a primeira visita baixa os
 * mesmos bytes; o ganho é de cache: um deploy muda o app, não as bibliotecas.
 * Só estes dois: uma biblioteca que só uma tela carrega (o Yjs da mesa) num
 * chunk fixo viria para o boot. No Vite 7+ (Rolldown), o `manualChunks` está
 * descontinuado — a regra muda de opção, não de conteúdo. `vendor-chunks.test`.
 */
export function vendorChunk(id: string): string | undefined {
  const path = id.split("\\").join("/");
  if (/\/node_modules\/(@supabase\/[^/]+|iceberg-js)\//.test(path)) return "vendor-supabase";
  if (/\/node_modules\/(react|react-dom|scheduler)\//.test(path)) return "vendor-react";
  return undefined;
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url))
    }
  },
  build: {
    outDir: "dist",
    sourcemap: false,
    rollupOptions: {
      output: {
        manualChunks: vendorChunk
      }
    }
  }
});
