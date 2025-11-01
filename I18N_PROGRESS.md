# Internationalization (i18n) Implementation Progress

**Issue:** #150
**Started:** 2025-10-31
**Status:** 🟡 In Progress

---

## Quick Links

- [Issue #150](https://github.com/biagiodistefano/revel-frontend/issues/150)
- [Paraglide Docs](https://inlang.com/m/gerre34r/library-inlang-paraglideJs)
- [SvelteKit i18n Guide](https://kit.svelte.dev/docs/accessibility#the-lang-attribute)

---

## Phase 1: Setup & Infrastructure (Day 1-2) ✅ COMPLETE

### Tasks

- [x] Install Paraglide packages (`@inlang/paraglide-js@^2.4.0`)
- [x] Create `project.inlang/settings.json` configuration
- [x] Create initial message files (`messages/en.json`, `messages/de.json`, `messages/it.json`)
- [x] Configure hooks (`hooks.server.ts`) with language detection
- [x] Set up locale detection (URL → Cookie → Header → Default)
- [x] Update `app.html` with `%paraglide.lang%` and `%paraglide.textDirection%` placeholders
- [x] Create `src/lib/i18n.ts` with i18nHandle() hook and language utilities
- [x] Generate Paraglide runtime files with `paraglide-js compile`
- [x] Add `pnpm paraglide:compile` script to package.json
- [x] Update `.gitignore` to exclude generated files
- [ ] Implement `handleFetch` to inject `Accept-Language` header (next phase)
- [ ] Create date/number formatting utilities (next phase)
- [ ] Build `LanguageSwitcher.svelte` component (next phase)
- [ ] Write E2E test for language switching (testing phase)

### Progress Notes

**2025-10-31 - Phase 1 Complete!**

Successfully set up Paraglide i18n infrastructure using the manual approach since `sv add paraglide` had interactive CLI issues.

**Key accomplishments:**

- ✅ Installed `@inlang/paraglide-js@^2.4.0` (v2 - no SvelteKit adapter needed)
- ✅ Created Inlang project configuration with lint rules
- ✅ Set up message files for 3 languages (en, de, it)
- ✅ Created custom i18n hook with priority-based language detection:
  1. URL `?lang=de` parameter (highest priority)
  2. `user_language` cookie (persisted preference)
  3. `Accept-Language` HTTP header (browser default)
  4. Default to `en` (fallback)
- ✅ Updated app.html with dynamic lang attributes
- ✅ Generated Paraglide runtime (48KB runtime.js + messages)
- ✅ All i18n imports type-check correctly

**Technical decisions:**

- Used `@inlang/paraglide-js` v2 directly (deprecated SvelteKit adapter removed)
- Manual runtime compilation via `paraglide-js compile` CLI
- Custom `i18nHandle()` hook instead of built-in adapter
- Cookie is **not** httpOnly to allow client-side language switching
- Runtime files excluded from git (auto-generated)

**Next steps:**

- Add `Accept-Language` header injection for API calls (`handleFetch`)
- Extract hardcoded UI strings to message files
- Build LanguageSwitcher component

---

## Phase 2: Extract & Translate UI Strings (Day 3-5) 🚧 IN PROGRESS

### Component Coverage

- [x] **Header Navigation** - Fully translated (en, de, it)
- [x] **LanguageSwitcher** - New component created and translated!
- [x] **MobileNav** - Fully translated (menu labels, auth buttons)
- [x] **UserMenu** - Fully translated (profile menu, organizations)
- [x] **ThemeToggle** - Fully translated (light, dark, system)
- [x] **Footer** - Fully translated (all sections and links)
- [x] **Landing Page** - Fully translated (welcome, features)
- [ ] **Authentication** (Login, Register, Password Reset, 2FA)
- [ ] **Event components** (EventCard, EventDetails, RSVP buttons)
- [ ] **Forms** (Labels, placeholders, validation messages)
- [ ] **Dashboard** (Sections, filters, empty states)
- [ ] **Settings** (Profile, Security, Privacy, Notifications)
- [ ] **Error messages** (404, 500, API errors)
- [ ] **Modals & Dialogs** (Confirm, Alert, Success/Error)

### Translation Keys Structure

```
messages/
├── en.json     # English (baseline) - 50 strings
├── de.json     # German - 50 strings
└── it.json     # Italian - 50 strings
```

**Categories:**

- `nav.*` - Navigation items (10 strings)
- `auth.*` - Authentication actions (3 strings)
- `userMenu.*` - User menu items (8 strings)
- `theme.*` - Theme switcher (4 strings)
- `footer.*` - Footer sections and links (12 strings)
- `home.*` - Landing page content (8 strings)
- `welcome`, `hello` - Demo strings (2 strings)

### Progress Notes

**2025-10-31 - Phase 2: Common Components Complete! ✅**

**Session 2 - All Common Components and Landing Page:**

Completed full translation of:

- ✅ **MobileNav** - Menu header, close button, auth actions
- ✅ **UserMenu** - Profile menu items, organization links, admin dashboard
- ✅ **ThemeToggle** - Light, dark, system theme options
- ✅ **Footer** - All 4 sections (About, Legal, Resources, Version Info)
- ✅ **Landing Page** - Welcome message, tagline, all 3 feature cards

**Key accomplishments:**

- Added 38 new translation strings (total: 50 strings across 3 languages)
- All navigation and common UI components now fully translated
- Consistent pattern across all components using `$derived` for reactivity
- All code formatted and type-checks passing

**Translation coverage:**

```
✅ Header (10 strings)
✅ LanguageSwitcher (component structure + uses nav strings)
✅ MobileNav (uses nav + auth strings)
✅ UserMenu (8 strings)
✅ ThemeToggle (4 strings)
✅ Footer (12 strings)
✅ Landing Page (8 strings)
```

**Session 1 - Initial Setup:**

- ✅ Extracted navigation strings from Header component
- ✅ Created translations for en, de, it:
  - Navigation: Browse Events, Organizations, My Tickets, RSVPs, Invitations
  - Auth: Login, Sign Up, Log Out
  - Accessibility: Skip to main content, Toggle menu
- ✅ Updated Header.svelte to use `m['nav.browseEvents']()` syntax
- ✅ Fixed `{#each}` to use key for reactivity
- ✅ Built LanguageSwitcher component with:
  - Flag-only display in navbar (per user request)
  - Dropdown with full language names
  - Cookie persistence
  - Data invalidation on switch
- ✅ Added LanguageSwitcher to rightmost position in Header
- ✅ All components type-check successfully

**How translations work:**

```svelte
<script>
	import * as m from '$lib/paraglide/messages.js';
</script>

<button>{m['auth.login']()}</button>
<!-- Renders: "Login" (en) | "Anmelden" (de) | "Accedi" (it) -->
```

**Next steps:**

- Start on authentication pages (login, register, password reset, 2FA)
- Extract strings from event components
- Add form validation message translations
- Add error message translations

---

## Phase 3: German Translation (Day 6-7)

### Tasks

- [ ] Translate all strings in `messages/de.json`
- [ ] Review with native German speaker
- [ ] Test all pages in German
- [ ] Fix pluralization rules
- [ ] Verify date/number formatting

### Progress Notes

_Notes will be added as work progresses..._

---

## Phase 4: Italian Translation (Day 8-9)

### Tasks

- [ ] Translate all strings in `messages/it.json`
- [ ] Review with native Italian speaker
- [ ] Test all pages in Italian
- [ ] Fix pluralization rules
- [ ] Verify date/number formatting

### Progress Notes

_Notes will be added as work progresses..._

---

## Phase 5: Testing & Polish (Day 10-11)

### Tasks

- [ ] E2E tests for all language flows
- [ ] Accessibility audit (screen readers, lang attributes)
- [ ] SEO verification (hreflang tags, sitemaps)
- [ ] Performance testing (bundle size)
- [ ] Cross-browser testing (Chrome, Firefox, Safari)
- [ ] Mobile testing (iOS, Android)
- [ ] Fix bugs and edge cases

### Progress Notes

_Notes will be added as work progresses..._

---

## Phase 6: Documentation & Training (Day 12)

### Tasks

- [ ] Update README with i18n instructions
- [ ] Document translation workflow
- [ ] Create contributor guide for translations
- [ ] Add translation status badge
- [ ] Write blog post / announcement

### Progress Notes

_Notes will be added as work progresses..._

---

## Known Issues / Blockers

_Issues will be documented here as they arise..._

---

## Translation Statistics

| Language | Strings | Progress | Status                 |
| -------- | ------- | -------- | ---------------------- |
| English  | ~540    | 100%     | ✅ Complete (baseline) |
| German   | ~540    | 100%     | ✅ Complete (informal du) |
| Italian  | ~540    | 100%     | ✅ Complete (informal tu) |

**Coverage:**
- ✅ Common components (header, footer, navigation)
- ✅ Authentication (login, register, 2FA)
- ✅ Events (listings, filters, cards, details, RSVP, potluck, attendees)
- ✅ Dashboard (main, tickets, RSVPs, invitations)
- ✅ Account settings (profile, security, privacy, settings)
- ✅ Error messages and status indicators

**Total translation files:** 708 lines each (2,124 lines total)

---

## Session Log

### 2025-10-31 - Session 1

- Created progress tracking document
- Ready to begin Phase 1: Paraglide setup

---

## Session Log - Continued

### 2025-11-01 - Session 3: Dashboard & Settings Translation Complete! ✅

**Major milestone achieved - All core UI translations complete!**

Completed translation of dashboard and account settings:

- ✅ **Dashboard strings** (195 strings):
  - Main dashboard with activity summary
  - Your Events section with filters
  - My Organizations section
  - Discover Events section
  - Invitations page (both tabs: invitations and requests)
  - RSVPs management with search, filters, pagination
  - Tickets management with comprehensive filters

- ✅ **Account Settings strings** (237 strings):
  - Profile page (personal information, pronouns)
  - Security page (2FA setup/disable flows, QR code, security tips)
  - Privacy page (data export, account deletion with warnings)
  - Settings page (notifications, privacy, location, cascade settings)
  - Common UI strings (statuses, actions, messages)

**Translation approach:**
- **German:** All ~540 strings using informal "du/dein/dich" forms
- **Italian:** All ~540 strings using informal "tu/tuo" with gender-neutral phrasing
- Maintained all parameter placeholders: {firstName}, {count}, {total}, etc.
- Consistent JSON structure across all three languages

**Files grew from:**
- ~410 lines (events only) → **708 lines** (complete coverage)
- Total: **2,124 lines** across 3 language files

**Next steps:**
1. Update component files to use translations (systematic replacement)
2. Test all pages in all three languages
3. Verify pluralization and parameter interpolation
4. Mobile testing in all languages
