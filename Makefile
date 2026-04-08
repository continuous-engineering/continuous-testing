# Continuous.Testing — Makefile
# ─────────────────────────────────────────────────────────────────────────────
# Windows: run from Git Bash (ships with Git for Windows).
#          All targets are also available as:  npm run <target>
# macOS / Linux: standard make, no extras needed.
# ─────────────────────────────────────────────────────────────────────────────

.PHONY: help install dev start build release lint check clean clean-all

# ── Default ───────────────────────────────────────────────────────────────────
help:
	@echo ""
	@echo "  Continuous.Testing — available targets"
	@echo ""
	@echo "  make install     Install npm dependencies"
	@echo "  make dev         Start in development mode (DevTools open)"
	@echo "  make start       Start normally"
	@echo "  make build       Build distributable (dist/)"
	@echo "  make release     Clean build — clean + install + build"
	@echo "  make lint        Syntax-check all source files"
	@echo "  make check       Alias for lint"
	@echo "  make clean       Remove dist/ and build caches"
	@echo "  make clean-all   Remove dist/ AND node_modules/ (full reset)"
	@echo ""
	@echo "  Equivalent npm commands are available if make is not installed."
	@echo ""

# ── Setup ─────────────────────────────────────────────────────────────────────
install: package.json
	npm install

# ── Run ───────────────────────────────────────────────────────────────────────
dev: node_modules
	npm run dev

start: node_modules
	npm start

# ── Build ─────────────────────────────────────────────────────────────────────
build: node_modules lint
	npm run build

# Full clean build — use this before cutting a release
release: clean install lint
	npm run build
	@echo ""
	@echo "  Build complete. Output: dist/"
	@echo ""

# ── Quality ───────────────────────────────────────────────────────────────────
lint: node_modules
	npm run lint:all

check: lint

# ── Clean ─────────────────────────────────────────────────────────────────────
clean:
	npm run clean

clean-all:
	npm run clean:all

# ── Guards ────────────────────────────────────────────────────────────────────
node_modules: package.json
	npm install
	@touch node_modules  # update timestamp so make knows it's fresh
