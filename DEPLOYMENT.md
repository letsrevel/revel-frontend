# Deployment Guide

This document describes how to deploy the Revel Frontend application using Docker and CI/CD.

## Prerequisites

- Docker installed
- Access to GitHub Container Registry (GHCR)
- Backend API running (default: `http://localhost:8000`)

## Docker Deployment

### Building the Image

```bash
# Build the Docker image
docker build -t revel-frontend:latest .

# Or with a specific version
VERSION=$(cat version)
docker build -t revel-frontend:$VERSION .
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
```

### Environment Variables

| Variable | Description | Default | Required |
|----------|-------------|---------|----------|
| `PUBLIC_API_URL` | Backend API base URL | - | Yes |
| `ORIGIN` | SvelteKit origin for CSRF protection | `http://localhost:3000` | Yes |
| `PORT` | Server port | `3000` | No |
| `HOST` | Server host | `0.0.0.0` | No |
| `NODE_ENV` | Node environment | `production` | No |

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
      - "3000:3000"
    environment:
      - PUBLIC_API_URL=https://api.revel.example.com
      - ORIGIN=https://revel.example.com
    restart: unless-stopped
    healthcheck:
      test: ["CMD", "node", "-e", "require('http').get('http://localhost:3000/', (r) => {process.exit(r.statusCode === 200 ? 0 : 1)})"]
      interval: 30s
      timeout: 3s
      retries: 3
```

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
          value: "https://api.revel.example.com"
        - name: ORIGIN
          value: "https://revel.example.com"
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
- **CORS Issues:** Ensure backend allows requests from your `ORIGIN`
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
