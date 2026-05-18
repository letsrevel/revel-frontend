# Self-served email change — implementation plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship the frontend half of self-served email change — a password-gated initiation flow on `/account/security` and a public token-confirmation page at `/account/confirm-email-change`.

**Architecture:** New card component on the existing security page handles initiation via a SvelteKit form action that proxies to `POST /account/email-change-request`. A new public route handles the confirmation: its form action calls `POST /account/email-change-confirm`, writes the returned `access_token` / `refresh_token` cookies using the existing `getAccessTokenCookieOptions` / `getRefreshTokenCookieOptions` helpers, and renders a success state. The root layout's existing reactivity picks up the new cookies and refreshes the auth store automatically.

**Tech Stack:** SvelteKit 2, Svelte 5 Runes, TypeScript strict, Tailwind, shadcn-svelte dialog primitives, `svelte-sonner` toasts, Zod schemas, Vitest + `@testing-library/svelte`, Paraglide i18n.

**Spec:** `docs/superpowers/specs/2026-05-18-email-change-design.md`

---

## Prerequisites

- Backend PR [revel-backend #422](https://github.com/letsrevel/revel-backend/pull/422) is merged.
- `pnpm generate:api` has been run on `feature/email-change-flow` so `accountEmailChangeRequest` and `accountEmailChangeConfirm` exist in `src/lib/api/generated/sdk.gen.ts`. Verify the exact names by running `grep -n "emailChange" src/lib/api/generated/sdk.gen.ts` — adjust imports throughout this plan if the generator produces slightly different identifiers (e.g. `accountEmailChangeRequest` vs `accountEmailChangeRequestXxx`). The generator suffixes hash IDs onto some names; check before importing.

## File structure

**Create:**
- `src/routes/(auth)/account/security/email-change-card.svelte` — the card component
- `src/routes/(public)/account/confirm-email-change/+page.svelte` — public confirmation UI
- `src/routes/(public)/account/confirm-email-change/+page.server.ts` — confirm form action + cookie write

**Modify:**
- `src/routes/(auth)/account/security/+page.svelte` — render the new card
- `src/routes/(auth)/account/security/+page.server.ts` — add `requestEmailChange` action
- `src/routes/(auth)/account/profile/+page.svelte` — add the "Change email →" link
- `src/lib/schemas/auth.ts` — add request + confirm Zod schemas
- `src/lib/schemas/auth.test.ts` — tests for the new schemas
- `messages/en.json`, `messages/it.json`, `messages/de.json` — new strings

## Branch & API client

- [ ] **Step 0.1: Confirm branch and regenerate API client**

Branch `feature/email-change-flow` already exists with the spec committed. From the repo root:

```bash
git status
git rev-parse --abbrev-ref HEAD  # expected: feature/email-change-flow
pnpm generate:api
```

Expected: `accountEmailChangeRequest` and `accountEmailChangeConfirm` (or hashed equivalents) appear in `src/lib/api/generated/sdk.gen.ts`.

Verify:

```bash
grep -n "emailChange" src/lib/api/generated/sdk.gen.ts
```

Expected: two function exports.

- [ ] **Step 0.2: Commit the regenerated client**

```bash
git add src/lib/api/generated/
git commit -m "chore: regenerate API client for email-change endpoints"
```

---

## Task 1: Zod schemas + tests

**Files:**
- Modify: `src/lib/schemas/auth.ts`
- Modify: `src/lib/schemas/auth.test.ts`

- [ ] **Step 1.1: Write failing tests for `emailChangeRequestSchema` and `emailChangeConfirmSchema`**

Append to `src/lib/schemas/auth.test.ts` (inside the existing top-level `describe('Auth Schemas', ...)` block — match the existing style):

```ts
import {
	registerSchema,
	loginSchema,
	otpSchema,
	resendVerificationSchema,
	calculatePasswordStrength,
	emailChangeRequestSchema,
	emailChangeConfirmSchema
} from './auth';

// ... existing tests stay as they are ...

describe('emailChangeRequestSchema', () => {
	it('accepts a valid new email and password', () => {
		const result = emailChangeRequestSchema.safeParse({
			new_email: 'new@example.com',
			password: 'somePassword123'
		});
		expect(result.success).toBe(true);
	});

	it('lowercases the new email', () => {
		const result = emailChangeRequestSchema.safeParse({
			new_email: 'New@Example.COM',
			password: 'somePassword123'
		});
		expect(result.success).toBe(true);
		if (result.success) {
			expect(result.data.new_email).toBe('new@example.com');
		}
	});

	it('rejects an invalid email', () => {
		const result = emailChangeRequestSchema.safeParse({
			new_email: 'not-an-email',
			password: 'somePassword123'
		});
		expect(result.success).toBe(false);
	});

	it('rejects an empty password', () => {
		const result = emailChangeRequestSchema.safeParse({
			new_email: 'new@example.com',
			password: ''
		});
		expect(result.success).toBe(false);
	});
});

describe('emailChangeConfirmSchema', () => {
	it('accepts a non-empty token', () => {
		const result = emailChangeConfirmSchema.safeParse({ token: 'abc.def.ghi' });
		expect(result.success).toBe(true);
	});

	it('rejects an empty token', () => {
		const result = emailChangeConfirmSchema.safeParse({ token: '' });
		expect(result.success).toBe(false);
	});
});
```

- [ ] **Step 1.2: Run tests and verify they fail**

```bash
pnpm test src/lib/schemas/auth.test.ts
```

Expected: failures referencing `emailChangeRequestSchema` and `emailChangeConfirmSchema` not being exported.

- [ ] **Step 1.3: Add the schemas in `src/lib/schemas/auth.ts`**

Append to the end of `src/lib/schemas/auth.ts`, before any existing trailing helper functions if any:

```ts
/**
 * Email change request schema (initiation form on /account/security).
 * Mirrors the backend's `EmailChangeRequestSchema`: lowercased EmailStr + current password.
 */
export const emailChangeRequestSchema = z.object({
	new_email: z
		.string()
		.trim()
		.toLowerCase()
		.email('Please enter a valid email address'),
	password: z.string().min(1, 'Password is required')
});

export type EmailChangeRequestFormData = z.infer<typeof emailChangeRequestSchema>;

/**
 * Email change confirmation schema (token from the email link).
 */
export const emailChangeConfirmSchema = z.object({
	token: z.string().min(1, 'Confirmation token is required')
});

export type EmailChangeConfirmFormData = z.infer<typeof emailChangeConfirmSchema>;
```

- [ ] **Step 1.4: Run tests and verify they pass**

```bash
pnpm test src/lib/schemas/auth.test.ts
```

Expected: PASS, all assertions green.

- [ ] **Step 1.5: Commit**

```bash
git add src/lib/schemas/auth.ts src/lib/schemas/auth.test.ts
git commit -m "feat(auth): zod schemas for email-change request and confirm"
```

---

## Task 2: Translations

**Files:**
- Modify: `messages/en.json`
- Modify: `messages/it.json`
- Modify: `messages/de.json`

- [ ] **Step 2.1: Add new keys to `messages/en.json`**

Inside the existing `"accountSecurityPage"` object (find the `"toast_passwordResetFailed"` key — append after it), add:

```json
"emailChange_title": "Email address",
"emailChange_description": "Change the email you use to sign in.",
"emailChange_currentLabel": "Current",
"emailChange_changeButton": "Change email",
"emailChange_formTitle": "Change your email",
"emailChange_formDescription": "We'll send a confirmation link to your new address. The change takes effect when you click that link.",
"emailChange_signoutWarning": "Confirming will sign you out of every other device. You'll stay signed in here.",
"emailChange_newEmailLabel": "New email address",
"emailChange_newEmailPlaceholder": "you@example.com",
"emailChange_passwordLabel": "Current password",
"emailChange_passwordPlaceholder": "Enter your current password",
"emailChange_showPassword": "Show password",
"emailChange_hidePassword": "Hide password",
"emailChange_submitButton": "Send confirmation link",
"emailChange_submitting": "Sending…",
"emailChange_cancelDialogTitle": "Discard your changes?",
"emailChange_cancelDialogDescription": "Your new email won't be saved. You can start the change again any time.",
"emailChange_cancelDialogConfirm": "Discard",
"emailChange_cancelDialogKeepEditing": "Keep editing",
"emailChange_successTitle": "Check your inbox",
"emailChange_successBody": "We sent a confirmation link to {new_email}.",
"emailChange_successNotice": "We also sent a notice to {current_email} so you know about this change from both sides.",
"emailChange_successExpiry": "The link expires in 15 minutes.",
"emailChange_successDone": "Done",
"emailChange_error_wrongPassword": "Incorrect password.",
"emailChange_error_sameEmail": "That's already your current email.",
"emailChange_error_duplicate": "This email is already in use.",
"emailChange_error_throttled": "Too many attempts. Please try again in a few minutes.",
"emailChange_error_generic": "Something went wrong. Please try again."
```

In `messages/en.json` at the top level, add a new sibling object alongside `accountSecurityPage`:

```json
"confirmEmailChange": {
	"pageTitle": "Confirm email change",
	"metaDescription": "Confirm the new email address for your Revel account.",
	"invalidLink_heading": "Invalid link",
	"invalidLink_body": "This confirmation link is missing or malformed. Start the email change again from your account settings.",
	"invalidLink_cta": "Go to security settings",
	"confirm_heading": "Confirm your new email",
	"confirm_intro": "You're about to set this as the email you use to sign in to Revel.",
	"confirm_warningTitle": "You will be signed out of every other device",
	"confirm_warningBody": "Confirming changes a core part of your identity, so every other session is invalidated. You'll stay signed in on this device.",
	"confirm_warningBullet1": "Any open Revel tabs on other devices will need to sign back in.",
	"confirm_warningBullet2": "Use your new email and the same password to sign in elsewhere.",
	"confirm_cancel": "Cancel",
	"confirm_submit": "Confirm change",
	"confirm_submitting": "Confirming…",
	"success_heading": "Email updated",
	"success_body": "Your email has been updated to {new_email}.",
	"success_signoutNotice": "You've been signed out of all your other devices for security. You're still signed in here.",
	"success_cta": "Go to your account",
	"error_expired": "This link has expired or has already been used. Start the email change again.",
	"error_emailTaken": "This email is no longer available. Start over with a different address.",
	"error_throttled": "Too many attempts. Please try again in a few minutes.",
	"error_generic": "Something went wrong. Please try again.",
	"error_cta": "Go to security settings"
}
```

Inside the existing `"profile"` object in `messages/en.json` (search for `"email_hint"`), add this sibling key right after `email_hint`:

```json
"email_changeLink": "Change email →"
```

- [ ] **Step 2.2: Mirror the same keys in `messages/it.json`**

Add the same keys with placeholder translations (free to use literal Italian translations — these are user-facing strings):

`accountSecurityPage`:
```json
"emailChange_title": "Indirizzo email",
"emailChange_description": "Cambia l'email che usi per accedere.",
"emailChange_currentLabel": "Attuale",
"emailChange_changeButton": "Cambia email",
"emailChange_formTitle": "Cambia la tua email",
"emailChange_formDescription": "Invieremo un link di conferma al tuo nuovo indirizzo. La modifica diventa effettiva quando clicchi su quel link.",
"emailChange_signoutWarning": "Confermando, verrai disconnesso da tutti gli altri dispositivi. Resterai connesso qui.",
"emailChange_newEmailLabel": "Nuovo indirizzo email",
"emailChange_newEmailPlaceholder": "tu@esempio.com",
"emailChange_passwordLabel": "Password attuale",
"emailChange_passwordPlaceholder": "Inserisci la tua password attuale",
"emailChange_showPassword": "Mostra password",
"emailChange_hidePassword": "Nascondi password",
"emailChange_submitButton": "Invia link di conferma",
"emailChange_submitting": "Invio in corso…",
"emailChange_cancelDialogTitle": "Annullare le modifiche?",
"emailChange_cancelDialogDescription": "La tua nuova email non sarà salvata. Puoi riavviare la modifica in qualsiasi momento.",
"emailChange_cancelDialogConfirm": "Annulla",
"emailChange_cancelDialogKeepEditing": "Continua a modificare",
"emailChange_successTitle": "Controlla la tua casella di posta",
"emailChange_successBody": "Abbiamo inviato un link di conferma a {new_email}.",
"emailChange_successNotice": "Abbiamo anche inviato una notifica a {current_email} per informarti del cambiamento da entrambi i lati.",
"emailChange_successExpiry": "Il link scade tra 15 minuti.",
"emailChange_successDone": "Fatto",
"emailChange_error_wrongPassword": "Password errata.",
"emailChange_error_sameEmail": "Questa è già la tua email attuale.",
"emailChange_error_duplicate": "Questa email è già in uso.",
"emailChange_error_throttled": "Troppi tentativi. Riprova tra qualche minuto.",
"emailChange_error_generic": "Qualcosa è andato storto. Riprova."
```

`confirmEmailChange` (top-level sibling):
```json
"confirmEmailChange": {
	"pageTitle": "Conferma modifica email",
	"metaDescription": "Conferma il nuovo indirizzo email per il tuo account Revel.",
	"invalidLink_heading": "Link non valido",
	"invalidLink_body": "Questo link di conferma è mancante o non valido. Riavvia la modifica dell'email dalle impostazioni del tuo account.",
	"invalidLink_cta": "Vai alle impostazioni di sicurezza",
	"confirm_heading": "Conferma la tua nuova email",
	"confirm_intro": "Stai per impostare questo come l'indirizzo email che usi per accedere a Revel.",
	"confirm_warningTitle": "Verrai disconnesso da tutti gli altri dispositivi",
	"confirm_warningBody": "La conferma modifica una parte fondamentale della tua identità, quindi ogni altra sessione viene invalidata. Resterai connesso su questo dispositivo.",
	"confirm_warningBullet1": "Tutte le schede Revel aperte su altri dispositivi dovranno effettuare nuovamente l'accesso.",
	"confirm_warningBullet2": "Usa la tua nuova email e la stessa password per accedere da altri dispositivi.",
	"confirm_cancel": "Annulla",
	"confirm_submit": "Conferma modifica",
	"confirm_submitting": "Conferma in corso…",
	"success_heading": "Email aggiornata",
	"success_body": "La tua email è stata aggiornata a {new_email}.",
	"success_signoutNotice": "Sei stato disconnesso da tutti gli altri dispositivi per sicurezza. Sei ancora connesso qui.",
	"success_cta": "Vai al tuo account",
	"error_expired": "Questo link è scaduto o è già stato usato. Riavvia la modifica dell'email.",
	"error_emailTaken": "Questa email non è più disponibile. Riavvia con un indirizzo diverso.",
	"error_throttled": "Troppi tentativi. Riprova tra qualche minuto.",
	"error_generic": "Qualcosa è andato storto. Riprova.",
	"error_cta": "Vai alle impostazioni di sicurezza"
}
```

`profile.email_changeLink`:
```json
"email_changeLink": "Cambia email →"
```

- [ ] **Step 2.3: Mirror the same keys in `messages/de.json`**

`accountSecurityPage`:
```json
"emailChange_title": "E-Mail-Adresse",
"emailChange_description": "Ändere die E-Mail-Adresse, mit der du dich anmeldest.",
"emailChange_currentLabel": "Aktuell",
"emailChange_changeButton": "E-Mail ändern",
"emailChange_formTitle": "E-Mail-Adresse ändern",
"emailChange_formDescription": "Wir senden einen Bestätigungslink an deine neue Adresse. Die Änderung tritt in Kraft, sobald du auf diesen Link klickst.",
"emailChange_signoutWarning": "Bei der Bestätigung wirst du auf allen anderen Geräten abgemeldet. Auf diesem Gerät bleibst du angemeldet.",
"emailChange_newEmailLabel": "Neue E-Mail-Adresse",
"emailChange_newEmailPlaceholder": "du@beispiel.de",
"emailChange_passwordLabel": "Aktuelles Passwort",
"emailChange_passwordPlaceholder": "Gib dein aktuelles Passwort ein",
"emailChange_showPassword": "Passwort anzeigen",
"emailChange_hidePassword": "Passwort verbergen",
"emailChange_submitButton": "Bestätigungslink senden",
"emailChange_submitting": "Wird gesendet…",
"emailChange_cancelDialogTitle": "Änderungen verwerfen?",
"emailChange_cancelDialogDescription": "Deine neue E-Mail-Adresse wird nicht gespeichert. Du kannst den Vorgang jederzeit erneut starten.",
"emailChange_cancelDialogConfirm": "Verwerfen",
"emailChange_cancelDialogKeepEditing": "Weiter bearbeiten",
"emailChange_successTitle": "Sieh in dein Postfach",
"emailChange_successBody": "Wir haben einen Bestätigungslink an {new_email} gesendet.",
"emailChange_successNotice": "Wir haben außerdem eine Mitteilung an {current_email} gesendet, damit du die Änderung von beiden Seiten kennst.",
"emailChange_successExpiry": "Der Link läuft in 15 Minuten ab.",
"emailChange_successDone": "Fertig",
"emailChange_error_wrongPassword": "Falsches Passwort.",
"emailChange_error_sameEmail": "Das ist bereits deine aktuelle E-Mail-Adresse.",
"emailChange_error_duplicate": "Diese E-Mail-Adresse wird bereits verwendet.",
"emailChange_error_throttled": "Zu viele Versuche. Bitte versuche es in ein paar Minuten erneut.",
"emailChange_error_generic": "Etwas ist schiefgelaufen. Bitte versuche es erneut."
```

`confirmEmailChange`:
```json
"confirmEmailChange": {
	"pageTitle": "E-Mail-Änderung bestätigen",
	"metaDescription": "Bestätige die neue E-Mail-Adresse für dein Revel-Konto.",
	"invalidLink_heading": "Ungültiger Link",
	"invalidLink_body": "Dieser Bestätigungslink fehlt oder ist ungültig. Starte die E-Mail-Änderung erneut über deine Kontoeinstellungen.",
	"invalidLink_cta": "Zu den Sicherheitseinstellungen",
	"confirm_heading": "Bestätige deine neue E-Mail-Adresse",
	"confirm_intro": "Du legst diese Adresse gleich als deine Anmeldeadresse für Revel fest.",
	"confirm_warningTitle": "Du wirst auf allen anderen Geräten abgemeldet",
	"confirm_warningBody": "Die Bestätigung ändert einen zentralen Teil deiner Identität, daher werden alle anderen Sitzungen ungültig. Auf diesem Gerät bleibst du angemeldet.",
	"confirm_warningBullet1": "Offene Revel-Tabs auf anderen Geräten müssen sich neu anmelden.",
	"confirm_warningBullet2": "Verwende deine neue E-Mail-Adresse mit dem gleichen Passwort, um dich anderswo anzumelden.",
	"confirm_cancel": "Abbrechen",
	"confirm_submit": "Änderung bestätigen",
	"confirm_submitting": "Wird bestätigt…",
	"success_heading": "E-Mail aktualisiert",
	"success_body": "Deine E-Mail-Adresse wurde auf {new_email} aktualisiert.",
	"success_signoutNotice": "Du wurdest aus Sicherheitsgründen auf allen anderen Geräten abgemeldet. Auf diesem Gerät bleibst du angemeldet.",
	"success_cta": "Zu deinem Konto",
	"error_expired": "Dieser Link ist abgelaufen oder wurde bereits verwendet. Starte die E-Mail-Änderung erneut.",
	"error_emailTaken": "Diese E-Mail-Adresse ist nicht mehr verfügbar. Starte erneut mit einer anderen Adresse.",
	"error_throttled": "Zu viele Versuche. Bitte versuche es in ein paar Minuten erneut.",
	"error_generic": "Etwas ist schiefgelaufen. Bitte versuche es erneut.",
	"error_cta": "Zu den Sicherheitseinstellungen"
}
```

`profile.email_changeLink`:
```json
"email_changeLink": "E-Mail ändern →"
```

- [ ] **Step 2.4: Compile paraglide and verify i18n check passes**

```bash
pnpm paraglide:compile
make i18n-check
```

Expected: i18n-check passes (no missing keys across locales).

- [ ] **Step 2.5: Commit**

```bash
git add messages/ src/lib/paraglide/
git commit -m "i18n: strings for email-change flow (en, it, de)"
```

---

## Task 3: Server-side action `requestEmailChange`

**Files:**
- Modify: `src/routes/(auth)/account/security/+page.server.ts`

- [ ] **Step 3.1: Inspect the existing actions to follow the same pattern**

Re-read `src/routes/(auth)/account/security/+page.server.ts` lines 46-100 (the `setup` action). Note: actions return either a success object or `fail(status, { errors })`. The 2FA actions use `extractErrorMessage` from `$lib/utils/errors` to coerce backend error payloads — do the same.

- [ ] **Step 3.2: Add the `requestEmailChange` action**

At the top of `src/routes/(auth)/account/security/+page.server.ts`, augment the import for the API client:

```ts
import {
	otpSetupOtp,
	otpEnableOtp,
	otpDisableOtp,
	accountMe,
	accountEmailChangeRequest
} from '$lib/api/client';
```

(If the generator placed `accountEmailChangeRequest` under `$lib/api/generated/sdk.gen` or `$lib/api/generated`, mirror exactly where `accountResetPasswordRequest` is imported in `src/routes/(auth)/account/security/+page.svelte:10` and use that module. The repo re-exports the SDK from a single barrel — verify by running `grep -n "accountEmailChangeRequest" src/lib/api/`).

Also add the schema import:

```ts
import { emailChangeRequestSchema } from '$lib/schemas/auth';
```

Append the new action to the `actions` object (after `disable`, before the closing `}`):

```ts
/**
 * Request a self-served email change.
 *
 * Backend returns 200 with a ResponseMessage on success (and also on the
 * silent globally-banned no-op — we treat that as success because the BE
 * deliberately doesn't distinguish, to avoid signalling ban presence).
 */
requestEmailChange: async ({ request, cookies }) => {
	const accessToken = cookies.get('access_token');

	if (!accessToken) {
		return fail(401, { errors: { form: 'Unauthorized' } });
	}

	const formData = await request.formData();
	const validation = emailChangeRequestSchema.safeParse({
		new_email: formData.get('new_email'),
		password: formData.get('password')
	});

	if (!validation.success) {
		const errors: Record<string, string> = {};
		validation.error.errors.forEach((e) => {
			if (e.path[0]) errors[e.path[0].toString()] = e.message;
		});
		return fail(400, { errors });
	}

	try {
		const response = await accountEmailChangeRequest({
			body: {
				new_email: validation.data.new_email,
				password: validation.data.password
			},
			headers: { Authorization: `Bearer ${accessToken}` }
		});

		if (response.response.ok) {
			return {
				success: true,
				emailChange: {
					new_email: validation.data.new_email
				}
			};
		}

		// Map backend 400 errors back to field-specific errors.
		const status = response.response.status;
		const message = extractErrorMessage(response.error, '');

		if (status === 429) {
			return fail(429, {
				errors: { form: 'throttled' },
				emailChange: { failed: true }
			});
		}

		if (status === 400) {
			const lower = message.toLowerCase();
			if (lower.includes('password')) {
				return fail(400, {
					errors: { password: 'wrongPassword' },
					emailChange: { failed: true }
				});
			}
			if (lower.includes('same')) {
				return fail(400, {
					errors: { new_email: 'sameEmail' },
					emailChange: { failed: true }
				});
			}
			if (lower.includes('already in use')) {
				return fail(400, {
					errors: { new_email: 'duplicate' },
					emailChange: { failed: true }
				});
			}
			return fail(400, {
				errors: { form: 'generic' },
				emailChange: { failed: true }
			});
		}

		return fail(500, {
			errors: { form: 'generic' },
			emailChange: { failed: true }
		});
	} catch (error) {
		console.error('Email change request error:', error);
		return fail(500, {
			errors: { form: 'generic' },
			emailChange: { failed: true }
		});
	}
}
```

The `errors` values are **error keys** (`wrongPassword`, `sameEmail`, `duplicate`, `throttled`, `generic`), not user-visible text — the component maps them to the relevant `m['accountSecurityPage.emailChange_error_*']()` translation. This keeps i18n in the client where Paraglide lives.

- [ ] **Step 3.3: Run lint + types to make sure nothing else broke**

```bash
make types
make lint
```

Expected: both pass.

- [ ] **Step 3.4: Commit**

```bash
git add src/routes/\(auth\)/account/security/+page.server.ts
git commit -m "feat(account): server action for email-change request"
```

---

## Task 4: The `EmailChangeCard` component

**Files:**
- Create: `src/routes/(auth)/account/security/email-change-card.svelte`

- [ ] **Step 4.1: Write the card component**

Create `src/routes/(auth)/account/security/email-change-card.svelte` with the full content below. The component takes the user (for the current email and verified state) and the form result (so it can render success / errors after the SvelteKit action returns).

```svelte
<script lang="ts">
	import * as m from '$lib/paraglide/messages.js';
	import { enhance, applyAction } from '$app/forms';
	import { Mail, Eye, EyeOff, AlertTriangle, CheckCircle, ShieldCheck } from 'lucide-svelte';
	import { toast } from 'svelte-sonner';
	import * as Dialog from '$lib/components/ui/dialog';
	import type { RevelUserSchema } from '$lib/api/generated/types.gen';

	interface EmailChangeFormState {
		emailChange?: {
			new_email?: string;
			failed?: boolean;
		};
		errors?: Record<string, string>;
	}

	interface Props {
		user: RevelUserSchema | null | undefined;
		form: EmailChangeFormState | null | undefined;
	}

	const { user, form }: Props = $props();

	let showForm = $state(false);
	let newEmail = $state('');
	let password = $state('');
	let showPassword = $state(false);
	let isSubmitting = $state(false);
	let cancelDialogOpen = $state(false);

	let changeButtonEl = $state<HTMLButtonElement | null>(null);
	let newEmailInputEl = $state<HTMLInputElement | null>(null);
	let wasFormOpen = false;

	$effect(() => {
		if (showForm && !wasFormOpen) {
			wasFormOpen = true;
			// Defer to the next microtask so the input is in the DOM.
			queueMicrotask(() => newEmailInputEl?.focus());
		} else if (!showForm && wasFormOpen) {
			wasFormOpen = false;
			queueMicrotask(() => changeButtonEl?.focus());
		}
	});

	const currentEmail = $derived(user?.email ?? '');
	const emailVerified = $derived(user?.email_verified ?? false);

	const submittedEmail = $derived(form?.emailChange?.new_email ?? '');
	const submissionSucceeded = $derived(!!submittedEmail && !form?.emailChange?.failed);

	const hasUnsavedInput = $derived(newEmail.length > 0 || password.length > 0);

	const fieldErrorKey = $derived(form?.errors ?? {});

	function emailErrorMessage(): string | null {
		const key = fieldErrorKey.new_email;
		if (!key) return null;
		if (key === 'sameEmail') return m['accountSecurityPage.emailChange_error_sameEmail']();
		if (key === 'duplicate') return m['accountSecurityPage.emailChange_error_duplicate']();
		return key; // fallback: raw zod message
	}

	function passwordErrorMessage(): string | null {
		const key = fieldErrorKey.password;
		if (!key) return null;
		if (key === 'wrongPassword') return m['accountSecurityPage.emailChange_error_wrongPassword']();
		return key;
	}

	function formErrorMessage(): string | null {
		const key = fieldErrorKey.form;
		if (!key) return null;
		if (key === 'throttled') return m['accountSecurityPage.emailChange_error_throttled']();
		if (key === 'generic') return m['accountSecurityPage.emailChange_error_generic']();
		return key;
	}

	function resetForm() {
		showForm = false;
		newEmail = '';
		password = '';
		showPassword = false;
	}

	function attemptCancel() {
		if (hasUnsavedInput) {
			cancelDialogOpen = true;
		} else {
			resetForm();
		}
	}

	function confirmDiscard() {
		cancelDialogOpen = false;
		resetForm();
	}

	const submitDisabled = $derived(
		isSubmitting || newEmail.length === 0 || password.length === 0
	);
</script>

<div id="email" class="mt-6 rounded-lg border bg-card p-6" style="scroll-margin-top: 5rem;">
	<div class="flex items-start gap-4">
		<div class="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary">
			<Mail class="h-6 w-6" aria-hidden="true" />
		</div>

		<div class="flex-1">
			<div>
				<h2 class="text-xl font-semibold">{m['accountSecurityPage.emailChange_title']()}</h2>
				<p class="mt-1 text-sm text-muted-foreground">
					{m['accountSecurityPage.emailChange_description']()}
				</p>
			</div>

			{#if !showForm && !submissionSucceeded}
				<div class="mt-4">
					<p class="text-sm">
						<span class="text-muted-foreground">{m['accountSecurityPage.emailChange_currentLabel']()}:</span>
						<span class="ml-1 font-medium">{currentEmail}</span>
						{#if emailVerified}
							<span class="ml-2 inline-flex items-center gap-1 rounded bg-green-100 px-1.5 py-0.5 text-xs font-medium text-green-800 dark:bg-green-950 dark:text-green-300">
								<ShieldCheck class="h-3 w-3" aria-hidden="true" />
								{m['profile.email_verified']()}
							</span>
						{/if}
					</p>
				</div>

				<div class="mt-6">
					<button
						type="button"
						bind:this={changeButtonEl}
						class="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
						onclick={() => (showForm = true)}
					>
						{m['accountSecurityPage.emailChange_changeButton']()}
					</button>
				</div>
			{/if}

			{#if showForm && !submissionSucceeded}
				<div class="mt-6 rounded-lg border bg-muted/50 p-6">
					<h3 class="font-semibold">{m['accountSecurityPage.emailChange_formTitle']()}</h3>
					<p class="mt-2 text-sm text-muted-foreground">
						{m['accountSecurityPage.emailChange_formDescription']()}
					</p>

					<div
						class="mt-4 flex items-start gap-3 rounded-md border border-amber-200 bg-amber-50 p-3 dark:border-amber-900 dark:bg-amber-950"
						role="status"
					>
						<AlertTriangle class="mt-0.5 h-5 w-5 flex-shrink-0 text-amber-700 dark:text-amber-400" aria-hidden="true" />
						<p class="text-sm text-amber-900 dark:text-amber-200">
							{m['accountSecurityPage.emailChange_signoutWarning']()}
						</p>
					</div>

					<form
						method="POST"
						action="?/requestEmailChange"
						use:enhance={() => {
							if (isSubmitting) return;
							isSubmitting = true;
							return async ({ result }) => {
								isSubmitting = false;
								await applyAction(result);
								if (result.type === 'failure' && result.data) {
									const errs = (result.data as any).errors ?? {};
									if (errs.form === 'throttled') {
										toast.error(m['accountSecurityPage.emailChange_error_throttled']());
									}
								}
							};
						}}
						class="mt-4 space-y-4"
					>
						<div class="space-y-2">
							<label for="emailChange_new_email" class="block text-sm font-medium">
								{m['accountSecurityPage.emailChange_newEmailLabel']()}
							</label>
							<input
								id="emailChange_new_email"
								name="new_email"
								type="email"
								autocomplete="email"
								required
								bind:value={newEmail}
								bind:this={newEmailInputEl}
								disabled={isSubmitting}
								placeholder={m['accountSecurityPage.emailChange_newEmailPlaceholder']()}
								aria-invalid={!!emailErrorMessage()}
								aria-describedby={emailErrorMessage() ? 'emailChange_new_email_error' : undefined}
								class="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm transition-colors placeholder:text-muted-foreground focus:border-ring focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 {emailErrorMessage() ? 'border-destructive' : ''}"
							/>
							{#if emailErrorMessage()}
								<p id="emailChange_new_email_error" class="text-sm text-destructive" role="alert">
									{emailErrorMessage()}
								</p>
							{/if}
						</div>

						<div class="space-y-2">
							<label for="emailChange_password" class="block text-sm font-medium">
								{m['accountSecurityPage.emailChange_passwordLabel']()}
							</label>
							<div class="relative">
								<input
									id="emailChange_password"
									name="password"
									type={showPassword ? 'text' : 'password'}
									autocomplete="current-password"
									required
									bind:value={password}
									disabled={isSubmitting}
									placeholder={m['accountSecurityPage.emailChange_passwordPlaceholder']()}
									aria-invalid={!!passwordErrorMessage()}
									aria-describedby={passwordErrorMessage() ? 'emailChange_password_error' : undefined}
									class="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 pr-10 text-sm transition-colors placeholder:text-muted-foreground focus:border-ring focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 {passwordErrorMessage() ? 'border-destructive' : ''}"
								/>
								<button
									type="button"
									onclick={() => (showPassword = !showPassword)}
									class="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-muted-foreground transition-colors hover:text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
									aria-label={showPassword
										? m['accountSecurityPage.emailChange_hidePassword']()
										: m['accountSecurityPage.emailChange_showPassword']()}
								>
									{#if showPassword}
										<EyeOff class="h-4 w-4" aria-hidden="true" />
									{:else}
										<Eye class="h-4 w-4" aria-hidden="true" />
									{/if}
								</button>
							</div>
							{#if passwordErrorMessage()}
								<p id="emailChange_password_error" class="text-sm text-destructive" role="alert">
									{passwordErrorMessage()}
								</p>
							{/if}
						</div>

						{#if formErrorMessage()}
							<div role="alert" class="rounded-md border border-destructive bg-destructive/10 p-3">
								<p class="text-sm font-medium text-destructive">{formErrorMessage()}</p>
							</div>
						{/if}

						<div class="flex gap-3">
							<button
								type="submit"
								disabled={submitDisabled}
								class="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:opacity-50"
							>
								{isSubmitting
									? m['accountSecurityPage.emailChange_submitting']()
									: m['accountSecurityPage.emailChange_submitButton']()}
							</button>
							<button
								type="button"
								onclick={attemptCancel}
								class="rounded-md border px-4 py-2 text-sm font-medium transition-colors hover:bg-accent focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
							>
								{m['accountSecurityPage.cancel']()}
							</button>
						</div>
					</form>
				</div>
			{/if}

			{#if submissionSucceeded}
				<div class="mt-6 rounded-md border border-green-500 bg-green-50 p-6 dark:bg-green-950">
					<div class="flex items-start gap-3">
						<CheckCircle class="mt-0.5 h-5 w-5 flex-shrink-0 text-green-600 dark:text-green-400" aria-hidden="true" />
						<div class="flex-1 space-y-2 text-sm">
							<p class="font-medium text-green-800 dark:text-green-200">
								{m['accountSecurityPage.emailChange_successTitle']()}
							</p>
							<p class="text-green-700 dark:text-green-300">
								{m['accountSecurityPage.emailChange_successBody']({ new_email: submittedEmail })}
							</p>
							<p class="text-green-700 dark:text-green-300">
								{m['accountSecurityPage.emailChange_successNotice']({ current_email: currentEmail })}
							</p>
							<p class="text-xs text-green-700 dark:text-green-300">
								{m['accountSecurityPage.emailChange_successExpiry']()}
							</p>
						</div>
					</div>
					<div class="mt-4">
						<button
							type="button"
							onclick={resetForm}
							class="rounded-md border px-4 py-2 text-sm font-medium transition-colors hover:bg-accent focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
						>
							{m['accountSecurityPage.emailChange_successDone']()}
						</button>
					</div>
				</div>
			{/if}
		</div>
	</div>
</div>

<Dialog.Root bind:open={cancelDialogOpen}>
	<Dialog.Content>
		<Dialog.Header>
			<Dialog.Title>{m['accountSecurityPage.emailChange_cancelDialogTitle']()}</Dialog.Title>
			<Dialog.Description>
				{m['accountSecurityPage.emailChange_cancelDialogDescription']()}
			</Dialog.Description>
		</Dialog.Header>
		<Dialog.Footer>
			<button
				type="button"
				onclick={() => (cancelDialogOpen = false)}
				class="rounded-md border px-4 py-2 text-sm font-medium transition-colors hover:bg-accent focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
			>
				{m['accountSecurityPage.emailChange_cancelDialogKeepEditing']()}
			</button>
			<button
				type="button"
				onclick={confirmDiscard}
				class="rounded-md bg-destructive px-4 py-2 text-sm font-medium text-destructive-foreground transition-colors hover:bg-destructive/90 focus:outline-none focus:ring-2 focus:ring-destructive focus:ring-offset-2"
			>
				{m['accountSecurityPage.emailChange_cancelDialogConfirm']()}
			</button>
		</Dialog.Footer>
	</Dialog.Content>
</Dialog.Root>
```

- [ ] **Step 4.2: Run svelte-autofixer**

Use the Svelte MCP `svelte-autofixer` tool on the file to catch any Svelte 5 anti-patterns. Fix anything it reports.

- [ ] **Step 4.3: Run type check**

```bash
make types
```

Expected: pass. If `RevelUserSchema` lives at a different path in the generated types, adjust the import — `grep -n "export.*RevelUserSchema" src/lib/api/generated/types.gen.ts`.

- [ ] **Step 4.4: Commit**

```bash
git add src/routes/\(auth\)/account/security/email-change-card.svelte
git commit -m "feat(account): EmailChangeCard component"
```

---

## Task 5: Wire the card into the Security page

**Files:**
- Modify: `src/routes/(auth)/account/security/+page.svelte`

- [ ] **Step 5.1: Render `EmailChangeCard` between 2FA and Password Change**

In `src/routes/(auth)/account/security/+page.svelte`, add the import at the top of the `<script>` block (after the existing imports):

```ts
import EmailChangeCard from './email-change-card.svelte';
```

Then between the closing `</div>` of the 2FA card (line ~464, the `</div>` that closes `<!-- 2FA Section -->`) and the opening `<!-- Password Change Section -->` (line ~466), insert:

```svelte
<EmailChangeCard user={data.user} {form} />
```

- [ ] **Step 5.2: Run dev server and smoke-test manually**

```bash
pnpm dev
```

Visit `/account/security`. Verify the new card renders, the form opens, fields work, password-toggle works, cancel-with-empty-fields closes the form, cancel-with-input opens the dialog.

- [ ] **Step 5.3: Run type check + lint**

```bash
make types
make lint
```

Expected: both pass.

- [ ] **Step 5.4: Commit**

```bash
git add src/routes/\(auth\)/account/security/+page.svelte
git commit -m "feat(account): mount EmailChangeCard on security page"
```

---

## Task 6: Profile-page affordance

**Files:**
- Modify: `src/routes/(auth)/account/profile/+page.svelte`

- [ ] **Step 6.1: Add the "Change email →" link below the existing email hint**

Find the line `<p class="text-xs text-muted-foreground">{m['profile.email_hint']()}</p>` (around line 330). Immediately after that line, before its closing `</div>`, add:

```svelte
<a
	href="/account/security#email"
	class="inline-block text-sm text-primary underline-offset-4 hover:underline"
>
	{m['profile.email_changeLink']()}
</a>
```

- [ ] **Step 6.2: Smoke-test the anchor**

With `pnpm dev` running, visit `/account/profile`, click the link, confirm the page scrolls so the Email-address card on `/account/security` is visible (the card has `scroll-margin-top: 5rem` from Task 4).

- [ ] **Step 6.3: Commit**

```bash
git add src/routes/\(auth\)/account/profile/+page.svelte
git commit -m "feat(account): link from profile email field to security email-change card"
```

---

## Task 7: Public confirmation page — server action

**Files:**
- Create: `src/routes/(public)/account/confirm-email-change/+page.server.ts`

- [ ] **Step 7.1: Create the server action**

```ts
import { fail, type Actions } from '@sveltejs/kit';
import { accountEmailChangeConfirm } from '$lib/api/generated/sdk.gen';
import { emailChangeConfirmSchema } from '$lib/schemas/auth';
import { getAccessTokenCookieOptions, getRefreshTokenCookieOptions } from '$lib/utils/cookies';
import { extractErrorMessage } from '$lib/utils/errors';

export const actions: Actions = {
	confirmEmailChange: async ({ request, cookies, fetch }) => {
		const formData = await request.formData();
		const validation = emailChangeConfirmSchema.safeParse({
			token: formData.get('token')
		});

		if (!validation.success) {
			return fail(400, { errors: { form: 'invalid' } });
		}

		try {
			const response = await accountEmailChangeConfirm({
				body: { token: validation.data.token },
				fetch
			});

			if (response.response.ok && response.data) {
				const tokens = response.data.token as { access: string; refresh: string };
				if (tokens?.access) {
					cookies.set('access_token', tokens.access, getAccessTokenCookieOptions());
				}
				if (tokens?.refresh) {
					cookies.set('refresh_token', tokens.refresh, getRefreshTokenCookieOptions());
				}

				const newEmail = response.data.user?.email ?? '';

				return {
					success: true,
					new_email: newEmail
				};
			}

			const status = response.response.status;
			const message = extractErrorMessage(response.error, '').toLowerCase();

			if (status === 429) {
				return fail(429, { errors: { form: 'throttled' } });
			}

			if (status === 400) {
				if (message.includes('already in use')) {
					return fail(400, { errors: { form: 'emailTaken' } });
				}
				return fail(400, { errors: { form: 'expired' } });
			}

			return fail(500, { errors: { form: 'generic' } });
		} catch (error) {
			console.error('Email change confirm error:', error);
			return fail(500, { errors: { form: 'generic' } });
		}
	}
};
```

Notes:
- No `load` function is defined. The page is fully driven by URL query + form action result — matching `confirm-deletion/+page.server.ts`, which also has no load.
- Like the security action, error values are **keys**, not user text. The component maps them.

- [ ] **Step 7.2: Run type check**

```bash
make types
```

Expected: pass.

- [ ] **Step 7.3: Commit**

```bash
git add src/routes/\(public\)/account/confirm-email-change/+page.server.ts
git commit -m "feat(account): server action for confirming an email change"
```

---

## Task 8: Public confirmation page — UI

**Files:**
- Create: `src/routes/(public)/account/confirm-email-change/+page.svelte`

- [ ] **Step 8.1: Create the page UI**

```svelte
<script lang="ts">
	import { enhance, applyAction } from '$app/forms';
	import { page } from '$app/stores';
	import { invalidateAll } from '$app/navigation';
	import { AlertTriangle, CheckCircle, Loader2, Mail } from 'lucide-svelte';
	import * as m from '$lib/paraglide/messages.js';
	import type { ActionData } from './$types';

	interface Props {
		form: ActionData;
	}

	const { form }: Props = $props();

	const token = $derived($page.url.searchParams.get('token') ?? '');
	const success = $derived(form?.success === true);
	const newEmail = $derived(form?.new_email ?? '');
	const errors = $derived((form?.errors ?? {}) as Record<string, string>);

	let isSubmitting = $state(false);

	function formErrorMessage(): string | null {
		const key = errors.form;
		if (!key) return null;
		if (key === 'expired' || key === 'invalid') return m['confirmEmailChange.error_expired']();
		if (key === 'emailTaken') return m['confirmEmailChange.error_emailTaken']();
		if (key === 'throttled') return m['confirmEmailChange.error_throttled']();
		return m['confirmEmailChange.error_generic']();
	}
</script>

<svelte:head>
	<title>{m['confirmEmailChange.pageTitle']()}</title>
	<meta name="description" content={m['confirmEmailChange.metaDescription']()} />
</svelte:head>

<div class="container mx-auto flex min-h-[calc(100vh-4rem)] items-center justify-center px-4 py-8">
	<div class="w-full max-w-md space-y-8">
		{#if success}
			<div class="text-center">
				<div class="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-green-100 dark:bg-green-950">
					<CheckCircle class="h-8 w-8 text-green-600 dark:text-green-400" aria-hidden="true" />
				</div>
				<h1 class="text-3xl font-bold tracking-tight">{m['confirmEmailChange.success_heading']()}</h1>
			</div>

			<div role="status" class="space-y-3 rounded-md border border-green-500 bg-green-50 p-6 dark:bg-green-950">
				<p class="text-sm font-medium text-green-800 dark:text-green-200">
					{m['confirmEmailChange.success_body']({ new_email: newEmail })}
				</p>
				<p class="text-sm text-green-700 dark:text-green-300">
					{m['confirmEmailChange.success_signoutNotice']()}
				</p>
			</div>

			<div class="text-center">
				<a
					href="/account/profile"
					class="inline-flex h-10 items-center justify-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
				>
					{m['confirmEmailChange.success_cta']()}
				</a>
			</div>
		{:else if !token}
			<div class="text-center">
				<div class="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-destructive/10">
					<AlertTriangle class="h-8 w-8 text-destructive" aria-hidden="true" />
				</div>
				<h1 class="text-3xl font-bold tracking-tight">{m['confirmEmailChange.invalidLink_heading']()}</h1>
				<p class="mt-2 text-muted-foreground">{m['confirmEmailChange.invalidLink_body']()}</p>
			</div>

			<div class="text-center">
				<a
					href="/account/security"
					class="inline-flex h-10 items-center justify-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
				>
					{m['confirmEmailChange.invalidLink_cta']()}
				</a>
			</div>
		{:else}
			<div class="text-center">
				<div class="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-primary/10">
					<Mail class="h-8 w-8 text-primary" aria-hidden="true" />
				</div>
				<h1 class="text-3xl font-bold tracking-tight">{m['confirmEmailChange.confirm_heading']()}</h1>
				<p class="mt-2 text-muted-foreground">{m['confirmEmailChange.confirm_intro']()}</p>
			</div>

			<div
				class="rounded-md border border-amber-200 bg-amber-50 p-6 dark:border-amber-900 dark:bg-amber-950"
				role="region"
				aria-labelledby="confirmEmailChange_warning_title"
			>
				<div class="flex items-start gap-3">
					<AlertTriangle class="mt-0.5 h-5 w-5 flex-shrink-0 text-amber-700 dark:text-amber-400" aria-hidden="true" />
					<div class="flex-1 space-y-2">
						<h2 id="confirmEmailChange_warning_title" class="font-semibold text-amber-900 dark:text-amber-200">
							{m['confirmEmailChange.confirm_warningTitle']()}
						</h2>
						<p class="text-sm text-amber-800 dark:text-amber-200">
							{m['confirmEmailChange.confirm_warningBody']()}
						</p>
						<ul class="space-y-1 text-sm text-amber-800 dark:text-amber-200">
							<li class="flex gap-2">
								<span aria-hidden="true">•</span>
								<span>{m['confirmEmailChange.confirm_warningBullet1']()}</span>
							</li>
							<li class="flex gap-2">
								<span aria-hidden="true">•</span>
								<span>{m['confirmEmailChange.confirm_warningBullet2']()}</span>
							</li>
						</ul>
					</div>
				</div>
			</div>

			{#if formErrorMessage()}
				<div role="alert" class="rounded-md border border-destructive bg-destructive/10 p-4">
					<p class="text-sm font-medium text-destructive">{formErrorMessage()}</p>
					{#if errors.form === 'expired' || errors.form === 'invalid' || errors.form === 'emailTaken'}
						<div class="mt-3">
							<a
								href="/account/security"
								class="text-sm font-medium text-destructive underline-offset-4 hover:underline"
							>
								{m['confirmEmailChange.error_cta']()}
							</a>
						</div>
					{/if}
				</div>
			{/if}

			<form
				method="POST"
				action="?/confirmEmailChange"
				use:enhance={() => {
					if (isSubmitting) return;
					isSubmitting = true;
					return async ({ result }) => {
						isSubmitting = false;
						await applyAction(result);
						if (result.type === 'success') {
							// Ensure the root layout picks up the new cookies / user data.
							await invalidateAll();
						}
					};
				}}
				class="space-y-4"
			>
				<input type="hidden" name="token" value={token} />

				<div class="flex gap-3">
					<a
						href="/"
						class="inline-flex h-10 flex-1 items-center justify-center gap-2 rounded-md border border-input bg-background px-4 py-2 text-sm font-medium transition-colors hover:bg-accent hover:text-accent-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
					>
						{m['confirmEmailChange.confirm_cancel']()}
					</a>
					<button
						type="submit"
						disabled={isSubmitting}
						class="inline-flex h-10 flex-1 items-center justify-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
					>
						{#if isSubmitting}
							<Loader2 class="h-4 w-4 animate-spin" aria-hidden="true" />
							<span>{m['confirmEmailChange.confirm_submitting']()}</span>
						{:else}
							<span>{m['confirmEmailChange.confirm_submit']()}</span>
						{/if}
					</button>
				</div>
			</form>
		{/if}
	</div>
</div>
```

- [ ] **Step 8.2: Run svelte-autofixer**

Use the Svelte MCP `svelte-autofixer` tool on the file. Fix anything it reports.

- [ ] **Step 8.3: Run type check + lint**

```bash
make types
make lint
```

Expected: both pass.

- [ ] **Step 8.4: Commit**

```bash
git add src/routes/\(public\)/account/confirm-email-change/+page.svelte
git commit -m "feat(account): public confirmation page for email change"
```

---

## Task 9: Component tests for the security card

**Files:**
- Create: `src/routes/(auth)/account/security/email-change-card.test.ts`

- [ ] **Step 9.1: Inspect existing component-test patterns to follow**

```bash
find src -name '*.test.ts' -path '*components*' | head -5
```

Pick one as a reference (e.g. one that uses `@testing-library/svelte` and renders a component with props).

- [ ] **Step 9.2: Write the failing tests**

Create `src/routes/(auth)/account/security/email-change-card.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/svelte';
import userEvent from '@testing-library/user-event';
import EmailChangeCard from './email-change-card.svelte';

const baseUser = {
	id: 'user-1',
	email: 'current@example.com',
	email_verified: true,
	first_name: '',
	last_name: '',
	username: 'current@example.com'
} as any;

describe('EmailChangeCard', () => {
	it('renders the current email in resting state', () => {
		render(EmailChangeCard, { user: baseUser, form: null });
		expect(screen.getByText('current@example.com')).toBeTruthy();
		expect(screen.getByRole('button', { name: /change email/i })).toBeTruthy();
	});

	it('reveals the form when the change-email button is clicked', async () => {
		const user = userEvent.setup();
		render(EmailChangeCard, { user: baseUser, form: null });
		await user.click(screen.getByRole('button', { name: /change email/i }));
		expect(screen.getByLabelText(/new email address/i)).toBeTruthy();
		expect(screen.getByLabelText(/current password/i)).toBeTruthy();
	});

	it('cancel closes the form when fields are empty', async () => {
		const user = userEvent.setup();
		render(EmailChangeCard, { user: baseUser, form: null });
		await user.click(screen.getByRole('button', { name: /change email/i }));
		await user.click(screen.getByRole('button', { name: /cancel/i }));
		expect(screen.queryByLabelText(/new email address/i)).toBeNull();
	});

	it('cancel opens the discard dialog when fields have input', async () => {
		const user = userEvent.setup();
		render(EmailChangeCard, { user: baseUser, form: null });
		await user.click(screen.getByRole('button', { name: /change email/i }));
		await user.type(screen.getByLabelText(/new email address/i), 'new@example.com');
		await user.click(screen.getByRole('button', { name: /cancel/i }));
		// Dialog open: "Discard your changes?" appears
		expect(await screen.findByText(/discard your changes\?/i)).toBeTruthy();
	});

	it('renders the wrong-password inline error from a failed form result', () => {
		render(EmailChangeCard, {
			user: baseUser,
			form: {
				emailChange: { failed: true },
				errors: { password: 'wrongPassword' }
			}
		});
		// Form should be shown automatically? It is NOT — failed state with no successful submittedEmail
		// keeps the resting state. The user has to click 'Change email' again. So the inline error
		// surfaces only after re-opening the form. Adjust the assertion:
		// ... NOTE: in the current implementation form data alone does not auto-open the form. The
		// click flow is captured by other tests. This test asserts that opening the form after a
		// failed submission shows the inline error.
	});

	it('shows the success state when the form returns a new email and no failure', () => {
		render(EmailChangeCard, {
			user: baseUser,
			form: { emailChange: { new_email: 'new@example.com' } }
		});
		expect(screen.getByText(/check your inbox/i)).toBeTruthy();
		expect(screen.getByText(/new@example.com/)).toBeTruthy();
		expect(screen.getByText(/15 minutes/i)).toBeTruthy();
	});
});
```

The "wrong password inline error" test is intentionally left as a documented gap (kept as a comment in the suite) — the component does not auto-open the form when the action returns a failure with no `new_email`. We could change that behaviour, but it's a UX call that should be confirmed against the spec before adding behaviour. **For v1, leave the test as a doc note (delete the empty `it.skip` if Vitest complains)** and move on.

Replace the placeholder block with:

```ts
it.todo('shows wrong-password inline error after re-opening the form on failure');
```

- [ ] **Step 9.3: Run the tests, expect them to fail in any way that surfaces a missing setup (jsdom, deps)**

```bash
pnpm test src/routes/\(auth\)/account/security/email-change-card.test.ts
```

If failures are real assertion failures (not setup), proceed. If failures are setup issues (e.g. missing `@testing-library/svelte` types), confirm by `grep -n "@testing-library/svelte" package.json` — these are already listed; tests should run.

- [ ] **Step 9.4: Make the tests pass**

The component is already written; iterate on test queries / assertions until green.

- [ ] **Step 9.5: Commit**

```bash
git add src/routes/\(auth\)/account/security/email-change-card.test.ts
git commit -m "test(account): component tests for EmailChangeCard"
```

---

## Task 10: Final quality gate + manual verification

- [ ] **Step 10.1: Run the full quality gate**

```bash
make fix
make check
make test
```

Expected: all green. If `make check` reports file-length violations, the only file that should be at risk is `email-change-card.svelte` (mostly markup; should be well under 750 lines).

- [ ] **Step 10.2: Manual E2E — happy path (same browser)**

With the backend dev server running and `pnpm dev` up:

1. Sign in as a real user with a known password.
2. Go to `/account/profile`, click "Change email →" — page anchors to security card.
3. Click "Change email" — form expands; warning visible.
4. Enter a new email + correct password; submit.
5. Verify the success card replaces the form ("Check your inbox", expiry text).
6. Check the dev mailbox (MailHog / configured backend dev mailer) for the confirmation email to the new address and the masked notice to the current address.
7. Click the confirmation link → land on `/account/confirm-email-change?token=...`.
8. Verify the warning callout renders correctly. Click "Confirm change".
9. Verify success state ("Email updated to …"). Click "Go to your account".
10. On `/account/profile`, verify the email field now shows the new address.

- [ ] **Step 10.3: Manual E2E — error paths**

In separate runs:

- Submit with the **wrong password** → inline "Incorrect password." under password field.
- Submit with the **current email** as new email → inline "That's already your current email."
- Submit with an email **already in use** by another account → inline "This email is already in use."
- Open the confirmation link in a **different browser** (or after waiting > 15 minutes) → either: (a) success state in the different browser, with new tokens applied; or (b) "This link has expired…" if expired. Verify both.
- Click the **same** confirmation link twice → second click yields "This link has expired or has already been used."
- Tamper with the URL `?token=garbage` → same expired/invalid error.
- Visit `/account/confirm-email-change` **with no token** → invalid-link state.

- [ ] **Step 10.4: Manual E2E — session invalidation**

1. Sign in on browser A.
2. Sign in on browser B with the same account.
3. From browser A, request and confirm an email change.
4. In browser B, attempt any authenticated action — should hit a 401, get bounced through the refresh path, and end up at `/login`.

- [ ] **Step 10.5: Push the branch and open a PR**

```bash
git push -u origin feature/email-change-flow
gh pr create --title "feat(account): self-served email change" --body "$(cat <<'EOF'
## Summary
- Adds a password-gated email-change card on /account/security
- New public confirmation page at /account/confirm-email-change (handles signed-out, signed-in, and cross-device cases)
- Adds Change email link from the profile page to the security card
- New zod schemas + i18n strings across en/it/de

Pairs with revel-backend #422. The backend invalidates every other JWT on confirmation; we surface that clearly in the warning callout and in the success messages on both sides of the flow.

## Test plan
- [ ] Unit tests for the new schemas pass
- [ ] Component tests for EmailChangeCard pass
- [ ] make check / make test / make i18n-check pass
- [ ] Manual happy path (same browser) verified
- [ ] Manual error paths (wrong password, same email, duplicate, expired, double-use, missing token) verified
- [ ] Manual session-invalidation verified across two browsers
EOF
)"
```

---

## Out of scope (deferred)

- No "resend confirmation link" affordance — users re-run the flow if needed.
- No backend "preview new email from token" endpoint; the confirmation page does not display the proposed address.
- No SSO-specific UI gating (SSO not site-wide; backend rejects with 400 if it ever happens).
- No history / audit log surfaced in the UI.
