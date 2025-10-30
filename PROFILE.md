# 🎉 Revel

**An open-source, community-focused event management and ticketing platform.**

[![Status](https://img.shields.io/badge/status-Beta-orange?style=for-the-badge)](https://github.com/letsrevel)
[![License](https://img.shields.io/badge/license-MIT-blue?style=for-the-badge)](./LICENSE)
[![Live Demo](https://img.shields.io/badge/demo-live-success?style=for-the-badge)](https://demo.letsrevel.io)

Revel is an event management platform designed with community at its heart. Initially created to serve the specific needs of queer, LGBTQ+, and sex-positive communities, it is built to be event-agnostic, scalable, and a powerful tool for any group that values **privacy**, **control**, and **transparency**.

Unlike monolithic corporate platforms that treat events as transactions, Revel treats them as part of a larger community ecosystem.

---

## ✨ Live Demo (Alpha)

Try Revel yourself at **[demo.letsrevel.io](https://demo.letsrevel.io)**

- **Frontend Demo:** https://demo.letsrevel.io
- **API Documentation:** https://demo-api.letsrevel.io/api/docs

> **Note:** Emails are dry-run, and demo data resets daily at 00:00 CET.

---

## 🤔 Why Revel? The Philosophy

Revel addresses the shortcomings of existing event platforms, especially for communities that prioritize safety, autonomy, and trust.

### For Communities, Not Corporations
Mainstream platforms often have restrictive content policies or lack privacy features, creating challenges for adult, queer, or activist-oriented events. Revel is **explicitly designed to support these communities**.

### Open, Transparent & Self-Hostable
Avoid vendor lock-in. Host Revel on your own infrastructure for free, giving you **complete control over your data** and eliminating platform commissions. Its open-source nature means you can trust the code you run.

### Fair & Simple Pricing
For those who choose our future hosted version:
- **No charge** for free events or events where you handle payments yourself
- **3% + $0.50 commission** on paid tickets sold through Revel

This significantly undercuts the high fees of major platforms while keeping the project sustainable and open source.

---

## 🚀 Key Features

Revel combines the ticketing power of platforms like Eventbrite with the community-building tools of Meetup, all under a privacy-minded, open-source framework.

### 🏘️ Community & Membership
- **Organizations:** Create and manage your community's central hub with customizable visibility (Public, Private, Members-Only)
- **Roles & Permissions:** Granular permission system with Owner, Staff, and Member roles
- **Membership System:** Manage member rosters, enable members-only events, foster belonging

### 🔒 Trust, Safety & Privacy
- **Advanced Attendee Screening:** Gate event eligibility with custom questionnaires for automatic or manual review
- **Full Data Ownership:** When self-hosting, you control your data—no third-party trackers, no data selling
- **Tailored Invitations:** Send direct invitations that can waive requirements for trusted guests
- **GDPR Compliant:** Built-in data export, account deletion, and privacy controls

### 🎫 Core Event & Ticketing
- **Event & Series Management:** Create single events or recurring series under your organization
- **Flexible Ticketing:** Support for paid/free tickets (powered by Stripe) and simple RSVPs
- **QR Code Check-In:** Streamlined event entry with QR code scanning
- **Potluck Coordination:** Built-in system for attendees to coordinate bringing items

### 📱 Modern User Experience
- **Mobile-First Design:** Optimized for mobile devices with progressive enhancement
- **Accessibility First:** WCAG 2.1 AA compliance as standard, not an afterthought
- **Fast & Responsive:** Hybrid SSR/CSR rendering for optimal performance
- **Real-Time Features:** Live check-in, potluck updates, and instant notifications

---

## 💻 Tech Stack

### Backend
![Python](https://img.shields.io/badge/python-3.13%2B-3776AB.svg?logo=python&logoColor=white&style=flat-square)
![Django](https://img.shields.io/badge/django-5.2+-092E20.svg?logo=django&logoColor=white&style=flat-square)
![PostgreSQL](https://img.shields.io/badge/postgresql-16+-336791.svg?logo=postgresql&logoColor=white&style=flat-square)

- **Python 3.13+** with **Django 5+**
- **Django Ninja** for fast, auto-documenting REST API
- **PostgreSQL** with **PostGIS** for geo-features
- **Celery** + **Redis** for async tasks (emails, evaluations)
- **Stripe** for payment processing
- **Docker** for containerized deployment

### Frontend
![SvelteKit](https://img.shields.io/badge/sveltekit-5.0+-FF3E00.svg?logo=svelte&logoColor=white&style=flat-square)
![TypeScript](https://img.shields.io/badge/typescript-5.0+-3178C6.svg?logo=typescript&logoColor=white&style=flat-square)
![Tailwind](https://img.shields.io/badge/tailwind-4.0+-38B2AC.svg?logo=tailwind-css&logoColor=white&style=flat-square)

- **SvelteKit** with **Svelte 5** (modern Runes API)
- **TypeScript** (strict mode) for type safety
- **TanStack Query** for server state management
- **Tailwind CSS** + **shadcn-svelte** for UI
- **Zod** for runtime validation
- **Vitest** + **Playwright** for comprehensive testing

---

## 🏁 Quick Start

### Backend Setup

```bash
# Clone the backend repository
git clone https://github.com/letsrevel/revel-backend.git
cd revel-backend

# Download required geo data (see backend README for links)
# Place IP2LOCATION-LITE-DB5.BIN and worldcities.csv in src/geo/data/

# Run automated setup
make setup

# Start the server
make run
```

**API available at:** `http://localhost:8000`
**API docs:** `http://localhost:8000/api/docs`

### Frontend Setup

```bash
# Clone the frontend repository
git clone https://github.com/letsrevel/revel-frontend.git
cd revel-frontend

# Install dependencies
pnpm install

# Generate API client from backend OpenAPI spec
pnpm generate:api

# Start development server
pnpm dev
```

**Frontend available at:** `http://localhost:5173`

> **Prerequisites:** Node.js 20+, pnpm 9+, Python 3.13+, Docker, PostgreSQL

---

## 📂 Architecture

### Repositories

- **[revel-backend](https://github.com/letsrevel/revel-backend)** - Django REST API, business logic, database
- **[revel-frontend](https://github.com/letsrevel/revel-frontend)** - SvelteKit web application

### Key Design Patterns

**Backend:**
- Clean separation: Controllers → Services → Models
- Type-safe with mypy strict mode
- Comprehensive test coverage with pytest
- OpenAPI auto-generation for API documentation

**Frontend:**
- Hybrid SSR/CSR rendering strategy
- Auto-generated TypeScript client from OpenAPI spec
- Component-driven architecture with Svelte 5 Runes
- Accessibility-first development (WCAG 2.1 AA)

---

## 🤝 Contributing

We welcome contributions from developers of all skill levels!

### How to Contribute

1. Check [open issues](https://github.com/letsrevel/revel-backend/issues) or [frontend issues](https://github.com/letsrevel/revel-frontend/issues)
2. Read the [CONTRIBUTING.md](CONTRIBUTING.md) guidelines
3. Fork the repository and create a feature branch
4. Write tests for your changes
5. Submit a pull request

### Development Notes

**Backend:**
- Follow Django best practices
- Write comprehensive tests (aim for >90% coverage)
- Use type hints and pass mypy strict checks
- Document API endpoints with proper schemas

**Frontend:**
- Use Svelte 5 Runes (not legacy reactive syntax)
- Maintain WCAG 2.1 AA accessibility standards
- Design mobile-first, enhance for desktop
- Write unit tests with Vitest, E2E tests with Playwright

### ⚠️ Frontend Caveat

The backend is carefully architected and tested. The frontend, however, was *shamelessly* vibe-coded using Claude Code. It's a bit of a spaghetti mess, but it works! **Any help cleaning it up is greatly appreciated!**

---

## ♿ Accessibility Commitment

Revel is committed to being accessible to everyone:

- ✅ Keyboard navigation for all interactive elements
- ✅ Screen reader support with semantic HTML and ARIA labels
- ✅ WCAG AA color contrast standards (4.5:1 minimum)
- ✅ Clear focus indicators
- ✅ Responsive design that works on all devices
- ✅ Progressive enhancement (core functionality without JS)

We test with automated tools (axe, Lighthouse) and manual testing with screen readers.

---

## 📜 License

This project is licensed under the **MIT License**. See [LICENSE](LICENSE) for details.

---

## 🔗 Links

- **Backend Repository:** [github.com/letsrevel/revel-backend](https://github.com/letsrevel/revel-backend)
- **Frontend Repository:** [github.com/letsrevel/revel-frontend](https://github.com/letsrevel/revel-frontend)
- **Live Demo:** [demo.letsrevel.io](https://demo.letsrevel.io)
- **API Documentation:** [demo-api.letsrevel.io/api/docs](https://demo-api.letsrevel.io/api/docs)
- **Community Discord:** Coming soon
- **Documentation:** Coming soon

---

## 🙏 Acknowledgments

- Built with [Django](https://www.djangoproject.com/), [SvelteKit](https://kit.svelte.dev/), and [PostgreSQL](https://www.postgresql.org/)
- UI components from [shadcn-svelte](https://www.shadcn-svelte.com/)
- Icons from [Lucide](https://lucide.dev/)
- IP geolocation from [IP2Location LITE](https://lite.ip2location.com)
- City data from [SimpleMaps World Cities Database](https://simplemaps.com/data/world-cities) (CC BY 4.0)

---

## 💖 Support the Project

If you find Revel useful, consider:
- ⭐ Starring the repositories
- 🐛 Reporting bugs and suggesting features
- 💻 Contributing code or documentation
- 📢 Spreading the word in your community

**Built with love for communities that value privacy, safety, and autonomy.**
