# syntax=docker/dockerfile:1

ARG NODE_VERSION=22-alpine

# ---------------------------------------------------------------------------
# base — toolchain shared by every stage
# ---------------------------------------------------------------------------
FROM node:${NODE_VERSION} AS base

# Next.js needs this on alpine for a few native modules.
RUN apk add --no-cache libc6-compat

# Corepack's cache goes somewhere world-readable: the dev container runs as the
# host's uid, which has no writable HOME of its own.
ENV COREPACK_HOME=/opt/corepack \
    NEXT_TELEMETRY_DISABLED=1

WORKDIR /app

# Installs the exact pnpm named in package.json's packageManager field. The
# `pnpm --version` is not a smoke test: pnpm 12 fetches a platform-native binary
# on first run, and the dev container runs as a uid that cannot write to the
# cache. Warming it here as root means it is already there, read-only, at runtime.
COPY package.json ./
RUN corepack enable \
    && corepack install \
    && pnpm --version \
    && chmod -R a+rX "$COREPACK_HOME"

# ---------------------------------------------------------------------------
# deps — production + dev dependencies, resolved once
# ---------------------------------------------------------------------------
FROM base AS deps

COPY pnpm-lock.yaml pnpm-workspace.yaml ./
RUN pnpm install --frozen-lockfile

# ---------------------------------------------------------------------------
# dev — the working container; source arrives as a bind mount at runtime
# ---------------------------------------------------------------------------
FROM base AS dev

# The bind mount hides anything baked in at /app, so dependencies are installed
# into the mount by `make install` and persist on the host — as does pnpm's own
# store, which pnpm 12 keeps under node_modules. HOME is set because the
# container runs as the host uid, which has no home directory of its own.
#
# NODE_ENV is deliberately NOT pinned to development here: `next dev` sets it
# itself, while `next build` run inside this same container with NODE_ENV
# already set to development fails prerendering with a null React dispatcher.
ENV HOME=/tmp

EXPOSE 3000
CMD ["pnpm", "dev"]

# ---------------------------------------------------------------------------
# builder — produces the standalone server bundle
# ---------------------------------------------------------------------------
FROM base AS builder

COPY pnpm-lock.yaml pnpm-workspace.yaml ./
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN pnpm build

# ---------------------------------------------------------------------------
# runner — what actually ships to the homelab
# ---------------------------------------------------------------------------
FROM node:${NODE_VERSION} AS runner

WORKDIR /app
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=3000 \
    HOSTNAME=0.0.0.0

RUN addgroup -g 1001 -S nodejs && adduser -S -u 1001 -G nodejs nextjs

COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

USER nextjs
EXPOSE 3000
CMD ["node", "server.js"]
