# syntax=docker/dockerfile:1

# deps and builder run on the BUILD host platform (native amd64 on GitHub Actions).
# npm ci and next build are CPU-intensive — running them under QEMU emulation for
# arm64 is extremely slow. Next.js standalone output is pure JS, so the compiled
# artefacts are platform-agnostic and can be copied into the arm64 runtime image.

# ── Stage 1: deps ────────────────────────────────────────────────────────────
FROM --platform=$BUILDPLATFORM node:22-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm ci

# ── Stage 2: builder ─────────────────────────────────────────────────────────
FROM --platform=$BUILDPLATFORM node:22-alpine AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Standalone output bundles everything needed to run without node_modules at runtime
ENV NEXT_TELEMETRY_DISABLED=1
RUN npm run build

# ── Stage 3: runner (uses $TARGETPLATFORM — the actual arm64/amd64 image) ────
FROM node:22-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
# Override in k8s via env var pointing to your PVC mount path
ENV MOUNT_PATH=/data

RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nextjs

# Copy standalone build + static assets
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
COPY --from=builder --chown=nextjs:nodejs /app/public ./public

# Create default mount point
RUN mkdir -p /data && chown nextjs:nodejs /data

USER nextjs

EXPOSE 3000
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

CMD ["node", "server.js"]
