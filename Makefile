.PHONY: setup dev test test-e2e lint build clean

# ─── Setup ────────────────────────────────────────────────────────────────────

## setup: Install dependencies, copy .env, start infra, run migrations and seed
setup:
	pnpm install
	@if [ ! -f .env ]; then cp .env.example .env; echo "Created .env from .env.example — update values before starting"; fi
	docker compose up -d postgres redis
	pnpm exec prisma migrate deploy
	pnpm run seed

# ─── Development ──────────────────────────────────────────────────────────────

## dev: Start the API in watch mode
dev:
	pnpm run start:dev

# ─── Testing ──────────────────────────────────────────────────────────────────

## test: Run all unit tests
test:
	pnpm run test:unit

## test-e2e: Run end-to-end tests (requires running postgres + redis)
test-e2e:
	pnpm run test:e2e

# ─── Code Quality ─────────────────────────────────────────────────────────────

## lint: Run ESLint with auto-fix and Prettier format check
lint:
	pnpm run lint
	pnpm run format:check

# ─── Build ────────────────────────────────────────────────────────────────────

## build: Compile TypeScript via NestJS CLI
build:
	pnpm run build

# ─── Clean ────────────────────────────────────────────────────────────────────

## clean: Remove compiled output, node_modules, and docker volumes
clean:
	rm -rf dist
	rm -rf node_modules
	docker compose down -v

# ─── Help ─────────────────────────────────────────────────────────────────────

## help: Show this help message
help:
	@grep -E '^## ' Makefile | sed 's/## /  /'
