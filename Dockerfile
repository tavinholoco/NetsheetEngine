# ============================================================
# NETSHEET ENGINE — Dockerfile multi-stage (Fase 10, T10.1)
# ============================================================
# Um único container serve o app completo: API Express + WebSocket
# + SPA estática (dist/) — funciona em Railway, Fly.io, Render e
# qualquer plataforma Docker.
#
# Build:  npm ci + npm run build (Vite client + bundle esbuild do
#         servidor; imports relativos ficam inline no bundle).
# Runtime: só deps de produção + dist/. O bundle do servidor é
#         external para PACOTES (express, ws, yjs, vite...), então o
#         node_modules de produção precisa existir no runtime.
#
# VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY entram no BUILD (inline
# no bundle do cliente pelo Vite) via --build-arg. As demais
# (SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, GEMINI_API_KEY, PORT) são
# lidas em RUNTIME — injete como secrets/variáveis na plataforma.
# NUNCA commitar chaves reais.
# ============================================================

# ---------- Estágio 1: build ----------
FROM node:22-alpine AS build
WORKDIR /app

# Deps primeiro (aproveita cache da camada quando o lock não muda)
COPY package.json package-lock.json ./
RUN npm ci

# Código-fonte (node_modules/dist excluídos pelo .dockerignore)
COPY . .

# VITE_* são build-time args (o Vite inline no bundle do cliente)
ARG VITE_SUPABASE_URL=""
ARG VITE_SUPABASE_ANON_KEY=""
ENV VITE_SUPABASE_URL=$VITE_SUPABASE_URL \
    VITE_SUPABASE_ANON_KEY=$VITE_SUPABASE_ANON_KEY

RUN npm run build

# ---------- Estágio 2: runtime ----------
FROM node:22-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production

COPY package.json package-lock.json ./
# Só deps de produção. "vite" é dependência REGULAR (o server.ts o importa
# para o middleware de dev) e o bundle externaliza pacotes — o node_modules
# de produção basta para rodar dist/server.cjs.
RUN npm ci --omit=dev && npm cache clean --force

COPY --from=build /app/dist ./dist

EXPOSE 3000
# Healthcheck nativo do Docker (as plataformas também têm os seus)
HEALTHCHECK --interval=30s --timeout=3s --start-period=15s --retries=3 \
  CMD wget -qO- http://127.0.0.1:3000/api/health || exit 1

CMD ["node", "dist/server.cjs"]
