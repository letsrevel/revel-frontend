# Revel Frontend

**A modern, accessible, mobile-first web interface for the Revel event management platform.**

[![Status](https://img.shields.io/badge/status-Alpha-orange?style=for-the-badge)](https://github.com/letsrevel/revel-frontend)
[![License](https://img.shields.io/badge/license-MIT-blue?style=for-the-badge)](./LICENSE)
![SvelteKit](https://img.shields.io/badge/sveltekit-5.0+-FF3E00.svg?logo=svelte&logoColor=white&style=for-the-badge)
![TypeScript](https://img.shields.io/badge/typescript-5.0+-3178C6.svg?logo=typescript&logoColor=white&style=for-the-badge)

Revel is an open-source, community-focused event management and ticketing platform. This repository contains the frontend web application, built with modern web technologies to provide a fast, accessible, and delightful user experience.

**Backend Repository:** [letsrevel/revel-backend](https://github.com/letsrevel/revel-backend)

---

## ⚠ Note

Unlike the Backend, this was *shamelessly* vibe coded using Claude Code. This code is an absolute spaghetti mess and it's a miracle it sort of works. If you are familiar with the tech stack and want to contribute, any help is more than welcome!

---

## 🌟 Philosophy & Design Principles

This frontend embodies Revel's core values:

- **Accessibility First:** WCAG 2.1 AA compliance as a minimum standard, not an afterthought
- **Mobile-First Design:** Optimized for mobile devices and progressive enhancement for larger screens
- **Performance Matters:** Fast load times, especially on slower networks and devices
- **Privacy-Conscious:** Minimal tracking, user data stays secure
- **Inclusive by Design:** Built for diverse communities including LGBTQ+ and sex-positive groups
- **Clean, Maintainable Code:** TypeScript strict mode, comprehensive testing, excellent DX

---

## 💻 Tech Stack

### Core Framework

- **SvelteKit** - Meta-framework with hybrid SSR/CSR rendering
- **Svelte 5** - Modern reactive framework with Runes for fine-grained reactivity
- **TypeScript** - Strict mode for type safety throughout the application
- **Vite** - Lightning-fast build tool and dev server

### Rendering Strategy

- **Hybrid SSR/CSR Approach:**
  - Server-Side Rendering (SSR) for public pages (SEO, fast initial load)
  - Client-Side Rendering (CSR) for authenticated dashboards
  - Static Site Generation (SSG) for landing pages
  - Per-page rendering control for optimal performance

### UI & Styling

- **Tailwind CSS** - Utility-first CSS framework
- **shadcn-svelte** - Accessible, customizable component library
- **Lucide Icons** - Beautiful, consistent icon set

### API & Data Management

- **Auto-Generated API Client** - TypeScript types and client generated from backend OpenAPI spec
- **TanStack Query (Svelte)** - Powerful server state management
- **Zod** - Runtime type validation and schema definition

### Forms & Validation

- **Superforms** - Type-safe form handling for SvelteKit
- **Zod** - Schema-based form validation

### Authentication

- **JWT-based** - Access tokens (in-memory) + refresh tokens (httpOnly cookies)
- **Google SSO** - OAuth2 integration
- **TOTP Support** - Two-factor authentication

### Testing & Quality

- **Vitest** - Fast unit testing framework
- **Playwright** - End-to-end testing
- **@testing-library/svelte** - Component testing
- **ESLint** - Code linting with strict rules
- **Prettier** - Code formatting
- **Husky** - Pre-commit hooks for quality gates

---

## 🚀 Quick Start

### Prerequisites

- Node.js 20+ (LTS recommended)
- pnpm 9+ (preferred) or npm
- The Revel backend running locally (see [backend repo](https://github.com/letsrevel/revel-backend))

### Installation

1. **Clone the repository:**

   ```bash
   git clone https://github.com/letsrevel/revel-frontend.git
   cd revel-frontend
   ```

2. **Install dependencies:**

   ```bash
   pnpm install
   ```

3. **Generate API client from backend OpenAPI spec:**

   ```bash
   pnpm generate:api
   ```

   _Note: Ensure the backend is running and accessible at `http://localhost:8000`_

4. **Start the development server:**

   ```bash
   pnpm dev
   ```

5. **Open your browser:**
   Navigate to `http://localhost:5173`

---

## 📜 Available Commands

| Command             | Description                                      |
| ------------------- | ------------------------------------------------ |
| `pnpm dev`          | Start development server with hot reload         |
| `pnpm build`        | Build production-ready application               |
| `pnpm preview`      | Preview production build locally                 |
| `pnpm generate:api` | Generate TypeScript API client from OpenAPI spec |
| `pnpm test`         | Run unit tests with Vitest                       |
| `pnpm test:ui`      | Run tests with interactive UI                    |
| `pnpm test:e2e`     | Run end-to-end tests with Playwright             |
| `pnpm lint`         | Lint code with ESLint                            |
| `pnpm format`       | Format code with Prettier                        |
| `pnpm check`        | Run SvelteKit type checking and validation       |
| `pnpm check:watch`  | Run type checking in watch mode                  |

---

## 📂 Project Structure

```
revel-frontend/
├── src/
│   ├── lib/
│   │   ├── api/              # Auto-generated API client and custom endpoints
│   │   ├── components/       # Reusable Svelte components
│   │   │   ├── ui/          # shadcn-svelte components
│   │   │   ├── events/      # Event-specific components
│   │   │   ├── organizations/
│   │   │   └── common/      # Shared components
│   │   ├── stores/          # Svelte stores for global state
│   │   ├── utils/           # Utility functions and helpers
│   │   ├── schemas/         # Zod validation schemas
│   │   └── types/           # TypeScript type definitions
│   ├── routes/              # SvelteKit file-based routing
│   │   ├── (public)/        # Public routes (SSR)
│   │   ├── (auth)/          # Authenticated routes
│   │   └── api/             # API endpoints (server-side)
│   ├── hooks.server.ts      # Server-side hooks (auth, etc.)
│   ├── hooks.client.ts      # Client-side hooks
│   └── app.html             # HTML template
├── static/                  # Static assets (images, fonts, etc.)
├── tests/
│   ├── unit/               # Unit tests
│   ├── integration/        # Integration tests
│   └── e2e/                # End-to-end tests
├── backend_context/         # Symlinked backend documentation
├── .env.example            # Environment variable template
└── package.json
```

---

## 🎨 Key Features Implementation

### Public Features (SSR)

- **Event Discovery:** Browse and search public events with filters
- **Event Details:** Rich event pages with maps, schedules, and ticketing info
- **Organization Profiles:** Public organization pages
- **User Registration & Login:** Email verification, password reset, Google SSO
- **SEO Optimized:** Meta tags, Open Graph, structured data

### Authenticated Features (Hybrid SSR/CSR)

- **User Dashboard:** View RSVPs, tickets, and upcoming events
- **Event RSVP/Ticketing:** Secure checkout flow with Stripe integration
- **Questionnaire Submission:** Dynamic form rendering and validation
- **Profile Management:** Edit profile, manage 2FA, GDPR data export/deletion

### Organizer Features (CSR)

- **Organization Management:** Create/edit organizations, manage members and staff
- **Event Creation:** Rich event builder with ticket tiers and settings
- **Questionnaire Builder:** Visual builder for admission screening
- **Attendee Management:** View submissions, approve/reject, manage invitations
- **Check-In System:** QR code scanning for event entry
- **Analytics Dashboard:** Event metrics and attendance insights

### Highly Interactive Features (CSR-Only)

- **Real-Time Check-In:** Live QR code scanning with instant feedback
- **Potluck Coordinator:** Real-time item claiming and updates
- **Live Chat:** (Future) Event-specific messaging

---

## 🔒 Authentication Flow

1. **Login:** User submits credentials
2. **Server validates:** SvelteKit server-side endpoint calls backend API
3. **Token handling:**
   - Access token stored in memory (client-side)
   - Refresh token stored in httpOnly cookie (secure)
4. **Automatic refresh:** Interceptor refreshes expired access tokens
5. **2FA support:** TOTP flow for enhanced security

---

## ♿ Accessibility Commitment

We are committed to making Revel accessible to everyone:

- **Keyboard Navigation:** All interactive elements fully navigable via keyboard
- **Screen Reader Support:** Semantic HTML, ARIA labels, and live regions
- **Color Contrast:** WCAG AA minimum (4.5:1 for text)
- **Focus Indicators:** Clear, visible focus states
- **Responsive Design:** Works on all device sizes
- **Progressive Enhancement:** Core functionality works without JavaScript

**Testing:** We use automated tools (axe, Lighthouse) and manual testing with screen readers.

---

## 🤝 Contributing

We welcome contributions from developers of all skill levels! Please read our [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines on how to get started.

**Before contributing:**

- Check [open issues](https://github.com/letsrevel/revel-frontend/issues) for tasks
- Read our [Code of Conduct](CODE_OF_CONDUCT.md)
- Review the [CLAUDE.md](CLAUDE.md) file for development guidelines

---

## 📄 License

This project is licensed under the MIT License. See [LICENSE](LICENSE) for details.

---

## 🙏 Acknowledgments

- Built with [SvelteKit](https://kit.svelte.dev/)
- UI components from [shadcn-svelte](https://www.shadcn-svelte.com/)
- Icons from [Lucide](https://lucide.dev/)
- Backend API by [Revel Backend](https://github.com/letsrevel/revel-backend)

---

## 🔗 Links

- **Backend Repository:** [letsrevel/revel-backend](https://github.com/letsrevel/revel-backend)
- **Documentation:** Coming soon
- **Community Discord:** Coming soon
- **Live Demo:** Coming soon
