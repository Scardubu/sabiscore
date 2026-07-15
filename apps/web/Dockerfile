# Base stage with dependencies.
# Node 22: root package.json pins pnpm@11.8.0 + engines.node ">=22 <25";
# pnpm 11 crashes on Node 20 (ERR_UNKNOWN_BUILTIN_MODULE).
FROM node:22-alpine AS base
RUN apk add --no-cache libc6-compat
WORKDIR /app

RUN corepack enable

# Dependencies stage
FROM base AS deps
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml turbo.json ./
COPY apps/web/package.json ./apps/web/
# Slow-network resilience: low concurrency stops per-request starvation on
# constrained links; store + metadata cache mounts let every attempt keep its
# downloads, and the bounded in-RUN retry converges instead of restarting.
# The final exit code stays honest — this is retry, not || true.
ENV npm_config_fetch_timeout=600000 \
    npm_config_fetch_retries=5 \
    npm_config_fetch_retry_maxtimeout=120000 \
    npm_config_network_concurrency=4 \
    npm_config_store_dir=/pnpm-store
RUN --mount=type=cache,id=pnpm-store,target=/pnpm-store \
    --mount=type=cache,id=pnpm-meta,target=/root/.cache/pnpm \
    pnpm install --no-frozen-lockfile --filter @sabiscore/web... \
    || { sleep 10; pnpm install --no-frozen-lockfile --filter @sabiscore/web...; } \
    || { sleep 30; pnpm install --no-frozen-lockfile --filter @sabiscore/web...; }

# Builder stage
FROM base AS builder
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/apps/web/node_modules ./apps/web/node_modules
COPY . .

# Build the Next.js app
ENV NEXT_TELEMETRY_DISABLED=1
ENV NODE_ENV=production
ENV NEXT_STANDALONE=true
# deps stage just installed node_modules; pnpm 11's pre-run deps check would
# see the missing store (cache-mount, deps-stage-only) and purge + reinstall.
# Cache the Next.js SWC binary so network retries converge across builds.
RUN --mount=type=cache,id=next-swc-cache,target=/root/.cache/next-swc \
    pnpm --config.verify-deps-before-run=false --filter @sabiscore/web build

# Production runner stage
FROM node:22-alpine AS production
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

# Copy standalone build
COPY --from=builder /app/apps/web/.next/standalone ./
COPY --from=builder /app/apps/web/.next/static ./apps/web/.next/static
COPY --from=builder /app/apps/web/public ./apps/web/public

RUN chown -R nextjs:nodejs /app

USER nextjs

EXPOSE 3000

CMD ["node", "apps/web/server.js"]
