# Node 22: root package.json pins pnpm@11.8.0 + engines.node ">=22 <25";
# pnpm 11 crashes on Node 20 (ERR_UNKNOWN_BUILTIN_MODULE).
# slim (Debian/glibc) avoids needing @next/swc-linux-x64-musl (Alpine/musl)
# which is ~90 MB and unreliable on constrained links; the gnu variant is used
# instead and is already pnpm-store-cached from prior builds on this platform.
FROM node:22-slim AS base
WORKDIR /app

RUN corepack enable

# Dependencies stage
FROM base AS deps
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml turbo.json ./
COPY apps/web/package.json ./apps/web/
# Slow-network resilience: concurrency=1 serialises downloads so each large
# tarball gets full bandwidth; retry_maxtimeout=1h accommodates constrained
# links (next@15.5.19 is ~8.8 MB; at 6 KiB/s that is ~25 min).  Store +
# metadata cache mounts accumulate across runs so retries converge.
ENV npm_config_fetch_timeout=3600000 \
    npm_config_fetch_retries=5 \
    npm_config_fetch_retry_mintimeout=30000 \
    npm_config_fetch_retry_maxtimeout=3600000 \
    npm_config_network_concurrency=1 \
    npm_config_store_dir=/pnpm-store
RUN --mount=type=cache,id=pnpm-store,target=/pnpm-store \
    --mount=type=cache,id=pnpm-meta,target=/root/.cache/pnpm \
    pnpm install --no-frozen-lockfile --filter @sabiscore/web... \
    || { sleep 30; pnpm install --no-frozen-lockfile --filter @sabiscore/web...; } \
    || { sleep 60; pnpm install --no-frozen-lockfile --filter @sabiscore/web...; } \
    || { sleep 120; pnpm install --no-frozen-lockfile --filter @sabiscore/web...; }

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
# Cache the Next.js SWC binary so any fallback download persists across builds.
RUN --mount=type=cache,id=next-swc-cache,target=/root/.cache/next-swc \
    pnpm --config.verify-deps-before-run=false --filter @sabiscore/web build

# Production runner stage — slim keeps the final image small on glibc
FROM node:22-slim AS production
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs --no-create-home --disabled-password

# Copy standalone build
COPY --from=builder /app/apps/web/.next/standalone ./
COPY --from=builder /app/apps/web/.next/static ./apps/web/.next/static
COPY --from=builder /app/apps/web/public ./apps/web/public

RUN chown -R nextjs:nodejs /app

USER nextjs

EXPOSE 3000

CMD ["node", "apps/web/server.js"]
