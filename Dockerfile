# syntax=docker/dockerfile:1.7

# =============================================================================
# Stage 1 — build do frontend com Bun + Vite
# =============================================================================
FROM oven/bun:1 AS builder
WORKDIR /app

# Instala dependências (cache layer)
COPY package.json bun.lock ./
RUN bun install --frozen-lockfile

# Copia código
COPY . .

# Variáveis injetadas em build-time (Vite só lê import.meta.env durante o build)
ARG VITE_SUPABASE_URL
ARG VITE_SUPABASE_PUBLISHABLE_KEY
ARG VITE_SUPABASE_PROJECT_ID=self-hosted
ENV VITE_SUPABASE_URL=$VITE_SUPABASE_URL \
    VITE_SUPABASE_PUBLISHABLE_KEY=$VITE_SUPABASE_PUBLISHABLE_KEY \
    VITE_SUPABASE_PROJECT_ID=$VITE_SUPABASE_PROJECT_ID

RUN bun run build

# =============================================================================
# Stage 2 — serve estático com Nginx
# =============================================================================
FROM nginx:1.27-alpine
COPY --from=builder /app/dist /usr/share/nginx/html
COPY docker/nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80
HEALTHCHECK --interval=30s --timeout=3s --retries=3 \
  CMD wget -q --spider http://127.0.0.1/ || exit 1

CMD ["nginx", "-g", "daemon off;"]
