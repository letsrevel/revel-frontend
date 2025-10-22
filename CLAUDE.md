# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) and other AI assistants when working with code in this repository.

## Tracking Project Progress

**IMPORTANT:** Before starting any feature or issue, always check if it has already been completed or is in progress.

### How to Check Implementation Status

1. **Check closed PRs for recent work:**
   ```bash
   gh pr list --state closed --limit 20
   # Or search for specific features:
   gh pr list --state closed --search "potluck"
   ```

2. **Check existing implementation:**
   - Look in `src/routes/` for existing pages
   - Check `src/lib/components/` for reusable components
   - Search for API endpoint usage: `grep -r "api\." src/`

3. **Review the Implementation Plan:**
   - Check `IMPLEMENTATION_PLAN.md` for current status
   - The plan is updated regularly with completed features
   - Look for ✅ (complete), ⏳ (in progress), ❌ (not started)

4. **Verify backend API coverage:**
   - Read `backend_context/openapi.json` for available endpoints
   - Check `backend_context/USER_JOURNEY.md` for intended flows
   - Test endpoints with the API client to ensure they work

5. **Check open issues:**
   ```bash
   gh issue list --state open
   # Check if an issue is outdated:
   gh issue view <number>
   ```

### Before Creating New Features

1. **Verify it doesn't exist:** Run the app and test the feature
2. **Check for partial implementations:** Some features may be partially complete
3. **Look for related PRs:** The feature might be in review
4. **Update stale issues:** If an issue is complete, close it with a comment

### Common Completed Features (as of Oct 2025)

- ✅ Authentication (login, register, 2FA, password reset)
- ✅ Event browsing and discovery
- ✅ Event RSVP system
- ✅ Potluck coordination
- ✅ User profile management
- ✅ GDPR compliance (data export, account deletion)
- ✅ User settings and preferences

### Features In Progress

- ⏳ User dashboard enhancement
- ⏳ Mobile optimization for potluck

### Not Yet Implemented

- ❌ Event ticketing with Stripe
- ❌ Questionnaire submission
- ❌ Organization management
- ❌ Event creation wizard
- ❌ QR code check-in

## Backend API Reference

**IMPORTANT:** When working with API endpoints or understanding data models, always reference the backend code and schemas.

### Available Backend Reference Files

The `backend_context/` directory contains symlinked files from the `revel-backend` repository:

1. **OpenAPI Specification:**
   - `backend_context/openapi.json` - Complete API specification with all endpoints, parameters, and response schemas
   - Auto-generated from backend code, always up-to-date
   - Use to understand available endpoints and their exact parameters

2. **Backend Schemas (Pydantic Models):**
   - `backend_context/events.schema.py` - Event-related Pydantic schemas
   - `backend_context/questionnaires.schema.py` - Questionnaire-related schemas
   - These define the data models that generate the OpenAPI spec
   - Useful for understanding field types, validation rules, and relationships

3. **Backend Controllers (API Endpoints):**
   - Located in `revel-backend/src/events/controllers/` (if you have access to the backend repo)
   - `dashboard.py` - Dashboard-specific endpoints (`/api/dashboard/*`)
   - `events.py` - Event listing and detail endpoints
   - `organizations.py` - Organization management endpoints
   - `event_series.py` - Event series endpoints
   - Useful for understanding business logic and endpoint behavior

4. **Full Backend OpenAPI:**
   - `revel-backend/.artifacts/openapi.json` - The source of truth for API specification

### Key Dashboard Endpoints

The dashboard uses specialized endpoints that filter data by user relationships:

**`/api/dashboard/events`** - Get user's events filtered by relationship
- Parameters: `owner`, `staff`, `member`, `rsvp_yes`, `rsvp_maybe`, `got_ticket`, `got_invitation`, `subscriber`
- Returns: Events the user is organizing, attending, invited to, or subscribed to
- **Important:** May return empty results if user has no relationships with any events

**`/api/dashboard/organizations`** - Get user's organizations filtered by relationship
- Parameters: `owner`, `staff`, `member`, `subscriber`
- Returns: Organizations the user owns, is staff/member of, or subscribes to
- **Important:** May return empty results if user has no relationships with any organizations

**`/api/dashboard/event_series`** - Get user's event series
- Similar filtering logic to events endpoint

**`/api/dashboard/invitations`** - Get user's event invitations
- Dedicated endpoint for invitation management

### When Dashboard Endpoints Return Empty

The dashboard endpoints are relationship-based and will return empty results if:
- New user with no activity yet
- User hasn't RSVP'd to any events
- User doesn't own or belong to any organizations
- User has no pending invitations

**Fallback Strategy:** If dashboard endpoints return empty, use general listing endpoints:
- `/api/events/` - Browse all public events
- `/api/organizations/` - Browse all public organizations
- Display "Getting Started" / "Discover" sections for new users

### Searching the OpenAPI Spec

```bash
# Find all dashboard endpoints
python3 -c "import json; data = json.load(open('backend_context/openapi.json')); print('\n'.join([p for p in data['paths'].keys() if 'dashboard' in p]))"

# Get details about a specific endpoint
python3 -c "import json; data = json.load(open('backend_context/openapi.json')); import pprint; pprint.pprint(data['paths']['/api/dashboard/events']['get'])"

# Search for schemas
grep -A 10 "EventDetailSchema" backend_context/events.schema.py
```

## Using the Svelte MCP

This project uses Svelte 5 and SvelteKit. When working with Svelte code, you should leverage the Svelte MCP for documentation and best practices.

**IMPORTANT:** Follow this workflow when working with Svelte/SvelteKit code:

1. **Discover documentation:** Use `list-sections` to find relevant documentation sections
2. **Fetch comprehensive docs:** Use `get-documentation` to retrieve all applicable sections before writing code
3. **Validate code quality:** Always run `svelte-autofixer` on generated Svelte code before presenting to the user
4. **Share examples:** Only offer `playground-link` after explicit user confirmation

### Why Use the Svelte MCP?

- **Up-to-date information:** Svelte 5 introduced significant changes (Runes system) that may be after Claude's knowledge cutoff
- **Best practices:** Get current recommendations for SvelteKit patterns
- **Code validation:** Catch common mistakes and anti-patterns before they reach the codebase
- **Learning resource:** Playground links help users understand Svelte 5 concepts

## Using Context7 MCP

This project has Context7 MCP installed, which provides real-time access to up-to-date, version-specific documentation for any library or framework in the tech stack.

**IMPORTANT:** Use Context7 when working with libraries or frameworks:

### How to Use Context7

1. **Basic usage:** Add "use context7" to your question when you need documentation

   ```
   "How do I implement form validation with Zod in SvelteKit? use context7"
   "Set up TanStack Query with Svelte 5 runes. use context7"
   ```

2. **Specify library:** If you know the exact library, use its Context7 ID
   ```
   "use library /tanstack/query for data fetching docs"
   "use library /tailwindlabs/tailwindcss for styling patterns"
   ```

### When to Use Context7

- **New libraries:** When working with libraries that are after your training cutoff
- **Version-specific features:** When you need exact API signatures for the versions we're using
- **Best practices:** To get current patterns and recommendations from official docs
- **Troubleshooting:** When debugging version-specific issues

### Key Libraries in This Project

Common Context7 library IDs for this project:

- `/sveltejs/kit` - SvelteKit documentation
- `/sveltejs/svelte` - Svelte 5 documentation
- `/tanstack/query` - TanStack Query for Svelte
- `/tailwindlabs/tailwindcss` - Tailwind CSS
- `/colinhacks/zod` - Zod validation library

Context7 eliminates:

- Hallucinated APIs that don't exist
- Outdated code patterns from older versions
- Generic answers not applicable to our specific stack

## Using Claude Code Subagents

This project includes specialized Claude Code subagents for common development tasks. Subagents are AI assistants with their own context windows and specialized instructions.

**IMPORTANT:** Proactively use subagents for specialized tasks - they provide focused, expert execution.

### Available Subagents

**🔄 api-sync** - Synchronize API client with backend

- Regenerate TypeScript client from OpenAPI spec
- Handle breaking changes
- Verify type safety
- Use when: Backend API changes, new endpoints added

**🧩 component-creator** - Create Svelte 5 components

- Generate components with Runes syntax
- Implement accessibility (WCAG 2.1 AA)
- Apply mobile-first design
- Include tests
- Use when: Building new UI components

**🛣️ route-creator** - Create SvelteKit routes

- Set up SSR/CSR/Hybrid rendering
- Configure load functions
- Add SEO metadata
- Implement error handling
- Use when: Adding new pages or API endpoints

**✅ testing-helper** - Write comprehensive tests

- Create unit tests (Vitest)
- Write component tests (@testing-library/svelte)
- Build E2E tests (Playwright)
- Include accessibility tests
- Use when: Testing features, ensuring coverage

**♿ accessibility-checker** - Audit WCAG compliance

- Check WCAG 2.1 AA requirements
- Test keyboard navigation
- Verify ARIA usage
- Validate color contrast
- Use when: Before merging, during code review

**📋 project-manager** - Plan features and manage issues

- Create technical designs
- Break down tasks
- Generate GitHub issues
- Organize milestones
- Use when: Planning features, organizing work

### How to Use Subagents

**Explicit invocation (recommended):**

```
"Use the component-creator subagent to create an EventCard component"
"Use the api-sync subagent to update the API client"
"Use the accessibility-checker subagent to audit the login form"
```

**Automatic delegation:**

```
"Create an EventCard component"
# Claude Code may automatically invoke component-creator

"Check if this is accessible"
# Claude Code may automatically invoke accessibility-checker
```

**Chaining subagents for complex features:**

```
1. "Use project-manager to plan the RSVP feature"
   → Creates issues and technical design

2. "Use component-creator to build RSVPButton"
   → Creates the component

3. "Use accessibility-checker to audit it"
   → Verifies WCAG compliance

4. "Use testing-helper to write tests"
   → Adds comprehensive tests
```

### Subagent Benefits

- **Separate context:** Doesn't pollute main conversation
- **Specialized expertise:** Focused on specific tasks
- **Consistent patterns:** Same approach every time
- **Full autonomy:** Executes complete workflows
- **Reusable:** Use across multiple features

### When to Use Which Subagent

| Task                  | Subagent              | Invocation                           |
| --------------------- | --------------------- | ------------------------------------ |
| Backend API changed   | api-sync              | "Use api-sync subagent"              |
| New component needed  | component-creator     | "Use component-creator subagent"     |
| New page/route needed | route-creator         | "Use route-creator subagent"         |
| Write tests           | testing-helper        | "Use testing-helper subagent"        |
| Check accessibility   | accessibility-checker | "Use accessibility-checker subagent" |
| Plan feature          | project-manager       | "Use project-manager subagent"       |

**See `.claude/agents/README.md` for detailed subagent documentation.**

## Git Workflow

**CRITICAL:** Always use feature branches and Pull Requests. **NEVER commit directly to `main`**.

### Standard Workflow

1. **Create a feature branch** before starting work:

   ```bash
   git checkout -b feature/issue-number-description
   # or
   git checkout -b fix/issue-number-description
   ```

2. **Do all the work** on the feature branch
   - Make commits as you progress
   - Keep commits focused and atomic
   - Use conventional commit messages (see below)

3. **Commit changes** to the feature branch
   - **ALWAYS ask user for confirmation before committing**
   - Show what will be committed with `git status`
   - Draft the commit message for user review

4. **Push the branch**:

   ```bash
   git push -u origin feature/issue-number-description
   ```

5. **Create a Pull Request**:

   ```bash
   gh pr create --title "Title" --body "Description"
   ```

6. **Wait for review** before merging to main

### Benefits of This Workflow

- Code review opportunities
- CI/CD checks before merging
- Clean git history
- Easy rollback capabilities
- Track what went into each PR

### Branch Naming Convention

- `feature/issue-number-description` - New features (e.g., `feature/3-base-layouts`)
- `fix/issue-number-description` - Bug fixes (e.g., `fix/42-mobile-nav-scroll`)
- `refactor/description` - Code refactoring
- `docs/description` - Documentation updates
- `test/description` - Test additions/updates
- `chore/description` - Maintenance tasks

### Commit Message Format

Follow conventional commits:

- `feat:` or `feat(scope):` - New feature
- `fix:` or `fix(scope):` - Bug fix
- `docs:` - Documentation changes
- `style:` - Code style changes (formatting, etc.)
- `refactor:` - Code refactoring
- `test:` - Adding or updating tests
- `chore:` - Maintenance tasks

Always end commits with:

```
🤖 Generated with [Claude Code](https://claude.com/claude-code)

Co-Authored-By: Claude <noreply@anthropic.com>
```

### IMPORTANT: Always Ask Before Committing

**Never commit without explicit user approval.** Always:

1. Show `git status` with files to be committed
2. Draft the commit message
3. Ask: "Ready to commit these changes?"
4. Wait for user confirmation
5. Only then execute the commit

## Development Commands

This project uses npm/pnpm scripts for development tasks:

### Primary Development Commands

- `pnpm dev` - Start development server with hot reload (accessible on local network via 0.0.0.0)
- `pnpm build` - Build production-ready application
- `pnpm preview` - Preview production build locally
- `pnpm generate:api` - Generate TypeScript API client from backend OpenAPI spec

#### Mobile Testing

The dev server is configured to listen on `0.0.0.0` (all network interfaces) for mobile testing:

```bash
pnpm dev
# Server runs on: http://localhost:5173
# Network access: http://YOUR_LOCAL_IP:5173
```

To find your local IP:

- **macOS/Linux**: `ifconfig | grep "inet " | grep -v 127.0.0.1`
- **Windows**: `ipconfig`

Look for your local network IP (usually `192.168.x.x` or `10.0.x.x`). Access from phone/tablet on same WiFi network.

### Code Quality

- `pnpm check` - Run SvelteKit type checking and validation
- `pnpm check:watch` - Run type checking in watch mode
- `pnpm lint` - Lint code with ESLint
- `pnpm format` - Format code with Prettier

### Testing

- `pnpm test` - Run unit tests with Vitest
- `pnpm test:ui` - Run tests with interactive UI
- `pnpm test:e2e` - Run end-to-end tests with Playwright
- `pnpm test:coverage` - Generate test coverage report

## Project Architecture

Revel Frontend is a SvelteKit application built with Svelte 5, using a hybrid SSR/CSR rendering strategy.

### Technology Stack

**Core:**

- **SvelteKit** - Meta-framework for building web applications
- **Svelte 5** - Reactive UI framework with Runes system
- **TypeScript** - Type-safe JavaScript (strict mode enabled)
- **Vite** - Build tool and dev server

**State Management:**

- **Svelte Runes** - `$state`, `$derived`, `$effect` for local component state
- **Svelte Stores** - For global application state
- **TanStack Query** - Server state management and caching

**UI & Styling:**

- **Tailwind CSS** - Utility-first CSS framework
- **shadcn-svelte** - Accessible component library built on Radix UI
- **Lucide Icons** - Icon library

**API Integration:**

- **Auto-generated client** - TypeScript types and API client from backend OpenAPI spec
- **Zod** - Runtime validation and schema definition

**Forms:**

- **Superforms** - Type-safe form handling for SvelteKit
- **Zod** - Form validation schemas

### Rendering Strategy

This project uses a **hybrid rendering approach**:

```typescript
// Public pages: Server-Side Rendering (SSR)
// routes/(public)/+page.server.ts
export const ssr = true; // Default, can be omitted

// Authenticated pages: Hybrid (SSR initial, CSR navigation)
// routes/(auth)/dashboard/+page.ts
export const ssr = true; // Initial load server-rendered

// Highly interactive pages: Client-Side Rendering only
// routes/(auth)/check-in/+page.ts
export const ssr = false; // Disable SSR for real-time features
```

**Rendering Guidelines:**

- **Use SSR** for public event listings, event details, organization profiles (SEO critical)
- **Use Hybrid** for authenticated dashboards (fast initial load + SPA navigation)
- **Disable SSR** only for highly interactive features like QR scanning, real-time updates

### Key Architectural Patterns

#### File-Based Routing

SvelteKit uses file-based routing with route groups:

```
routes/
├── (public)/          # Public pages (SSR for SEO)
│   ├── +page.svelte  # Landing page
│   ├── events/       # Event listings and details
│   └── org/          # Organization profiles
├── (auth)/           # Authenticated pages
│   ├── dashboard/
│   ├── account/
│   └── org/[slug]/admin/
└── api/              # Server-side API endpoints
```

#### Server-Side Logic

Use `+page.server.ts` for server-only code:

- Database queries
- API calls with secrets
- Authentication checks
- Form actions

#### Load Functions

Use `+page.ts` or `+page.server.ts` load functions for data fetching:

```typescript
// +page.server.ts (server-only, secure)
export const load = async ({ locals, params }) => {
	// Access to secrets, database, etc.
	const events = await api.getEvents(locals.user.token);
	return { events };
};

// +page.ts (runs on both server and client)
export const load = async ({ fetch, params }) => {
	// Runs on server for initial load, client for navigation
	const response = await fetch(`/api/events/${params.id}`);
	return { event: await response.json() };
};
```

#### Component Organization

```
lib/components/
├── ui/                  # shadcn-svelte components (generic)
├── common/             # Shared components (Header, Footer, etc.)
├── events/             # Event-specific components
├── organizations/      # Organization-specific components
└── forms/              # Reusable form components
```

### Code Quality Standards

#### TypeScript

- **Strict mode enabled** - All code must pass `tsc --strict`
- **Explicit types** - Avoid `any`, use `unknown` when necessary
- **Type all function parameters and return values**
- **Use Zod** for runtime validation of external data (API responses, form inputs)

#### Svelte 5 Runes

**IMPORTANT:** This project uses Svelte 5 Runes, not the legacy reactive syntax.

```svelte
<script lang="ts">
	// ✅ CORRECT: Use Runes
	let count = $state(0);
	let doubled = $derived(count * 2);

	$effect(() => {
		console.log(`Count is ${count}`);
	});

	// ❌ WRONG: Don't use legacy syntax
	let count = 0; // Won't be reactive!
	$: doubled = count * 2; // Old syntax
</script>
```

**Key Runes:**

- `$state(value)` - Reactive state
- `$derived(expression)` - Computed values
- `$effect(() => {})` - Side effects
- `$props()` - Component props
- `$bindable()` - Bindable props

#### Component Style Guide

**Component Structure:**

```svelte
<script lang="ts">
	// 1. Imports
	import { type ComponentType } from 'svelte';
	import { Button } from '$lib/components/ui/button';

	// 2. Props
	interface Props {
		title: string;
		onSubmit?: () => void;
	}
	let { title, onSubmit }: Props = $props();

	// 3. State
	let isLoading = $state(false);

	// 4. Derived state
	let canSubmit = $derived(!isLoading && title.length > 0);

	// 5. Functions
	async function handleSubmit() {
		isLoading = true;
		await onSubmit?.();
		isLoading = false;
	}

	// 6. Effects
	$effect(() => {
		console.log('Title changed:', title);
	});
</script>

<!-- 7. Template -->
<div>
	<h1>{title}</h1>
	<Button onclick={handleSubmit} disabled={!canSubmit}>Submit</Button>
</div>

<!-- 8. Styles (scoped) -->
<style>
	div {
		/* Component-specific styles */
	}
</style>
```

#### Accessibility Requirements

**WCAG 2.1 AA Compliance is mandatory:**

- **Semantic HTML:** Use proper HTML elements (`<button>`, `<nav>`, `<main>`, etc.)
- **Keyboard navigation:** All interactive elements must be keyboard accessible
- **ARIA labels:** Add `aria-label`, `aria-describedby` where needed
- **Color contrast:** Minimum 4.5:1 for text, 3:1 for UI components
- **Focus indicators:** Visible focus states on all interactive elements
- **Alt text:** All images must have descriptive alt text
- **Screen reader testing:** Test with VoiceOver (macOS) or NVDA (Windows)

```svelte
<!-- ✅ GOOD: Accessible button -->
<button type="button" aria-label="Close dialog" onclick={close}>
	<XIcon aria-hidden="true" />
</button>

<!-- ❌ BAD: Not accessible -->
<div onclick={close}>
	<XIcon />
</div>
```

#### Mobile-First Design

**IMPORTANT:** Design for mobile first, then enhance for larger screens.

```css
/* ✅ CORRECT: Mobile-first with Tailwind */
<div class="flex flex-col md:flex-row gap-4 p-4 md:p-8">
  <!-- Mobile: vertical stack, small padding -->
  <!-- Desktop: horizontal row, larger padding -->
</div>

/* ✅ CORRECT: Custom CSS mobile-first */
.container {
	/* Base styles for mobile */
	padding: 1rem;

	/* Tablet */
	@media (min-width: 768px) {
		padding: 2rem;
	}

	/* Desktop */
	@media (min-width: 1024px) {
		padding: 3rem;
	}
}
```

### API Integration

#### Auto-Generated API Client

The API client is **100% auto-generated** from the backend's OpenAPI specification.

**Regenerate the client:**

```bash
pnpm generate:api
```

**Using the API client:**

```typescript
import { api } from '$lib/api';
import { useQuery } from '@tanstack/svelte-query';

// In a Svelte component
let eventsQuery = useQuery({
	queryKey: ['events'],
	queryFn: () => api.events.listEvents({ limit: 20 })
});

// Typed response!
$: events = $eventsQuery.data?.results ?? [];
```

#### Server-Side API Calls

For sensitive operations, call the API from `+page.server.ts`:

```typescript
// +page.server.ts
import { api } from '$lib/api';
import { error } from '@sveltejs/kit';

export const load = async ({ locals, params }) => {
	const user = locals.user;
	if (!user) throw error(401, 'Unauthorized');

	try {
		const organization = await api.organizations.getOrganization({
			slug: params.slug,
			headers: { Authorization: `Bearer ${user.accessToken}` }
		});

		return { organization };
	} catch (err) {
		throw error(404, 'Organization not found');
	}
};
```

### Authentication Pattern

**Token Storage:**

- **Access token:** In-memory (never localStorage!)
- **Refresh token:** httpOnly cookie (set by server)

**Implementation:**

```typescript
// hooks.server.ts
export const handle = async ({ event, resolve }) => {
	const accessToken = event.cookies.get('access_token');

	if (accessToken) {
		try {
			const user = await verifyToken(accessToken);
			event.locals.user = user;
		} catch {
			// Token expired or invalid
			event.cookies.delete('access_token', { path: '/' });
		}
	}

	return resolve(event);
};
```

### Testing Guidelines

#### Unit Tests (Vitest)

- Test utility functions, stores, and business logic
- Mock API calls and external dependencies
- Aim for high coverage on critical paths

```typescript
import { describe, it, expect } from 'vitest';
import { formatEventDate } from '$lib/utils/dates';

describe('formatEventDate', () => {
	it('formats ISO date to readable string', () => {
		const result = formatEventDate('2025-10-17T10:00:00Z');
		expect(result).toBe('October 17, 2025 at 10:00 AM');
	});
});
```

#### Component Tests (@testing-library/svelte)

- Test user interactions and component behavior
- Use `userEvent` for simulating user actions
- Query by accessible attributes (role, label)

```typescript
import { render, screen } from '@testing-library/svelte';
import { userEvent } from '@testing-library/user-event';
import Button from './Button.svelte';

it('calls onclick when clicked', async () => {
	const user = userEvent.setup();
	let clicked = false;

	render(Button, {
		props: {
			onclick: () => {
				clicked = true;
			}
		}
	});

	await user.click(screen.getByRole('button'));
	expect(clicked).toBe(true);
});
```

#### E2E Tests (Playwright)

- Test critical user journeys
- Test on multiple browsers (Chromium, Firefox, WebKit)
- Use Page Object Model pattern

```typescript
import { test, expect } from '@playwright/test';

test('user can RSVP to event', async ({ page }) => {
	await page.goto('/events/test-event');
	await page.getByRole('button', { name: 'RSVP' }).click();
	await expect(page.getByText('RSVP confirmed')).toBeVisible();
});
```

### Development Workflow

#### Before Starting Work

1. **Check if the feature already exists** - Run the app and test it
2. **Review closed PRs** - Check recent implementations
3. **Check IMPLEMENTATION_PLAN.md** - See current project status
4. Pull latest changes from `main`
5. Create a feature branch: `git checkout -b feature/your-feature`
6. Ensure backend is running and API client is up to date: `pnpm generate:api`

#### During Development

1. **Use the Svelte MCP** for documentation when working with Svelte 5 features
2. Write tests alongside code (TDD encouraged)
3. Run `pnpm check` frequently to catch type errors
4. Use `pnpm lint` and `pnpm format` to maintain code quality
5. Test in mobile viewport (responsive design is mandatory)
6. Check accessibility with browser DevTools and keyboard navigation

#### Before Committing

1. Run all checks: `pnpm check && pnpm lint && pnpm test`
2. Format code: `pnpm format`
3. Test accessibility manually (keyboard navigation, screen reader)
4. Commit with conventional commit messages: `feat: add event RSVP flow`

#### Pull Request Guidelines

1. Write clear PR description explaining changes
2. Link to related issues
3. Include screenshots/videos for UI changes
4. Ensure CI passes (tests, lints, type checks)
5. Request review from maintainers

### Implementation Workflow

When working on issues or new features, follow this collaborative workflow:

#### 1. Investigation & Analysis Phase

- **Check if it's already done** - Test the feature, check closed PRs
- Read the issue description thoroughly
- **Consider using the project-manager subagent** for complex feature planning
- Use the Svelte MCP to check relevant documentation
- Explore relevant code sections
- Identify affected components, routes, and state management
- Map out dependencies

#### 2. Discussion Phase (Required for Non-Trivial Changes)

- Present findings to the user
- Propose approaches with pros/cons
- Discuss implementation details, accessibility, and mobile UX
- Ask clarifying questions about:
  - Desired behavior and user experience
  - Accessibility requirements
  - Mobile vs. desktop differences
  - API design and data fetching strategy
  - Testing requirements
- Create a detailed implementation plan
- Get explicit approval before proceeding

#### 3. Implementation Phase

- Use TodoWrite to track progress
- **Use appropriate subagents** for specialized tasks (component-creator, route-creator, etc.)
- Follow the agreed-upon plan
- Write tests alongside code (or use testing-helper subagent)
- Use `svelte-autofixer` to validate Svelte code
- **Use accessibility-checker subagent** before completing
- Raise concerns immediately if issues are discovered

#### 4. Key Principles

- **No surprises:** Discuss before implementing, especially for architectural decisions
- **Accessibility first:** Every feature must be accessible
- **Mobile-first:** Design for mobile, enhance for desktop
- **Document decisions:** Explain reasoning in comments
- **Iterative refinement:** Ask questions rather than make assumptions

## Notes to Claude

- **Check if features exist before building them** - Many features are already implemented
- **Use subagents proactively** - Delegate specialized tasks to the appropriate subagent for better focus and results
- **Always use the Svelte MCP** when working with Svelte 5 code - the Runes system is fundamentally different from Svelte 3/4
- **Run `svelte-autofixer`** on all generated Svelte code before presenting to users
- **Prioritize accessibility** - WCAG AA compliance is not optional
- **Design mobile-first** - most users will access on mobile devices
- **Use TypeScript strict mode** - no `any` types, no untyped functions
- **100% API auto-generation** - never manually write API types or client code
- Always discuss non-trivial implementation approaches before writing code
- Test keyboard navigation and screen reader compatibility for all UI components
- Follow the backend's philosophy of clean, type-safe, well-tested code
- **Chain subagents** for complex features - e.g., project-manager → component-creator → accessibility-checker → testing-helper