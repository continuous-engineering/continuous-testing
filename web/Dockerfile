# continuous.testing — Web App
# Next.js 15 standalone build
# SQL .sql files must be bundled since query.ts reads them at runtime via readFileSync

FROM node:22-bookworm-slim AS builder
WORKDIR /app

# Deps layer (cached unless package files change)
# Copy only package.json — let Docker regenerate lockfile fresh (avoids stale Windows lockfile)
COPY package.json ./
RUN npm install --legacy-peer-deps

# Source
COPY . .

# Build — requires NEXT_PUBLIC_ vars at build time (baked into client bundle)
ARG NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY
ARG NEXT_PUBLIC_APP_URL=http://localhost:8080
ENV NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=${NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY}
ENV NEXT_PUBLIC_APP_URL=${NEXT_PUBLIC_APP_URL}

RUN npm run build

# ── Runtime image ─────────────────────────────────────────────────────────────
FROM node:22-bookworm-slim AS runner
RUN apt-get update && apt-get install -y curl --no-install-recommends && rm -rf /var/lib/apt/lists/*
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

# Health check — use node to avoid needing curl/wget in slim image
HEALTHCHECK --interval=5s --timeout=3s --start-period=20s --retries=20 \
  CMD node -e "require('http').get('http://localhost:3000/',r=>r.statusCode<500?process.exit(0):process.exit(1)).on('error',()=>process.exit(1))"

EXPOSE 3000
CMD ["node", "server.js"]
