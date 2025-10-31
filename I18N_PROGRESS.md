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

## Phase 2: Extract & Translate UI Strings (Day 3-5)

### Component Coverage

- [ ] **Common components** (Header, Footer, Navigation)
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
├── en.json     # English (baseline)
├── de.json     # German
└── it.json     # Italian
```

### Progress Notes

_Notes will be added as work progresses..._

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

| Language | Strings | Progress | Status |
|----------|---------|----------|--------|
| English  | 0       | 0%       | 🔴 Not Started |
| German   | 0       | 0%       | 🔴 Not Started |
| Italian  | 0       | 0%       | 🔴 Not Started |

---

## Session Log

### 2025-10-31 - Session 1

- Created progress tracking document
- Ready to begin Phase 1: Paraglide setup

---

## Next Steps

1. Run `npx sv add paraglide` to install and configure
2. Test demo page to verify installation
3. Configure hooks for language detection
4. Implement `LanguageSwitcher` component
