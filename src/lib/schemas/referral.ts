import { z } from 'zod';

/**
 * Referral-program application form (FE #938, BE #987).
 *
 * The schema is deliberately message-FREE: every issue carries a stable code
 * instead of prose. Validation runs inside a SvelteKit form action, and a form
 * action has no business deciding what language the user reads — the codes
 * travel back to the page, which maps them to paraglide messages. Hard-coding
 * English here (the older `registerSchema` does) ships an untranslated string
 * to five locales.
 */
export type ReferralApplicationIssue =
	'email_invalid' | 'code_invalid' | 'note_required' | 'note_too_long';

/**
 * Mirrors the backend's `ReferralApplicationSchema.code` pattern
 * (`^[A-Za-z0-9_-]{3,20}$`). Codes are matched case-INSENSITIVELY but STORED
 * as typed (BE #987), so nothing here upper- or lower-cases the input.
 */
export const REFERRAL_CODE_PATTERN = /^[A-Za-z0-9_-]{3,20}$/;

/** Backend cap on the free-text note (`maxLength: 2000`). */
export const REFERRAL_NOTE_MAX_LENGTH = 2000;

/** Values arrive pre-trimmed from the form action — see `trimApplicationInput`. */
export const referralApplicationSchema = z.object({
	email: z.email('email_invalid' satisfies ReferralApplicationIssue),
	code: z.string().regex(REFERRAL_CODE_PATTERN, 'code_invalid' satisfies ReferralApplicationIssue),
	note: z
		.string()
		.min(1, 'note_required' satisfies ReferralApplicationIssue)
		.max(REFERRAL_NOTE_MAX_LENGTH, 'note_too_long' satisfies ReferralApplicationIssue)
});

/**
 * Trim before validating rather than inside the schema: `z.email()` is a
 * format check, not a `ZodString` refinement, so a `.trim()` chained onto it
 * would run AFTER the format check and a pasted "  me@example.com " would fail
 * validation before it ever got trimmed. Trimming here also means the values
 * echoed back into the re-rendered form are the cleaned ones.
 */
export function trimApplicationInput(raw: {
	email: string;
	code: string;
	note: string;
}): ReferralApplicationInput {
	return { email: raw.email.trim(), code: raw.code.trim(), note: raw.note.trim() };
}

export type ReferralApplicationInput = z.infer<typeof referralApplicationSchema>;

/** Which of the two 409s the backend returned, when we can tell them apart. */
export type ReferralConflictKind = 'pending' | 'code_taken';

/*
 * `POST /referral/apply` answers BOTH conflicts with a bare
 * `{"detail": "<message>"}` and HTTP 409 — there is no machine-readable
 * discriminator on this endpoint (unlike the account-deletion 409, which
 * carries `code: "referral_forfeiture_confirmation_required"`). The two cases
 * need different UI (one blames the code field and is recoverable, the other
 * is terminal for this email), so the text is all we have.
 *
 * The detail is `gettext`-translated per Accept-Language (BE #724) and our API
 * client forwards the UI locale, so matching only the English sentence would
 * go dead for five of six locales. Match a stable fragment of EACH catalog
 * translation instead — the same approach `tier-form-helpers.ts` takes for the
 * organizer billing error. Fragments are taken verbatim from
 * `revel-backend/src/locale/<lang>/LC_MESSAGES/django.po`.
 *
 * Unmatched → `null`, and the page falls back to a generic message rather than
 * guessing. A backend rewording therefore degrades the copy; it never
 * mislabels the failure.
 */
const CODE_TAKEN_FRAGMENTS = [
	'already taken', // en: This referral code is already taken.
	'già in uso', // it: Questo codice referral è già in uso.
	'bereits vergeben', // de: Dieser Empfehlungs-Code ist bereits vergeben.
	'déjà utilisé', // fr: Ce code de parrainage est déjà utilisé.
	'ya está en uso', // es: Este código de referido ya está en uso.
	'já está em uso' // pt: Este código de indicação já está em uso.
];

const PENDING_FRAGMENTS = [
	'pending application', // en: You already have a pending application.
	'in sospeso', // it: Hai già una candidatura in sospeso.
	'ausstehenden antrag', // de: Du hast bereits einen ausstehenden Antrag.
	'en attente', // fr: Tu as déjà une candidature en attente.
	'solicitud pendiente', // es: Ya tienes una solicitud pendiente.
	'candidatura pendente' // pt: Já tens uma candidatura pendente.
];

export function classifyReferralConflict(detail: string): ReferralConflictKind | null {
	const lower = detail.toLowerCase();
	if (CODE_TAKEN_FRAGMENTS.some((fragment) => lower.includes(fragment))) {
		return 'code_taken';
	}
	if (PENDING_FRAGMENTS.some((fragment) => lower.includes(fragment))) {
		return 'pending';
	}
	return null;
}

/**
 * Is this a referral-application id we can even ask the backend about?
 *
 * The register page takes `?referral_invite=<id>` straight from the URL. Only
 * a well-formed UUID can match a row, so anything else is dropped before the
 * request — a garbage value would otherwise buy a 422 round trip on the
 * critical path of every registration.
 */
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isReferralInviteId(value: string | null): value is string {
	return !!value && UUID_PATTERN.test(value);
}
