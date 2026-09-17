# Leaderboard — common tasks.
# Run `make` or `make help` to list targets.

.DEFAULT_GOAL := help
SHELL := /usr/bin/env bash

PNPM     ?= pnpm
SUPABASE ?= $(PNPM) supabase

.PHONY: help install dev build start lint format typecheck test test-watch test-e2e check \
        db-start db-stop db-reset db-diff db-types clean

##@ General

help: ## List available targets
	@awk 'BEGIN {FS = ":.*##"; printf "\nUsage: make \033[36m<target>\033[0m\n"} \
		/^[a-zA-Z_0-9-]+:.*?##/ { printf "  \033[36m%-14s\033[0m %s\n", $$1, $$2 } \
		/^##@/ { printf "\n\033[1m%s\033[0m\n", substr($$0, 5) }' $(MAKEFILE_LIST)
	@echo

##@ Setup

install: ## Install dependencies
	$(PNPM) install

##@ Development

dev: ## Start the Next.js dev server
	$(PNPM) dev

build: ## Production build
	$(PNPM) build

start: ## Serve the production build
	$(PNPM) start

##@ Quality

lint: ## Lint
	$(PNPM) lint

format: ## Format with Prettier
	$(PNPM) format

typecheck: ## Type-check without emitting
	$(PNPM) typecheck

test: ## Unit tests (Vitest)
	$(PNPM) test

test-watch: ## Unit tests in watch mode
	$(PNPM) test:watch

test-e2e: ## End-to-end tests (Playwright)
	$(PNPM) test:e2e

check: lint typecheck test ## Everything CI runs

##@ Database

db-start: ## Start local Supabase
	$(SUPABASE) start

db-stop: ## Stop local Supabase
	$(SUPABASE) stop

db-reset: ## Reset local DB: re-run migrations + seed
	$(SUPABASE) db reset

db-diff: ## Generate a migration from local schema changes (make db-diff name=add_seasons)
	$(SUPABASE) db diff -f $(name)

db-types: ## Regenerate TypeScript types from the local DB
	$(SUPABASE) gen types typescript --local > lib/db/database.types.ts

##@ Housekeeping

clean: ## Remove build output and caches
	rm -rf .next out coverage test-results playwright-report *.tsbuildinfo
