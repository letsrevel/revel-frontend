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

/** Which of the two 409s `POST /referral/apply` returned. */
export type ReferralConflictKind = 'pending' | 'code_taken';

/**
 * Read the backend's machine-readable conflict code off an error body.
 *
 * `POST /referral/apply` answers 404 and 409 with
 * `{ detail, code }` (BE #987 follow-up, asked for by this issue): `detail` is
 * translated per Accept-Language, `code` is stable. This used to match a
 * fragment of each of the six `django.po` catalogs because the code did not
 * exist yet — deleting that is the whole point of the backend change.
 *
 * Unknown or missing code → `null`, and the page falls back to a generic
 * message rather than guessing. The public apply path only ever raises
 * `pending_application` and `code_taken`; the other members of the backend's
 * `ReferralApplicationErrorCode` union belong to the admin decision routes.
 */
export function readReferralConflict(error: unknown): ReferralConflictKind | null {
	const code = (error as { code?: unknown } | null | undefined)?.code;
	if (code === 'code_taken') return 'code_taken';
	if (code === 'pending_application') return 'pending';
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
