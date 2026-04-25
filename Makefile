# HostelMate Makefile — convenience aliases for common development tasks
# Usage: `make <target>`

.PHONY: install dev build test lint test-e2e test-coverage clean docker-up docker-down help

## ─── Setup ───────────────────────────────────────────────────────────────────

install: ## Install all monorepo dependencies (also installs Husky hooks)
	pnpm install

## ─── Development ─────────────────────────────────────────────────────────────

dev: ## Start both client (port 3000) and server (port 3001) in dev mode
	pnpm dev

dev-client: ## Start only the Next.js client
	cd apps/client && pnpm dev

dev-server: ## Start only the Express API server
	cd apps/server && pnpm dev

## ─── Quality ─────────────────────────────────────────────────────────────────

lint: ## Run ESLint across the entire monorepo
	pnpm lint

typecheck: ## Run TypeScript type checker on the client app
	cd apps/client && pnpm exec tsc --noEmit

## ─── Testing ─────────────────────────────────────────────────────────────────

test: ## Run all Jest integration tests (23 suites, 261 tests)
	pnpm test

test-watch: ## Run Jest in watch mode
	cd apps/server && pnpm test:watch

test-coverage: ## Run Jest with coverage report (≥80% threshold enforced)
	cd apps/server && pnpm test:coverage

test-e2e: ## Run Playwright E2E tests (headless Chromium, auto-starts servers)
	cd apps/client && pnpm test:e2e

test-e2e-ui: ## Open Playwright interactive UI for time-travel debugging
	cd apps/client && pnpm test:e2e-ui

## ─── Build ───────────────────────────────────────────────────────────────────

build: ## Build the Next.js client for production
	cd apps/client && pnpm build

build-all: ## Build the full monorepo (Turborepo orchestration)
	pnpm turbo build

## ─── Docker ──────────────────────────────────────────────────────────────────

docker-up: ## Build and start all Docker services (client + server)
	docker compose up --build

docker-down: ## Stop and remove all Docker containers
	docker compose down

docker-logs: ## Tail logs from all running Docker containers
	docker compose logs -f

## ─── Cleanup ─────────────────────────────────────────────────────────────────

clean: ## Remove .next, .turbo, and node_modules build artifacts
	rm -rf apps/client/.next
	rm -rf .turbo
	@echo "✅ Cleaned build artifacts"

clean-all: ## Remove all node_modules (full reinstall required after)
	find . -name "node_modules" -type d -prune -exec rm -rf '{}' +
	@echo "✅ Removed all node_modules"

## ─── Help ────────────────────────────────────────────────────────────────────

help: ## Show this help message
	@echo ""
	@echo "HostelMate — Available make targets:"
	@echo ""
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) \
		| awk 'BEGIN {FS = ":.*?## "}; {printf "  \033[36m%-20s\033[0m %s\n", $$1, $$2}'
	@echo ""
