# Leaderboard — common tasks.
# Everything runs in Docker; there is no Node on the host.
# Run `make` or `make help` to list targets.

.DEFAULT_GOAL := help
SHELL := /usr/bin/env bash

# Passed to the app service so files written into the bind mount — node_modules,
# .next, generated types — stay owned by you rather than by root.
export DOCKER_UID := $(shell id -u)
export DOCKER_GID := $(shell id -g)

COMPOSE := docker compose
# A one-off command in a throwaway container: works whether or not the stack is up.
RUN     := $(COMPOSE) run --rm app

.PHONY: help up down restart logs shell install dev build image lint lint-fix \
        format format-check typecheck test test-watch check clean nuke

##@ General

help: ## List available targets
	@awk 'BEGIN {FS = ":.*##"; printf "\nUsage: make \033[36m<target>\033[0m\n"} \
		/^[a-zA-Z_0-9-]+:.*?##/ { printf "  \033[36m%-14s\033[0m %s\n", $$1, $$2 } \
		/^##@/ { printf "\n\033[1m%s\033[0m\n", substr($$0, 5) }' $(MAKEFILE_LIST)
	@echo

##@ Stack

up: ## Build the image, install dependencies and start the app
	$(COMPOSE) build
	@$(MAKE) --no-print-directory install
	$(COMPOSE) up -d
	@echo "→ app: http://localhost:3000"

down: ## Stop and remove the containers
	$(COMPOSE) down

restart: ## Restart the app container
	$(COMPOSE) restart app

logs: ## Follow the app logs
	$(COMPOSE) logs -f app

shell: ## Open a shell in the app container
	$(RUN) sh

##@ Development

install: ## Install dependencies into the bind mount
	$(RUN) pnpm install

dev: ## Run the dev server in the foreground
	$(COMPOSE) up

build: ## Production build, inside the dev container
	$(RUN) pnpm build

image: ## Build the production image exactly as the homelab will
	docker build --target runner -t leaderboard:local .

##@ Quality

lint: ## Lint
	$(RUN) pnpm lint

lint-fix: ## Lint and fix what can be fixed
	$(RUN) pnpm lint:fix

format: ## Format with Prettier
	$(RUN) pnpm format

format-check: ## Fail if anything is unformatted
	$(RUN) pnpm format:check

typecheck: ## Type-check without emitting
	$(RUN) pnpm typecheck

test: ## Unit tests (Vitest)
	$(RUN) pnpm test

test-watch: ## Unit tests in watch mode
	$(RUN) pnpm test:watch

check: ## Everything CI runs: format, lint, types, tests
	$(RUN) sh -c "pnpm format:check && pnpm lint && pnpm typecheck && pnpm test"

##@ Housekeeping

clean: ## Remove build output and caches
	rm -rf .next out coverage test-results playwright-report *.tsbuildinfo

nuke: clean ## Also remove node_modules and the pnpm store
	$(COMPOSE) down -v
	rm -rf node_modules .pnpm-store
