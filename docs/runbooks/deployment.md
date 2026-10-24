# Deployment Guide

This document describes how to deploy the Revel Frontend application using Docker and CI/CD.

## Prerequisites

- Docker installed
- Access to GitHub Container Registry (GHCR)
- Backend API running (default: `http://localhost:8000`)

## Docker Deployment

### Building the Image

```bash
# Build the Docker image.
# NOTE: PUBLIC_API_URL, ORIGIN and the tenant-mode variables are read at RUNTIME (issue #396), not baked
# into the bundle — set them when you run the container (see below). The same
# image therefore works against any backend. Only PUBLIC_VERSION (shown in the
# footer) is embedded at build time.
docker build \
  --build-arg PUBLIC_VERSION=0.1.2 \
  -t revel-frontend:latest .

# Or with a specific version from the version file
VERSION=$(cat version)
docker build \
  --build-arg PUBLIC_VERSION=$VERSION \
  -t revel-frontend:$VERSION .

# For a local development build:
docker build \
  --build-arg PUBLIC_VERSION=dev \
  -t revel-frontend:dev .
```

### Running the Container

```bash
# Run with default settings
docker run -p 3000:3000 -e PUBLIC_API_URL=http://localhost:8000 revel-frontend:latest

# Run with custom environment variables
docker run -p 3000:3000 \
  -e PUBLIC_API_URL=https://api.revel.example.com \
  -e ORIGIN=https://revel.example.com \
  -e NODE_ENV=production \
  revel-frontend:latest

# Multi-host (organization custom domains): no ORIGIN, derive it per request
docker run -p 3000:3000 \
  -e PUBLIC_API_URL=https://api.revel.example.com \
  -e HOST_HEADER=x-forwarded-host \
  -e PROTOCOL_HEADER=x-forwarded-proto \
  -e PLATFORM_HOSTS=revel.example.com \
  -e PLATFORM_ORIGIN=https://revel.example.com \
  -e PUBLIC_CUSTOM_DOMAIN_URL_TEMPLATE='https://{hostname}' \
  -e NODE_ENV=production \
  revel-frontend:latest
```

### Environment Variables

| Variable                     | Description                                                               | Default                 | Required |
| ---------------------------- | ------------------------------------------------------------------------- | ----------------------- | -------- |
| `PUBLIC_API_URL`             | Backend API base URL (runtime)                                            | `http://localhost:8000` | Yes      |
| `PUBLIC_VERSION`             | Frontend version displayed in footer (build-time)                         | `dev`                   | No       |
| `PUBLIC_HIDE_SOLUTIONS_FOOTER` | Hide the footer's "Solutions" marketing column (runtime); `true` to hide | unset (shown)           | No       |
| `ORIGIN`                     | Pins the public origin used for the CSRF same-origin check, `url.origin` and form actions (runtime). **Single-host deploys only.** When set it wins over the two headers below, so leave it unset for multi-host | unset (origin derived from the request) | Single-host |
| `HOST_HEADER`                | Header carrying the public host, e.g. `x-forwarded-host`. Multi-host (custom domains) deploys; replaces `ORIGIN` | unset | Multi-host |
| `PROTOCOL_HEADER`            | Header carrying the public scheme, e.g. `x-forwarded-proto`. Pair with `HOST_HEADER`; the scheme is `https` when the header is absent | unset | Multi-host |
| `PLATFORM_HOSTS`             | Comma-separated platform hostnames, no ports, case-insensitive. Unset turns tenant mode off: no custom-domain redirect, link rewrite or route scoping happens, even if the backend returns a `custom_domain`. Any other host is resolved as an organization custom domain (unknown: 404; backend down: 503). `localhost`, `127.0.0.1` and `::1` are always platform | unset | Multi-host |
| `PLATFORM_ORIGIN`            | Origin (`https://app.example.com`) that platform-only paths (`/org/*/admin`, `/create-org`, `/oauth/*`, `/impersonate`) are redirected to from a tenant host, and that "Powered by Revel" and links to organizations without a custom domain (from a tenant host) point to. Shared with the client as `customDomains.platformOrigin` | `https://` + first `PLATFORM_HOSTS` entry | No |
| `PUBLIC_CUSTOM_DOMAIN_URL_TEMPLATE` | URL template for absolute custom-domain links, 301s and SEO canonicals. Must start with `http://` or `https://` and contain `{hostname}`; invalid values fall back to the default and log once. Public runtime env (read in the browser too). Keep in sync with the backend's `CUSTOM_DOMAIN_URL_TEMPLATE`; dev/E2E use `http://{hostname}:5173` | `https://{hostname}` | No |
| `PORT`                       | Server port                                                               | `3000`                  | No       |
| `HOST`                       | Server host                                                               | `0.0.0.0`               | No       |
| `NODE_ENV`                   | Node environment                                                          | `production`            | No       |

`ORIGIN` has no default. Left unset, adapter-node builds the origin from the `Host` header and
assumes `https`. A plain-HTTP single-host setup therefore needs `ORIGIN=http://...`.

Custom domains, DNS and TLS are covered in [`../tenant-mode.md`](../tenant-mode.md) (frontend
behavior) and the backend operator docs.

#### Hiding the footer's Solutions column

Self-hosted instances that only run their own ticketing get marketing links
(Eventbrite alternative, queer/kink/clubs, referral) that don't apply to them
and can confuse buyers. Set `PUBLIC_HIDE_SOLUTIONS_FOOTER=true` to drop the whole
Solutions column; the Legal and Resources columns reflow to fill the footer.

Like `PUBLIC_API_URL`, this is read at **runtime** via `$env/dynamic/public`, so
one prebuilt image serves both audiences — set it when you run the container and
restart.

```bash
docker run -p 3000:3000 \
  -e PUBLIC_API_URL=https://api.revel.example.com \
  -e PUBLIC_HIDE_SOLUTIONS_FOOTER=true \
  revel-frontend:latest
```

## CI/CD Pipeline

### Workflows

The project uses three GitHub Actions workflows:

#### 1. **test.yaml** - Pull Request Testing

- Triggers on: PR creation/update
- Runs:
  - pnpm lockfile validation
  - TypeScript type checking (`pnpm check`)
  - Linting (`pnpm lint`)
  - Unit tests (`pnpm test`)
  - Production build

#### 2. **build.yaml** - Docker Image Build

- Triggers on: Push/PR to `main`
- Runs:
  - Builds Docker image (doesn't push)
  - Tags with version from `version` file
  - Validates Docker build succeeds

#### 3. **publish.yaml** - Release Publishing

- Triggers on: GitHub Release published
- Runs:
  - Builds Docker image
  - Pushes to GitHub Container Registry
  - Tags as `latest` and release version

### Release Process

1. **Update version file:**

   ```bash
   echo "0.2.0" > version
   git add version
   git commit -m "chore: bump version to 0.2.0"
   ```

2. **Create and push tag:**

   ```bash
   git tag v0.2.0
   git push && git push --tags
   ```

3. **Create GitHub Release:**

   ```bash
   gh release create v0.2.0 --title "Release v0.2.0" --notes "Release notes here"
   ```

4. **Automated publishing:**
   - GitHub Actions automatically builds and pushes Docker image to GHCR
   - Image available at: `ghcr.io/letsrevel/revel-frontend:v0.2.0`
   - Also tagged as `latest`

### Pulling Published Images

```bash
# Pull latest version
docker pull ghcr.io/letsrevel/revel-frontend:latest

# Pull specific version
docker pull ghcr.io/letsrevel/revel-frontend:v0.1.0
```

## Production Deployment

### Docker Compose Example

```yaml
version: '3.8'

services:
  frontend:
    image: ghcr.io/letsrevel/revel-frontend:latest
    ports:
      - '3000:3000'
    environment:
      - PUBLIC_API_URL=https://api.revel.example.com
      - ORIGIN=https://revel.example.com
    restart: unless-stopped
    healthcheck:
      test:
        [
          'CMD',
          'node',
          '-e',
          "require('http').get('http://localhost:3000/', (r) => {process.exit(r.statusCode === 200 ? 0 : 1)})"
        ]
      interval: 30s
      timeout: 3s
      retries: 3
```

#### Multi-host variant (custom domains)

Use this when organizations are served on their own domains. Do **not** set `ORIGIN`: it would win
and pin every host to the platform. The reverse proxy in front must send the original host and
scheme in `X-Forwarded-Host` and `X-Forwarded-Proto` (and overwrite any values from the client).

```yaml
services:
  frontend:
    image: ghcr.io/letsrevel/revel-frontend:latest
    ports:
      - '3000:3000'
    environment:
      - PUBLIC_API_URL=https://api.revel.example.com
      - HOST_HEADER=x-forwarded-host
      - PROTOCOL_HEADER=x-forwarded-proto
      - PLATFORM_HOSTS=revel.example.com
      - PLATFORM_ORIGIN=https://revel.example.com
      - PUBLIC_CUSTOM_DOMAIN_URL_TEMPLATE=https://{hostname}
    restart: unless-stopped
```

The health check above keeps working: `localhost` is always a platform host, and a request without
the forwarded headers falls back to the `Host` header.

### Kubernetes Example

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: revel-frontend
spec:
  replicas: 3
  selector:
    matchLabels:
      app: revel-frontend
  template:
    metadata:
      labels:
        app: revel-frontend
    spec:
      containers:
        - name: frontend
          image: ghcr.io/letsrevel/revel-frontend:latest
          ports:
            - containerPort: 3000
          env:
            - name: PUBLIC_API_URL
              value: 'https://api.revel.example.com'
            - name: ORIGIN
              value: 'https://revel.example.com'
          livenessProbe:
            httpGet:
              path: /
              port: 3000
            initialDelaySeconds: 5
            periodSeconds: 30
          readinessProbe:
            httpGet:
              path: /
              port: 3000
            initialDelaySeconds: 3
            periodSeconds: 10
---
apiVersion: v1
kind: Service
metadata:
  name: revel-frontend
spec:
  selector:
    app: revel-frontend
  ports:
    - port: 80
      targetPort: 3000
  type: LoadBalancer
```

For the multi-host variant, replace the `ORIGIN` entry in `env` with:

```yaml
- name: HOST_HEADER
  value: 'x-forwarded-host'
- name: PROTOCOL_HEADER
  value: 'x-forwarded-proto'
- name: PLATFORM_HOSTS
  value: 'revel.example.com'
- name: PLATFORM_ORIGIN
  value: 'https://revel.example.com'
- name: PUBLIC_CUSTOM_DOMAIN_URL_TEMPLATE
  value: 'https://{hostname}'
```

Your ingress must forward `X-Forwarded-Host` and `X-Forwarded-Proto` and route custom-domain hostnames
to this service.

What the proxy has to do for custom domains (overwrite the forwarded headers, an on-demand TLS
catch-all, per-site HSTS, the CNAME target, Turnstile hostnames) is in
[Reverse proxy and TLS](../tenant-mode.md#reverse-proxy-and-tls).

## Health Checks

The Docker image includes a built-in health check that pings the root endpoint:

```bash
# Check container health
docker ps

# View health check logs
docker inspect --format='{{json .State.Health}}' <container_id>
```

## Troubleshooting

### Build Failures

- **TypeScript errors:** Run `pnpm check` locally to catch type errors
- **Missing dependencies:** Ensure `pnpm-lock.yaml` is committed
- **Build timeout:** Increase Docker build timeout if needed

### Runtime Issues

- **API Connection Errors:** Verify `PUBLIC_API_URL` is correct and accessible
- **CORS Issues:** Ensure backend allows requests from your public origin (`ORIGIN`, or each custom domain in multi-host mode)
- **Form posts fail with 403 on a custom domain:** `ORIGIN` is set (it pins one host). Unset it and use `HOST_HEADER`/`PROTOCOL_HEADER`
- **404 "Not found" on a domain:** it is not in `PLATFORM_HOSTS` and the backend does not know it as an organization's custom domain
- **503 on a domain:** the by-domain lookup to the backend failed; check `PUBLIC_API_URL`/`INTERNAL_API_URL` reachability
- **Port Conflicts:** Change `PORT` environment variable if 3000 is in use

### Logs

```bash
# View container logs
docker logs <container_id>

# Follow logs in real-time
docker logs -f <container_id>
```

## Security Notes

- Docker image runs as non-root user (`appuser`)
- Health checks use Node.js built-in http module
- No secrets are baked into the image
- Environment variables should be injected at runtime
- Use secrets management for sensitive configuration

## Performance

- Multi-stage build keeps image size small (~200MB)
- Layer caching speeds up subsequent builds
- pnpm store cache reduces dependency installation time
- Production build is optimized and minified

## Monitoring

Consider adding:

- Application Performance Monitoring (APM)
- Error tracking (Sentry, etc.)
- Log aggregation (ELK, Loki, etc.)
- Metrics collection (Prometheus, etc.)
