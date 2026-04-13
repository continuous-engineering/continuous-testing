# continuous.testing — Stateless Runner
#
# STANDALONE container — separate from the web app (ADR-001).
# Polls the CT API for jobs, executes DAGs, posts results.
# Never shares a process or filesystem with the Next.js web app.
#
# Architecture (ADR-001):
#   One DAG = one runner container = one process = one in-memory ctx map.
#   Multiple runner containers run concurrently — no shared state.
#   Runner calls CT API via http://caddy (inside Docker network).

# ── Build stage ───────────────────────────────────────────────────────────────
FROM node:22-alpine AS builder
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY tsconfig.json ./
COPY src/ ./src/
RUN npx tsc

# ── Runtime stage — Playwright base (Chromium bundled) ───────────────────────
FROM mcr.microsoft.com/playwright:v1.48.0-focal
WORKDIR /app

# Production deps only
COPY package.json package-lock.json ./
RUN npm ci --omit=dev

# Compiled source from build stage
COPY --from=builder /app/dist ./dist

# ── Runtime environment ───────────────────────────────────────────────────────
ENV CT_API_BASE=""
ENV RUNNER_TOKEN=""
ENV RUNNER_SCOPE="self-hosted"
ENV ANTHROPIC_API_KEY=""
ENV POLL_INTERVAL_MS="5000"
ENV HEARTBEAT_INTERVAL_MS="30000"
ENV NODE_ENV="production"

# ── Health check — heartbeat file written every 30s ──────────────────────────
HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD node -e "\
    const fs = require('fs'); \
    const f = '/tmp/ct-runner-heartbeat'; \
    if (!fs.existsSync(f)) process.exit(1); \
    const age = Date.now() - fs.statSync(f).mtimeMs; \
    process.exit(age > 90000 ? 1 : 0);"

CMD ["node", "dist/index.js"]
