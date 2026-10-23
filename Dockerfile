# syntax=docker/dockerfile:1.4

# ─────────────────────────────────────────────────────────────────────────────
# Stage 1: Builder - Install dependencies and build the application
# ─────────────────────────────────────────────────────────────────────────────
# Pinned to 22.23.4 (root store NSS 3.131.1, eMudhra distrust): 22-slim still pointed at
# 22.23.3 on 2026-10-21. Go back to node:22-slim once it has moved past 22.23.4.
FROM node:22.23.4-slim AS builder

# Enable corepack for pnpm
RUN corepack enable

WORKDIR /app

# Copy dependency files (needed for pnpm install).
# pnpm-workspace.yaml holds overrides / allowBuilds (pnpm 11), so the install
# needs it or it would resolve unpatched/unhardened deps.
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./

# Install dependencies with caching
RUN --mount=type=cache,target=/root/.local/share/pnpm/store \
    pnpm install --frozen-lockfile

# Copy source code
COPY . .

# All PUBLIC_* values are read at RUNTIME, so nothing needs embedding here and a
# single prebuilt image can target any deployment (see #396):
#   - PUBLIC_API_URL via $env/dynamic/public
#   - PUBLIC_VERSION via $env/dynamic/public (set on the runtime stage below)
#   - ORIGIN / HOST_HEADER / PROTOCOL_HEADER by adapter-node (see below)

# Compile Paraglide i18n translations
# Generates runtime files from messages/*.json (en, de, it)
RUN pnpm paraglide:compile

# Build the application
# This creates the production build in the `build` directory
# SvelteKit will embed PUBLIC_* env vars into the client bundle
ENV NODE_OPTIONS="--max-old-space-size=8192"
RUN pnpm build

# ─────────────────────────────────────────────────────────────────────────────
# Stage 2: Runtime - Minimal production image
# ─────────────────────────────────────────────────────────────────────────────
FROM node:22.23.4-slim AS runtime

# Create non-root user
RUN useradd --create-home --system --shell /bin/bash appuser

WORKDIR /app

# Copy built application from builder
COPY --from=builder --chown=appuser:appuser /app/build ./build
COPY --from=builder --chown=appuser:appuser /app/node_modules ./node_modules
COPY --from=builder --chown=appuser:appuser /app/package.json ./package.json

# Set environment variables
ENV NODE_ENV=production
ENV PORT=3000
ENV HOST=0.0.0.0

# PUBLIC_VERSION is known at build time (git tag) but read at runtime via
# $env/dynamic/public, so bake the build arg into the runtime env. Falls back to
# 'dev' in the footer if unset.
ARG PUBLIC_VERSION
ENV PUBLIC_VERSION=${PUBLIC_VERSION}

# RUNTIME configuration (set these when running the container, e.g. via
# `docker run -e` or compose). PUBLIC_API_URL points the frontend at your
# backend; it is read at runtime via $env/dynamic/public, so the same image
# works for any deployment. Falls back to http://localhost:8000 if unset.
#   - PUBLIC_API_URL  (e.g. https://api.example.com)
#   - HOST_HEADER=x-forwarded-host and PROTOCOL_HEADER=x-forwarded-proto
#                     (multi-host / tenant deploys: adapter-node derives the origin
#                     from the proxy headers per request, so CSRF checks, url.origin
#                     and form actions follow the real host. A request missing the
#                     headers, e.g. the localhost HEALTHCHECK, falls back to the Host
#                     header and https.)
#   - ORIGIN          (single-host deploys only: pins the public origin. Do NOT set it
#                     together with the two headers above; it would win.)
#   - PLATFORM_HOSTS  (comma-separated platform hostnames, no ports. Tenant mode is
#                     off while unset. Any other host is resolved as an organization
#                     custom domain; unknown hosts get 404. localhost/127.0.0.1/::1
#                     are always platform.)

# Switch to non-root user
USER appuser

# Expose port
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3000/', (r) => {process.exit(r.statusCode === 200 ? 0 : 1)})"

# Start the application
CMD ["node", "build"]
