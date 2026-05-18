# Self-served email change — frontend design

**Date:** 2026-05-18
**Branch:** `feature/email-change-flow`
**Pairs with backend PR:** [revel-backend #422](https://github.com/letsrevel/revel-backend/pull/422) (closes BE #421)

## Goal

Let signed-in users change their account email address. The change is password-gated, confirmed via a single-use JWT link sent to the **new** address, and rotates the user's identity — every other JWT for the user is blacklisted on confirmation, so the user is signed out of every other device. The confirming device stays signed in with a fresh token pair returned by the backend.

## What the backend provides

Two endpoints surfaced in the regenerated OpenAPI client:

- **`POST /account/email-change-request`** (authenticated, `WriteThrottle`)
  - Body: `{ new_email: EmailStr, password: string }`
  - Returns: `ResponseMessage`
  - Side effects: dispatches a confirmation email (with a 15-minute single-use JWT) to the **new** address, and a separate masked notice to the **current** address.
- **`POST /account/email-change-confirm`** (anonymous, `WriteThrottle`)
  - Body: `{ token: string }`
  - Returns: `{ user: RevelUserSchema, token: TokenObtainPairOutputSchema }`
  - Side effects: validates and blacklists the token, swaps `email` + `username`, blacklists every outstanding JWT for the user, sends completion notices to both addresses.

Confirmation link sent by the backend: `{frontend_base_url}/account/confirm-email-change?token=<jwt>`.

### Error model (both endpoints)

| Endpoint | Status | Cause | UI surface |
|---|---|---|---|
| request | 400 | Incorrect password | Inline error under password field |
| request | 400 | New email is the same as current | Inline error under email field |
| request | 400 | New email already in use (case-insensitive) | Inline error under email field |
| request | 200 (silent no-op) | Target is globally banned | Treated as success — backend mirrors verification flow to avoid signalling ban presence |
| request | 429 | Throttled | Toast: "Too many attempts. Please try again in a few minutes." |
| confirm | 400 | Token expired / invalid / already used | Destructive callout, link back to security settings; no retry |
| confirm | 400 | Email taken between request and confirm (race lost; token is then burned) | Destructive callout, link back to security settings |
| confirm | 429 | Throttled | Toast, form stays usable |

## Surfaces

### 1. `/account/security` — new "Email address" card (authenticated)

A new card on the existing security page, placed between the 2FA card and the Password Change card. Reuses the same card structure (`rounded-lg border bg-card p-6`), icon-in-circle header, and "click button → inline reveal flow → confirmation state" interaction model already established by the password-change section.

The card has `id="email"` plus a `scroll-margin-top` value matching the page header so deep links land cleanly.

### 2. `/account/profile` — small affordance (authenticated)

The profile page already shows the user's email as a read-only input with a verified/unverified badge. Below the existing email-related hint (`profile.email_hint`), add a single text link:

> "Change email →" (anchors to `/account/security#email`)

No other change to the profile page.

### 3. `/account/confirm-email-change` — new public route (anonymous)

New folder under `src/routes/(public)/account/confirm-email-change/`:

- `+page.svelte` — handles the five UI states (missing-token, awaiting-confirm, submitting, success, error)
- `+page.server.ts` — form action that calls `accountEmailChangeConfirm`, writes the new auth cookies on success, and surfaces backend errors

Structurally mirrors the existing `src/routes/(public)/account/confirm-deletion/` route.

## Detailed UX — Security card flow

### State 1: Resting

```
┌────────────────────────────────────────────────┐
│  📧  Email address                              │
│      Change the email you use to sign in.       │
│                                                 │
│      Current: biagio@biagiodistefano.io  ✓ verified
│                                                 │
│      [ Change email ]                           │
└────────────────────────────────────────────────┘
```

The verified badge is read-only — clicking it does nothing. It mirrors the badge already shown on the profile page.

### State 2: Form revealed

Clicking "Change email" reveals the form inline inside the same card. The button is replaced by the form; an amber callout reminds the user of the session-invalidation side effect.

Fields:

- **New email address** — required. Client-side validated against a basic email regex (the same regex already used elsewhere in the codebase for email inputs).
- **Current password** — required. Uses the existing password-input pattern with a show/hide toggle, matching the login and password-reset forms.

Submit is disabled until both fields are non-empty and the email regex matches. Submit goes through a SvelteKit form action (`?/requestEmailChange` on `+page.server.ts`) so the password never lives in the client-side JS bundle.

**Cancel behaviour:** if either field has content, clicking Cancel opens a small confirm dialog ("Discard your changes? Your new email won't be saved."). If both fields are empty, Cancel collapses the form immediately.

### State 3: Success (after 200 response)

The form is replaced by a confirmation panel inside the same card:

```
┌────────────────────────────────────────────────┐
│  ✅  Check your inbox                           │
│                                                 │
│  We sent a confirmation link to                 │
│  newaddress@example.com.                        │
│                                                 │
│  We also sent a notice to                       │
│  biagio@biagiodistefano.io so you know about    │
│  this change from both sides.                   │
│                                                 │
│  The link expires in 15 minutes.                │
│                                                 │
│  [ Done ]                                       │
└────────────────────────────────────────────────┘
```

"Done" collapses back to State 1. The resting card still shows the *old* email — nothing has changed in the user's account yet. No "resend" affordance in v1; users who need a fresh link run the flow again, and the backend throttle handles abuse.

### Error mapping (Security card)

- **400 incorrect password** → inline error under password field: "Incorrect password."
- **400 same email** → inline error under email field: "That's already your current email."
- **400 duplicate email** → inline error under email field: "This email is already in use."
- **429 throttled** → toast: "Too many attempts. Please try again in a few minutes."
- **Other / network** → toast: generic error; form stays interactive.

## Detailed UX — Public confirmation page

### State A: No token in URL

Same shape as `confirm-deletion`'s "Missing token" state. `AlertTriangle` icon, heading "Invalid link.", body "This confirmation link is missing or malformed. Start the email change again from your account settings.", CTA "Go to security settings" → `/account/security`.

### State B: Token present, awaiting confirm

```
┌────────────────────────────────────────────────┐
│            📧  Confirm your new email           │
│                                                 │
│   You're about to set this as the email you    │
│   use to sign in to Revel.                      │
│                                                 │
│   ╔══════════════════════════════════════════╗  │
│   ║ ⚠️  You will be signed out of every     ║  │
│   ║     other device                          ║  │
│   ║                                          ║  │
│   ║  Confirming changes a core part of your  ║  │
│   ║  identity, so every other session is     ║  │
│   ║  invalidated. You'll stay signed in on   ║  │
│   ║  this device.                            ║  │
│   ║                                          ║  │
│   ║  • Any open Revel tabs on other devices  ║  │
│   ║    will need to sign back in             ║  │
│   ║  • Use your new email + same password    ║  │
│   ║    to sign in elsewhere                  ║  │
│   ╚══════════════════════════════════════════╝  │
│                                                 │
│   [ Cancel ]              [ Confirm change ]    │
└────────────────────────────────────────────────┘
```

Amber callout reuses the existing `border-amber-200 bg-amber-50` / dark equivalents already used by the unverified-email banner on the profile page. We do **not** render the proposed new email address — the token is opaque from the client, and adding a backend "preview" endpoint just to display it is not worth the cost. The user already saw the address they typed in the previous step (or in the confirmation email itself).

"Cancel" navigates to `/`. No confirmation dialog — cancelling is the safe action.

### State C: Submitting

Standard pattern. The submit button shows a spinner and reads "Confirming…"; the form is disabled.

### State D: Success

The `+page.server.ts` action receives `{ user, token }` from the backend. It:

1. Writes the new refresh-token cookie using the existing helper used by login / register / verify-email confirm. We do not invent a new path.
2. Returns the access token to the client so the in-memory auth store is updated, matching the pattern used by login and password-reset confirm.
3. Invalidates `app:user` so user data reloads with the new email.
4. Renders a success card on the same public page, with CTA "Go to your account" → `/account/profile`. We deliberately do **not** auto-redirect into the app; the success state is the user's confirmation that everything worked.

The success card content:

> ✅ Your email has been updated to **newaddress@example.com**.
> You've been signed out of all your other devices for security. You're still signed in here.
> [ Go to your account ]

### Cross-device behaviour

The confirmation endpoint is anonymous and the response always includes a fresh token pair. Two cases:

1. **User clicks the link in the same browser** where they requested the change. We swap their tokens; they continue as the new email.
2. **User clicks the link in a different browser** (or while logged out). The fresh token pair signs them in as the new email. This is the documented backend behaviour ("the confirming device stays signed in") and the frontend honours it.

Both cases use the same code path: take the returned token pair, write the cookie, populate the in-memory access token, render the success card.

### Error mapping (Public page)

- **400 expired / single-use / invalid token** → destructive callout: "This link has expired or already been used. Start the email change again." CTA "Go to security settings" → `/account/security`. No retry button.
- **400 email already in use (race lost)** → destructive callout: "This email is no longer available. Start over with a different address." CTA "Go to security settings".
- **429 throttled** → toast: "Too many attempts. Please try again in a few minutes." Form remains usable.
- **Other / network** → toast; form stays interactive.

## Implementation notes

### API client

Regenerate the TypeScript client with `pnpm generate:api` once the backend PR merges. The new endpoints will appear as `accountEmailChangeRequest` and `accountEmailChangeConfirm` (subject to the generator's naming, which we'll confirm at codegen time).

### Code reuse

- **Form submission pattern:** match the existing `account/security` `?/setup` / `?/verify` / `?/disable` form-action plumbing.
- **Password input:** reuse whatever component / pattern the login and password-reset forms already use (with show/hide toggle). Do not introduce a new password input.
- **Auth cookie write on confirm success:** reuse the existing helper used by login / register / verify-email confirm. Identify it during implementation; do not introduce a parallel helper.
- **Toast surface:** `svelte-sonner`, already used across the security page.
- **Card visual language:** copy structure from the existing 2FA / Password Change cards on `account/security`.
- **Public-page state pattern:** copy structure from `confirm-deletion/+page.svelte`.

### Internationalisation

All strings go through `$lib/paraglide/messages.js`. New namespaces:

- `accountSecurityPage.emailChange_*` for the security-card flow (`title`, `description`, `currentLabel`, `changeButton`, `formTitle`, `formDescription`, `signoutWarning`, `newEmailLabel`, `passwordLabel`, `submitButton`, `cancelButton`, `cancelDialogTitle`, `cancelDialogDescription`, `discardButton`, `keepEditingButton`, `success_*`, `error_*`).
- `confirmEmailChange.*` for the public confirmation page (`pageTitle`, `metaDescription`, `invalidLink_*`, `confirm_*`, `success_*`, `error_*`).
- `profile.email_changeLink` for the new affordance on the profile page.

Strings are added to all configured locales; never ship English-only.

### Accessibility

- Both forms use `<form>` with proper `<label>` associations; existing tab order on the security page must continue to work.
- Inline errors use `role="alert"` (matches existing pattern) and are referenced by `aria-describedby` on the offending input.
- The amber callout on the confirm page is announced as a `<div role="region" aria-labelledby="...">` with a heading inside (the visible "You will be signed out…" line).
- Cancel confirmation dialog uses our existing shadcn-svelte Dialog (the same one used elsewhere for destructive-action confirmation).
- Focus management: revealing the form moves focus to the new-email input. Closing it returns focus to the "Change email" button.
- Keyboard: `Esc` closes the cancel dialog; pressing the form's `Cancel` button respects the empty/non-empty rule above.

### Testing

- **Unit / component tests** for the security-card states (resting → form → success, error mappings, cancel dialog gate) using `@testing-library/svelte`.
- **Component test** for the public confirmation page covering all five states (missing token, awaiting, submitting, success, each error).
- **Manual E2E** of the full flow against the dev backend, including: same-browser confirm, different-browser confirm, expired token, duplicate email at request time, duplicate email at confirm time (requires racing two browsers).
- We rely on backend tests for the security guarantees (single-use token, blacklist of pre-existing JWTs, race-safe uniqueness, etc.) — we don't re-test those on the frontend.

## Out of scope

- No "resend" button in v1.
- No backend "preview the proposed email from this token" endpoint.
- No SSO-specific UI gating (SSO is not enabled site-wide; backend rejects SSO users with a clear 400 if they ever reach the endpoint).
- No history / audit log for email changes on the user-facing UI (backend logs are sufficient for support).
