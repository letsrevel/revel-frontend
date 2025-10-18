# Setup Guide

This guide will help you set up the Revel Frontend development environment from scratch.

## Prerequisites

### 1. Install Node.js

You need Node.js 20 or higher. We recommend using **nvm** (Node Version Manager) for easy Node.js version management.

#### Install nvm (if not already installed)

**macOS/Linux:**

```bash
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.0/install.sh | bash

# Or with wget:
wget -qO- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.0/install.sh | bash

# Restart your terminal or run:
source ~/.bashrc  # or ~/.zshrc
```

**Windows:**
Use [nvm-windows](https://github.com/coreybutler/nvm-windows/releases)

#### Install Node.js 20+ with nvm

```bash
nvm install 22
nvm use 22
nvm alias default 22
```

Verify installation:

```bash
node --version  # Should show v22.x.x
```

### 2. Install pnpm

pnpm is a fast, disk-space efficient package manager. This project requires pnpm 9+.

#### Option 1: Install via npm (Recommended)

```bash
npm install -g pnpm@9
```

#### Option 2: Install via standalone script

```bash
curl -fsSL https://get.pnpm.io/install.sh | sh -
```

#### Option 3: Install via Homebrew (macOS)

```bash
brew install pnpm
```

#### Option 4: Install via Corepack (Node.js 16.13+)

```bash
corepack enable
corepack prepare pnpm@9 --activate
```

Verify installation:

```bash
pnpm --version  # Should show 9.x.x
```

### 3. Clone the Repository

```bash
git clone https://github.com/letsrevel/revel-frontend.git
cd revel-frontend
```

### 4. Install Dependencies

```bash
pnpm install
```

This will install all dependencies listed in `package.json`.

---

## Backend Setup (Required)

The frontend needs the Revel backend running to function properly.

### 1. Clone and setup the backend

Follow the setup instructions in the [backend repository](https://github.com/letsrevel/revel-backend).

Quick start:

```bash
cd ..
git clone https://github.com/letsrevel/revel-backend.git
cd revel-backend
make setup
make run
```

The backend should now be running at `http://localhost:8000`.

### 2. Verify backend is running

```bash
curl http://localhost:8000/api/docs
```

You should see the API documentation page.

---

## Generate API Client

With the backend running, generate the TypeScript API client:

```bash
cd ../revel-frontend
pnpm generate:api
```

This creates type-safe API client code in `src/lib/api/generated/`.

---

## Start Development

```bash
pnpm dev
```

The app will be available at `http://localhost:5173`.

---

## Environment Variables

Create a `.env` file in the project root:

```bash
cp .env.example .env
```

Edit `.env` with your settings:

```env
PUBLIC_API_URL=http://localhost:8000
BACKEND_URL=http://localhost:8000
NODE_ENV=development
```

---

## Verify Everything Works

### 1. Check TypeScript compilation

```bash
pnpm check
```

### 2. Run linting

```bash
pnpm lint
```

### 3. Run tests

```bash
pnpm test
```

### 4. Build for production

```bash
pnpm build
```

If all commands succeed, you're ready to start developing! 🎉

---

## Common Issues

### "pnpm: command not found"

**Solution:**

1. Make sure you installed pnpm globally: `npm install -g pnpm@9`
2. Restart your terminal
3. Verify with: `pnpm --version`

### "Cannot connect to backend"

**Solution:**

1. Make sure the backend is running: `cd ../revel-backend && make run`
2. Check it's accessible: `curl http://localhost:8000/api/docs`
3. Update `.env` if backend is on a different port

### "API client generation fails"

**Solution:**

1. Ensure backend is running and accessible
2. Check backend OpenAPI is available: `curl http://localhost:8000/api/openapi.json`
3. Try again: `pnpm generate:api`

### "TypeScript errors in generated API client"

**Solution:**

1. Delete the generated folder: `rm -rf src/lib/api/generated`
2. Regenerate: `pnpm generate:api`
3. If errors persist, check if backend OpenAPI spec is valid

### "Module not found" errors

**Solution:**

1. Delete `node_modules` and lockfile: `rm -rf node_modules pnpm-lock.yaml`
2. Reinstall: `pnpm install`
3. Clear SvelteKit cache: `rm -rf .svelte-kit`

---

## Next Steps

- Read [CLAUDE.md](CLAUDE.md) for development guidelines
- Read [CONTRIBUTING.md](CONTRIBUTING.md) for contribution guidelines
- Explore the [backend user journeys](backend_context/USER_JOURNEY.md) to understand the system
- Start building! Check open issues for tasks to work on

---

## Useful Commands Reference

| Command                                    | Description                 |
| ------------------------------------------ | --------------------------- |
| `pnpm dev`                                 | Start development server    |
| `pnpm build`                               | Build for production        |
| `pnpm preview`                             | Preview production build    |
| `pnpm check`                               | TypeScript type checking    |
| `pnpm check:watch`                         | Type checking in watch mode |
| `pnpm lint`                                | Run ESLint                  |
| `pnpm format`                              | Format with Prettier        |
| `pnpm test`                                | Run unit tests              |
| `pnpm test:ui`                             | Run tests with UI           |
| `pnpm test:e2e`                            | Run E2E tests               |
| `pnpm generate:api`                        | Generate API client         |
| `npx shadcn-svelte@latest add [component]` | Add UI component            |

---

## Development Workflow

1. **Pull latest changes:**

   ```bash
   git pull origin main
   ```

2. **Create feature branch:**

   ```bash
   git checkout -b feature/your-feature
   ```

3. **Install/update dependencies:**

   ```bash
   pnpm install
   ```

4. **Update API client (if backend changed):**

   ```bash
   pnpm generate:api
   ```

5. **Start development:**

   ```bash
   pnpm dev
   ```

6. **Before committing:**

   ```bash
   pnpm check && pnpm lint && pnpm format && pnpm test
   ```

7. **Commit and push:**

   ```bash
   git add .
   git commit -m "feat: add your feature"
   git push origin feature/your-feature
   ```

8. **Create pull request** on GitHub

---

Happy coding! 🚀
