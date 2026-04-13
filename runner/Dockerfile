# continuous.testing Runner
# Base: official Playwright image — Chromium, Firefox, WebKit pre-installed
# We bundle Chromium only at runtime (other browsers available but not default)
FROM mcr.microsoft.com/playwright:v1.48.0-focal

WORKDIR /app

# Install deps first (better layer caching)
COPY package.json ./
RUN npm install --omit=dev

# Copy compiled source (build before docker build: npm run build)
COPY dist/ dist/

# Runtime env vars — all required, no defaults for security-sensitive ones
ENV CT_API_BASE=""
ENV RUNNER_TOKEN=""
ENV RUNNER_SCOPE="self-hosted"
ENV ANTHROPIC_API_KEY=""

# Health: runner exits on SIGTERM, orchestrator restarts
HEALTHCHECK --interval=30s --timeout=5s --retries=3 \
  CMD node -e "require('http').get('http://localhost:8080/health', r => r.statusCode === 200 ? process.exit(0) : process.exit(1)).on('error', () => process.exit(1))"

CMD ["node", "dist/index.js"]
