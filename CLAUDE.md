# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) and other AI assistants when working with code in this repository.

## Important Reference Documents

- **`.dev-docs/guides/common-fixes.md`** (local-only, gitignored) - Common issues and their solutions. **READ THIS FIRST** to avoid recurring mistakes with TanStack Query, backend enums, and Svelte 5 patterns.

## Backend API Reference

The full backend repository is accessible via the `../revel-backend` symlink — explore its controllers (`src/events/controllers/`), schemas (`src/events/schema/`), services (`src/events/service/`), and tests directly whenever you need to understand API behavior, data models, or business logic. The auto-generated OpenAPI spec at `revel-backend/.artifacts/openapi.json` is the source of truth for available endpoints.

**Dashboard endpoints are relationship-based** (`/api/dashboard/events`, `/api/dashboard/organizations`, …) and legitimately return empty results for users with no relationships (new user, no RSVPs, no orgs, no invitations). Fallback strategy: use the general listing endpoints (`/api/events/`, `/api/organizations/`) and show "Getting Started" / "Discover" sections for new users.

**Before building a feature, check it doesn't already exist** — run the app, check `gh pr list --state closed`, and search `src/routes/` / `src/lib/components/`.

## MCP Servers

- **Svelte MCP** — use it whenever working with Svelte/SvelteKit code: `list-sections` → `get-documentation` for the relevant sections before writing code; always run `svelte-autofixer` on generated Svelte code before presenting it; offer `playground-link` only after explicit user confirmation.
- **Context7 MCP** — real-time, version-specific library docs. Useful IDs for this stack: `/sveltejs/kit`, `/sveltejs/svelte`, `/tanstack/query`, `/tailwindlabs/tailwindcss`, `/colinhacks/zod`.

## Subagents

Specialized subagents live in `.claude/agents/` (component-creator, route-creator, api-sync, testing-helper, accessibility-checker, project-manager, …) — use them proactively for their specialties and chain them for complex features. See `.claude/agents/README.md`.

## Git Workflow

**CRITICAL:** Always use feature branches and Pull Requests. **NEVER commit directly to `main`**.

- **Always ask user for confirmation before committing** — show `git status`, draft the commit message, wait for approval.
- Branch naming: `feature/issue-number-description`, `fix/issue-number-description`, `refactor/…`, `docs/…`, `test/…`, `chore/…`.
- Conventional commits: `feat:`, `fix:`, `docs:`, `style:`, `refactor:`, `test:`, `chore:` (optionally scoped, e.g. `feat(scope):`).
- Always end commits with:

  ```
  🤖 Generated with [Claude Code](https://claude.com/claude-code)

  Co-Authored-By: Claude <noreply@anthropic.com>
  ```

## Development Commands

This project uses a comprehensive Makefile for development tasks. **Use `make` commands as the primary interface.**

### Primary Development Commands

- `make dev` - Start development server (accessible on local network via 0.0.0.0)
- `make build` - Production build
- `make preview` - Preview production build locally
- `make generate-api` - Regenerate TypeScript API client from backend OpenAPI spec

### Code Quality — The Quality Gate

- `make check` - **Run ALL quality checks** (format, lint, types, i18n, file-length). Must pass before committing.
- `make fix` - Auto-fix formatting and lint issues. Run this first, then `make check`.

Individual checks (also available separately):
- `make format-check` - Verify Prettier formatting
- `make lint` - ESLint with `--max-warnings 0` (warnings are errors)
- `make types` - SvelteKit type checking (`svelte-check`)
- `make types-canary` - Asserts `make types` can actually fail, by injecting a known
  type error into a `.ts` and a `.svelte` file and requiring both to be reported.
  It exists because the type gate silently disarmed itself once (#704): TypeScript
  caps a project at 20 MB of non-TS files, `.svelte` plus the generated Paraglide
  `.js` bundles crossed it, and the language service dropped into reduced mode —
  reporting "0 errors" over an empty program. `tsconfig.json` now sets
  `disableSizeLimit: true`. **Never treat a green run or the scanned-file count as
  evidence the gate works; only an injected error is decisive.**
- `make i18n-check` - Translation file validation
- `make file-length` - Source file line count enforcement (Svelte: 750, TS/JS: 500)

### Testing

- `make test` - Run unit tests (saves failures to `.tests.output`)
- `make test-coverage` - Run tests with coverage report
- `make test-e2e` - Run Playwright E2E tests

### Workflow: Before Committing

```bash
make fix      # Auto-fix what can be auto-fixed
make check    # Verify everything passes
make test     # Run tests
```

#### Mobile Testing

The dev server listens on `0.0.0.0` for mobile testing:
- **macOS/Linux**: `ifconfig | grep "inet " | grep -v 127.0.0.1`
- Access from phone/tablet on same WiFi at `http://YOUR_LOCAL_IP:5173`

## Project Architecture

Revel Frontend is a SvelteKit application built with Svelte 5 (see `package.json` for the stack), using a hybrid SSR/CSR rendering strategy.

### Rendering Strategy

- **Use SSR** for public event listings, event details, organization profiles (SEO critical)
- **Use Hybrid** (SSR initial load, CSR navigation) for authenticated dashboards
- **Disable SSR** (`export const ssr = false`) only for highly interactive features like QR scanning, real-time updates

Server-only code (secrets, auth checks, form actions) belongs in `+page.server.ts`; `+page.ts` load functions run on both server and client.

### Code Quality Standards

#### TypeScript

- **Strict mode enabled** - All code must pass `tsc --strict`
- **Explicit types** - Avoid `any`, use `unknown` when necessary
- **Type all function parameters and return values**
- **Use Zod** for runtime validation of external data (API responses, form inputs)

#### Date & Time Formatting

**Human-facing dates must follow the user's UI language and never be ambiguous.**

- **Format only via `src/lib/utils/date.ts`** helpers (`formatDate`, `formatDateTime`,
  `formatEventDate`, `formatTimeOfDay`, `formatDateTimeReadback`, …). These resolve the
  locale from the active UI language via `getDateLocale()` — so switching language switches
  month names. Calendar-specific display helpers live in `calendar.ts` and use the same locale.
- **Never render a month as a number** in human-facing output (no `month: 'numeric'`/`'2-digit'`,
  no bare `toLocaleDateString()`/`dateStyle: 'short'`). Always a textual month (`'short'`/`'long'`).
  This removes DD/MM vs MM/DD ambiguity, so no per-user region/format preference is needed.
- **Do not call `toLocaleDateString` / `toLocaleString` / `toLocaleTimeString` or
  `new Intl.DateTimeFormat(...).format()` directly** in components/routes — add a helper to
  `date.ts` instead. (`Intl.DateTimeFormat().resolvedOptions().timeZone` for timezone *detection*
  is fine.) **ESLint actively bans `toLocaleDateString`, `toLocaleTimeString`, and `toLocaleString`
  everywhere except `src/lib/utils/date.ts` and `src/lib/utils/calendar.ts`** (guardrail landed
  in #510; `resolvedOptions()` for tz detection is not affected).
- **Machine/ISO formats stay numeric** — `<input>` values, `datetime` attributes, API payloads,
  and structured data (schema.org) use ISO 8601, not localized strings.
- For native `<input type="datetime-local">`, show `formatDateTimeReadback(value)` underneath as an
  unambiguous confirmation (the native control's own display is browser-locale numeric and can't be
  restyled).

#### Svelte 5 Runes

**IMPORTANT:** This project uses Svelte 5 Runes exclusively — `$state`, `$derived`, `$effect`, `$props()`, `$bindable()`. Never use the legacy reactive syntax (`$:` statements, bare `let` for reactive state). When unsure about Runes semantics, consult the Svelte MCP.

#### Accessibility Requirements

**WCAG 2.1 AA Compliance is mandatory:**

- **Semantic HTML:** Use proper HTML elements (`<button>`, `<nav>`, `<main>`, etc.)
- **Keyboard navigation:** All interactive elements must be keyboard accessible
- **ARIA labels:** Add `aria-label`, `aria-describedby` where needed
- **Color contrast:** Minimum 4.5:1 for text, 3:1 for UI components
- **Focus indicators:** Visible focus states on all interactive elements
- **Alt text:** All images must have descriptive alt text
- **Screen reader testing:** Test with VoiceOver (macOS) or NVDA (Windows)

#### Mobile-First Design

**IMPORTANT:** Design for mobile first, then enhance for larger screens — base styles target mobile, `md:`/`lg:` (or min-width media queries) layer on desktop.

### API Integration

The API client is **100% auto-generated** from the backend's OpenAPI specification — regenerate with `pnpm generate:api`, and **never manually write API types or client code**. Call the API from `+page.server.ts` for sensitive operations that need the user's token server-side.

### Authentication Pattern

**Token storage:** access token lives in-memory only (**never localStorage**); refresh token is an httpOnly cookie set by the server.

### Testing Guidelines

- **Unit tests (Vitest):** utility functions, stores, business logic; mock API calls; high coverage on critical paths.
- **Component tests (@testing-library/svelte):** user interactions and behavior; use `userEvent`; query by accessible attributes (role, label).
- **E2E tests (Playwright):** critical user journeys, multiple browsers, Page Object Model pattern.

### Implementation Workflow

When working on issues or new features:

1. **Investigate** — check it isn't already done (run the app, closed PRs); read the issue; explore affected components, routes, and state management; consult the Svelte MCP.
2. **Discuss (required for non-trivial changes)** — present findings, propose approaches with pros/cons, clarify behavior/accessibility/mobile UX/API design/testing needs, and **get explicit approval before implementing**.
3. **Implement** — track progress with TodoWrite; use the appropriate subagents; validate Svelte code with `svelte-autofixer`; run the accessibility-checker subagent before completing; raise concerns immediately.
4. **Principles** — no surprises, accessibility first, mobile-first, document decisions, ask rather than assume.

## Brand Palette (2026 Rebrand)

The official palette from the ACIDHAIRS brand deck (June 2026, `revel-backend/local_stuff/Revel_Presentation_Branding+Social-Media-Design.pdf`). **This is the single source of truth for brand colors — always derive theme values from it, never invent new hues.**

| Name           | Hex       | HSL                 | Role                       |
| -------------- | --------- | ------------------- | -------------------------- |
| Hearty Purple  | `#8C3CDD` | `hsl(270 70% 55%)`  | Primary                    |
| Light Crimson  | `#E6332A` | `hsl(3 79% 53%)`    | Primary                    |
| Lavender       | `#AB82DB` | `hsl(268 55% 68%)`  | Secondary                  |
| Periwinkle     | `#9AB2FF` | `hsl(226 100% 80%)` | Secondary                  |
| Amber          | `#F9B233` | `hsl(38 94% 59%)`   | Highlight                  |
| Ink            | `#0D1E1C` | `hsl(173 40% 8%)`   | Text (light) / dark surfaces |
| White          | `#FFFFFF` | `hsl(0 0% 100%)`    | Text on dark               |

**The shipped theme is "Bubble"** (decided 2026-07-08): sticker-round `--radius: 1.25rem`, lavender paper light mode, aubergine club dark mode with palette Lavender as the glow primary; crimson only as the "heart" accent, amber as highlight, maroon destructive. Its tokens live in `src/app.css` (`:root` + `.dark`) — that file is the single place to edit for any future rebrand (token NAMES are the stable contract; every component reads them). Retired candidates (gradient/midnight/mono, the crimson study, the pre-2026 purple/cyan brand, and the live A/B switcher) are preserved in git history at commit `3e6d2bb9`.

- **Logo:** the "let's revel." lockup (`RevelWordmark.svelte` + `RevelMark.svelte`); the mark's gradient is `--logo-from`/`--logo-to` (Hearty Purple → Light Crimson).
- **Typeface:** Nata Sans app-wide, via `@fontsource-variable/nata-sans` (imported in `app.css`) and `fontFamily.sans` in `tailwind.config.ts`. The chunky wide headline face in the ACIDHAIRS deck is that agency's own deck typography, **not** a licensed brand asset. The Digital Brand Styleguide (below) later added **BBH Bartle** as a display face — but for **social-media assets only**; the app and web stay Nata Sans (all weights allowed).

### Digital Brand Styleguide (Isabella Radich, 2026)

Source PDF: `Revel_Digital-Styleguide.pdf` at this repo's root (**local-only, gitignored — never commit it**); it layers on top of the ACIDHAIRS deck (`revel-backend/local_stuff/Revel_Presentation_Branding+Social-Media-Design.pdf`). Colors are identical to the palette table above. The rules it adds:

- **Wordmark:** "let's" in Nata Sans **Light**, "revel" in **Semibold**, period after "revel". Tracking **60** (`tracking-[0.06em]`) on the wordmark **only** — everywhere else tracking stays 0. In the color lockup "let's" and the period are Ink, "revel" carries the brand gradient (white-on-dark variants: all white, weights unchanged) — the period is **never** an accent hue. `RevelWordmark.svelte` is the single implementation of all of the above and the only way to render the lockup: **never hand-set "let's revel." at a call site.** The footer and the landing ClosePanel both did, and both drifted off the guide (wrong tracking, a crimson period, an amber period, no gradient on "revel") until #811 folded them back in. The component takes `mono` for the white-on-dark variant, `mark={false}` to drop the R, and inherits its font size from `class` (tailwind-merge), so it scales from navbar to poster type.
- **Logo gradient:** vertical linear, Hearty Purple (top) → Light Crimson (bottom), midpoint at 50%. `RevelMark.svelte` already implements this; don't re-derive it per-surface.
- **Safe zones:** clear space of ½x around mark and lockup (x = the heart's height). Never set the logo flush against an edge — corner placements keep the ½x margin on both sides.
- **Fonts:** Nata Sans is the main brand font, universal on web and social; all weights in the family are allowed. **BBH Bartle** (open-source Google Font) is the additional display face **for social-media designs only** — do not ship it in the app. Both upper- and lowercase allowed, tracking 0.
- **Picture style:** DO — colourful, warm image language; closeness and a sense of community; "real"-looking portraits. DON'T — classic stock imagery, people who read as actors/models, cold or distanced shots, corporate casual. (The landing page deliberately uses no photography; these rules bind social assets, OG images, and any future photo use.)

### Rebrand volumes & shared primitives (2026-08 platform rebrand)

The poster language extends app-wide at three volumes (master spec:
`docs/superpowers/specs/2026-08-04-platform-rebrand-design.md`, local-only):

- **Poster** (landing only): color-block panels, diagonal cuts, stickers. Frozen.
- **Celebration** (public discovery, auth, error pages, user dashboard, ALL empty
  states): display typography + kickers + sparing `Sticker` accents. Surfaces stay
  on theme tokens; only decorative accents keep the fixed poster palette
  (**imagery rule** — identical in dark mode, like the landing panels).
- **Studio** (admin, dense forms/tables): heavy typography + tone tokens only.
  No tilts, no cuts, no stickers — except empty states, which stay warm everywhere.

**Shared primitives** (always prefer these over hand-rolled equivalents):
`common/PageHeader` (page h1: kicker/title/subtitle/actions, `volume` prop),
`common/SectionHeader`, `common/EmptyState` (poster-tinted tilted chip),
`common/StatusBadge` (solid, tone-mapped — wrap domain enums in thin mappers),
`common/ToneTile` (soft icon tile), `brand/Sticker` (celebration only, rotation
clamped [-3, 3]). Tone vocabulary: `common/tones.ts` (`brand | info | success |
warning | danger | neutral`). `StatusBadge` is solid-fill only by design (audit-
enforced pairs; no soft variant) — sizes `sm | md | lg`. `ToneTile`'s `tone` axis
stays semantic only; identity/destination coloring (the admin quick-actions grid)
uses the additive `tint` prop (PR 7) — a fixed poster-palette axis (`purple |
lavender | periwinkle | amber | crimson | ink | paper`, type `PosterTint` in
`common/tones.ts`) that renders a SOLID chip, identical in both modes (imagery
rule), and wins over `tone` when both are set. `Props` is a union
(`{ tone: Tone; tint?: PosterTint } | { tone?: Tone; tint: PosterTint }`) — at
least one of `tone`/`tint` is required, both may be given, tint-only is legal
(no filler tone needed). Never overload `tone` for identity — reach for `tint`
instead. **Every tint chip carries `ring-1 ring-inset ring-border`** (PR 7 fix
round) — the chip itself is mode-inert by design, but the card/page surface
under it is NOT, and at least one tint/surface pairing measured under 1.2:1
(effectively invisible) in the flipped mode; the ring gives every tint chip a
theme-aware boundary regardless of what it sits on. Don't drop it when adding a
call site or a new tint. `PageHeader` spreads arbitrary HTML attributes onto its
`<header>` (`restProps` via `Omit<HTMLAttributes<HTMLElement>, 'children'>`,
PR 7, mirrors `StatusBadge`) so routed adopters can attach `id`/`aria-label`/etc;
`SectionHeader` already took a plain `id` prop (forwarded to the heading)
instead. `PageHeader`'s `decoration` slot is aria-hidden ornament only — status
text goes through `actions` or `StatusBadge`, never `decoration`.

**A badge is named by its content** (#795). `StatusBadge` renders a role-less
`<span>`, whose implicit `generic` role does not support name-from-author, so
`aria-label` on it is ARIA-prohibited and ignored by conforming AT — it is
`Omit`ted from the component's props, and passing one is a type error. Do not
"fix" that by adding a role: `status` is a live region (wrong for a static pill)
and `img`/`note`/`group` all buy validity with per-badge screen-reader verbosity.
When a badge genuinely needs a richer announcement than its visible text
("Membership status: Active"), pass the whole already-translated sentence as
**`srLabel`** — it renders as real `sr-only` content with the visible label
`aria-hidden`, so nothing is read twice. Never compose it from a prefix plus
`label`; word order and agreement differ across the six locales. Tests locate
badges by the **`data-testid="status-badge"`** the primitive always emits
(overridable — `account/MembershipCard` uses `membership-subscription-status` so
a pending subscription and a pending payment stay addressable apart), never by
accessible name.

**Band/wash pairing:** a mode-inert poster-solid ribbon pairs with a theme-aware
tinted wash below it, and a theme `bg-secondary` band pairs with a plain
`--background` body — never pair a band with a wash from the same token family.
**Pull-up opacity rule:** whenever body content is pulled up to overlap a
band's bottom edge, the first block it lands on must be an opaque surface
(never `bg-card/NN`).

**Typography scale** (encoded in the primitives; use the same classes when
composing manually):

| Role | Classes |
| --- | --- |
| Display title (celebration h1) | `text-3xl font-black leading-[1.12] sm:text-4xl` |
| Studio title (admin h1) | `text-2xl font-extrabold tracking-tight sm:text-3xl` |
| Kicker | `text-sm font-extrabold uppercase tracking-[0.12em]` (`text-xs` in dense admin) |
| Section heading | celebration `text-xl font-extrabold` · studio `text-lg font-bold` |
| Card title | `font-bold` |

**Raw-hue sweep rule:** in any file you touch, replace raw Tailwind palette color
utilities (`bg-blue-50`, `text-emerald-600`, `dark:bg-indigo-950`, ...) with
semantic tokens / `StatusBadge` / `ToneTile`. Exemptions: JS color objects for
QR/canvas libraries, user-configurable data colors (e.g. seat categories), and
the `--brand-telegram`/`--brand-telegram-text` pair. New tokens `--success`/`--info` and the first-class
`poster.*` Tailwind colors (`bg-poster-amber`, ...) exist for this. Never
introduce new raw palette hues.

### Theme rules

- **Use tokens, never raw hexes** in components (`bg-primary`, `text-muted-foreground`, …). Palette hexes appear only in `app.css`.
- **The theme must respect the light/dark axis.** The app styles content with `dark:` utilities (e.g. `prose dark:prose-invert`), which assume the `.dark` class controls surface darkness. A theme that keeps dark surfaces in light mode breaks readability everywhere.
- **WCAG AA contract:** every `*-foreground` on its surface ≥ 4.5:1; `--primary` vs `--background` ≥ 3:1 (links, focus rings).
- **Destructive is TWO tokens.** `--destructive` is the FILL (buttons, badges,
  `StatusBadge danger`) and pairs with `--destructive-foreground`; it only owes
  1.4.11's 3:1. `--destructive-text` is destructive-as-TEXT/ICON and owes 4.5:1.
  `tailwind.config.ts` overrides `theme.extend.textColor.destructive`, so
  `text-destructive` — and every variant of it (`hover:`, `focus:`,
  `group-hover:`, `data-[…]:`, `text-destructive/90`) — resolves to
  `--destructive-text`, while `bg-/border-/ring-/divide-/fill-destructive` keep
  the fill. Light mode defines the two identically; only dark mode splits them.
  Three consequences: (a) the restated `foreground` key next to the override is
  defensive redundancy — Tailwind deep-merges `extend.textColor`, so omitting it
  would still compile (proven by compiling both variants); keep it anyway for
  explicitness; (b) **raw CSS is NOT covered** — inside a `<style>` block write
  `hsl(var(--destructive-text))` for text/icons, never `hsl(var(--destructive))`;
  (c) `decoration-/placeholder-/caret-/accent-destructive` still resolve to the
  fill, so don't reach for them to colour text.
- **Every translucent recipe belongs in `COMPOSITED_PAIRS`** in
  `scripts/audit-brand-themes.py` — a `dark:` variant that swaps the tint or the
  foreground is a *different* recipe, not the same one measured twice. Let the
  script print the ratio and paste **that** into the code comment, never the
  reverse: hand-written ratios were wrong repeatedly during the 2026-08 rebrand
  (#783), and the script now FAILS on unknown token names instead of skipping
  them, so a token rename can't silently disarm rows.
- **Color-blind safety:** separate semantic colors (primary/accent/destructive/highlight) by _lightness_, not hue alone — protanopia/deuteranopia collapse red/purple/amber hue differences. Never encode meaning by color alone; pair with icon or text.
- **Validate after any theme edit:** `python3 scripts/audit-brand-themes.py` checks the WCAG pairs and simulated color-blind separation. Keep it at 0 failures.

## Notes to Claude

- **Check if features exist before building them** — many already do.
- **Always use the Svelte MCP** for Svelte 5 code and **run `svelte-autofixer`** on generated Svelte before presenting it.
- **Understand backend behavior from the source** — read the backend controllers via the `revel-backend` symlink rather than guessing API semantics.
- Always discuss non-trivial implementation approaches before writing code.
- Test keyboard navigation and screen reader compatibility for all UI components.
