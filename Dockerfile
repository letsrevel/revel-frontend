# syntax=docker/dockerfile:1.4

# ─────────────────────────────────────────────────────────────────────────────
# Stage 1: Builder - Install dependencies and build the application
# ─────────────────────────────────────────────────────────────────────────────
FROM node:22-slim AS builder

# Enable corepack for pnpm
RUN corepack enable

WORKDIR /app

# Copy dependency files
COPY package.json pnpm-lock.yaml ./

# Install dependencies with caching
RUN --mount=type=cache,target=/root/.local/share/pnpm/store \
    pnpm install --frozen-lockfile

# Copy source code
COPY . .

# Accept build arguments for environment variables
# These are required at BUILD time because Vite embeds them in the bundle
ARG PUBLIC_API_URL
ARG ORIGIN
ARG PUBLIC_VERSION

# Set as environment variables for the build process
ENV PUBLIC_API_URL=${PUBLIC_API_URL}
ENV ORIGIN=${ORIGIN}
ENV PUBLIC_VERSION=${PUBLIC_VERSION}

# Replace ALL hardcoded localhost references with actual URL
# Cannot regenerate API during build (backend not available in CI/CD)
RUN sed -i "s|'http://localhost:8000'|'${PUBLIC_API_URL}'|g" src/lib/api/generated/client.gen.ts && \
    sed -i "s|'http://localhost:8000'|'${PUBLIC_API_URL}'|g" src/lib/api/generated/types.gen.ts && \
    sed -i "s|'http://localhost:8000'|'${PUBLIC_API_URL}'|g" src/lib/config/api.ts && \
    sed -i "s|http://localhost:8000|${PUBLIC_API_URL}|g" src/lib/utils/url.ts

# Build the application
# This creates the production build in the `build` directory
# SvelteKit will embed PUBLIC_* env vars into the client bundle
RUN pnpm build

# ─────────────────────────────────────────────────────────────────────────────
# Stage 2: Runtime - Minimal production image
# ─────────────────────────────────────────────────────────────────────────────
FROM node:22-slim AS runtime

# Create non-root user
RUN useradd --create-home --system --shell /bin/bash appuser

WORKDIR /app

# Copy built application from builder
COPY --from=builder --chown=appuser:appuser /app/build ./build
COPY --from=builder --chown=appuser:appuser /app/node_modules ./node_modules
COPY --from=builder --chown=appuser:appuser /app/package.json ./package.json

# Copy version file
COPY --chown=appuser:appuser version ./version

# Set environment variables
ENV NODE_ENV=production
ENV PORT=3000
ENV HOST=0.0.0.0

# Switch to non-root user
USER appuser

# Expose port
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3000/', (r) => {process.exit(r.statusCode === 200 ? 0 : 1)})"

# Start the application
CMD ["node", "build"]
