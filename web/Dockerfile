# continuous.testing — Web App
# Next.js 15 standalone build
# SQL .sql files must be bundled since query.ts reads them at runtime via readFileSync

FROM node:22-alpine AS builder
WORKDIR /app

# Deps layer (cached unless package files change)
COPY package.json package-lock.json ./
RUN npm ci

# Source
COPY . .

# Build — requires NEXT_PUBLIC_ vars at build time (baked into client bundle)
ARG NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY
ARG NEXT_PUBLIC_APP_URL=http://localhost:8080
ENV NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=${NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY}
ENV NEXT_PUBLIC_APP_URL=${NEXT_PUBLIC_APP_URL}

RUN npm run build

# ── Runtime image ─────────────────────────────────────────────────────────────
FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

# Standalone output (only what's needed to run)
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static     ./.next/static

# SQL query files — read at runtime by lib/db/query.ts
COPY --from=builder /app/lib/queries      ./lib/queries

# Migrations — run manually (not auto-run in prod container)
COPY --from=builder /app/migrations       ./migrations

# Health check
HEALTHCHECK --interval=10s --timeout=5s --start-period=30s --retries=10 \
  CMD wget -q --spider http://localhost:3000/ || exit 1

EXPOSE 3000
CMD ["node", "server.js"]
