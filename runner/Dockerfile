# continuous.testing — Stateless Runner
#
# This is a STANDALONE container — separate from the web app.
# It polls the CT SaaS API for test jobs, executes DAGs, posts results back.
# Never shares a process or filesystem with the Next.js web app.
#
# Execution model (ADR-001):
#   One DAG = one runner = one process = one in-memory ctx map.
#   No shared state between concurrent runner containers.
#
# Base: Microsoft's official Playwright image — Chromium bundled and pre-configured.
# Chromium runs headless inside this container for UI test steps.

FROM mcr.microsoft.com/playwright:v1.48.0-focal

WORKDIR /app

# ── Dependencies (separate layer for cache efficiency) ──────────────────────
COPY package.json package-lock.json ./
RUN npm ci --omit=dev

# ── Compiled source ─────────────────────────────────────────────────────────
# Build locally before docker build: npm run build
COPY dist/ ./dist/

# ── Runtime environment ──────────────────────────────────────────────────────
# Required — no defaults for security-sensitive vars
ENV CT_API_BASE=""
ENV RUNNER_TOKEN=""
ENV RUNNER_SCOPE="self-hosted"
ENV ANTHROPIC_API_KEY=""

# Optional tuning
ENV POLL_INTERVAL_MS="5000"
ENV HEARTBEAT_INTERVAL_MS="30000"
ENV NODE_ENV="production"

# ── Health check ─────────────────────────────────────────────────────────────
# Runner writes a heartbeat file every 30s. Health check reads it.
# File age > 90s = unhealthy (missed 3 heartbeats).
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD node -e "\
    const fs = require('fs'); \
    const f = '/tmp/ct-runner-heartbeat'; \
    if (!fs.existsSync(f)) process.exit(1); \
    const age = Date.now() - fs.statSync(f).mtimeMs; \
    process.exit(age > 90000 ? 1 : 0);"

# ── Entry point ──────────────────────────────────────────────────────────────
CMD ["node", "dist/index.js"]
