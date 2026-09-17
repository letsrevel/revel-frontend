import { describe, it, expect } from 'vitest';
import {
	referralApplicationSchema,
	trimApplicationInput,
	readReferralConflict,
	isReferralInviteId
} from './referral';

/** First issue's stable code + which field it's attached to. */
function firstIssue(result: {
	success: boolean;
	error?: { issues: { message: string; path: PropertyKey[] }[] };
}) {
	const issue = result.error?.issues[0];
	return { message: issue?.message, path: issue?.path[0] };
}

const valid = { email: 'me@example.com', code: 'abc', note: 'hello there' };

describe('referralApplicationSchema', () => {
	it('accepts a fully valid application', () => {
		const result = referralApplicationSchema.safeParse(valid);
		expect(result.success).toBe(true);
		if (result.success) {
			expect(result.data).toEqual(valid);
		}
	});

	describe('email', () => {
		it('rejects a malformed email with email_invalid on the email path', () => {
			const result = referralApplicationSchema.safeParse({ ...valid, email: 'not-an-email' });
			expect(result.success).toBe(false);
			expect(firstIssue(result)).toEqual({ message: 'email_invalid', path: 'email' });
		});

		it('does not normalize the case of a valid mixed-case email', () => {
			const result = referralApplicationSchema.safeParse({
				...valid,
				email: 'Me.Weird@Example.COM'
			});
			expect(result.success).toBe(true);
			if (result.success) {
				expect(result.data.email).toBe('Me.Weird@Example.COM');
			}
		});
	});

	describe('code', () => {
		it('rejects a 2-char code as code_invalid', () => {
			const result = referralApplicationSchema.safeParse({ ...valid, code: 'ab' });
			expect(result.success).toBe(false);
			expect(firstIssue(result)).toEqual({ message: 'code_invalid', path: 'code' });
		});

		it('accepts a 3-char code', () => {
			const result = referralApplicationSchema.safeParse({ ...valid, code: 'abc' });
			expect(result.success).toBe(true);
		});

		it('accepts a 20-char code', () => {
			const code = 'a'.repeat(20);
			const result = referralApplicationSchema.safeParse({ ...valid, code });
			expect(result.success).toBe(true);
		});

		it('rejects a 21-char code as code_invalid', () => {
			const code = 'a'.repeat(21);
			const result = referralApplicationSchema.safeParse({ ...valid, code });
			expect(result.success).toBe(false);
			expect(firstIssue(result)).toEqual({ message: 'code_invalid', path: 'code' });
		});

		it('accepts letters, digits, underscore and hyphen', () => {
			const result = referralApplicationSchema.safeParse({ ...valid, code: 'a-b_C9' });
			expect(result.success).toBe(true);
		});

		it('rejects a space in the code', () => {
			const result = referralApplicationSchema.safeParse({ ...valid, code: 'a b' });
			expect(result.success).toBe(false);
			expect(firstIssue(result)).toEqual({ message: 'code_invalid', path: 'code' });
		});

		it('rejects a dot in the code', () => {
			const result = referralApplicationSchema.safeParse({ ...valid, code: 'a.b' });
			expect(result.success).toBe(false);
			expect(firstIssue(result)).toEqual({ message: 'code_invalid', path: 'code' });
		});

		it('rejects an @ in the code', () => {
			const result = referralApplicationSchema.safeParse({ ...valid, code: 'a@b' });
			expect(result.success).toBe(false);
			expect(firstIssue(result)).toEqual({ message: 'code_invalid', path: 'code' });
		});

		it('does not normalize the case of a valid mixed-case code', () => {
			const result = referralApplicationSchema.safeParse({ ...valid, code: 'AbC-9_z' });
			expect(result.success).toBe(true);
			if (result.success) {
				expect(result.data.code).toBe('AbC-9_z');
			}
		});
	});

	describe('note', () => {
		it('rejects an empty note as note_required', () => {
			const result = referralApplicationSchema.safeParse({ ...valid, note: '' });
			expect(result.success).toBe(false);
			expect(firstIssue(result)).toEqual({ message: 'note_required', path: 'note' });
		});

		it('accepts a note of exactly 2000 chars', () => {
			const note = 'x'.repeat(2000);
			const result = referralApplicationSchema.safeParse({ ...valid, note });
			expect(result.success).toBe(true);
		});

		it('rejects a note of 2001 chars as note_too_long', () => {
			const note = 'x'.repeat(2001);
			const result = referralApplicationSchema.safeParse({ ...valid, note });
			expect(result.success).toBe(false);
			expect(firstIssue(result)).toEqual({ message: 'note_too_long', path: 'note' });
		});
	});
});

describe('trimApplicationInput', () => {
	it('trims whitespace from all three fields', () => {
		const trimmed = trimApplicationInput({
			email: '  me@example.com  ',
			code: '  abc  ',
			note: '  hello  '
		});
		expect(trimmed).toEqual({ email: 'me@example.com', code: 'abc', note: 'hello' });
	});

	it('produces an email that passes the schema after the trim -> parse pipeline', () => {
		// Regression: an untrimmed "  me@example.com " fails z.email()'s format
		// check, because trimming happens in a chained refinement that only runs
		// AFTER the format check. trimApplicationInput exists to run BEFORE
		// validation instead — assert the whole pipeline, not just the trim.
		const raw = { email: '  me@example.com ', code: 'abc', note: 'hello' };
		const trimmed = trimApplicationInput(raw);
		const result = referralApplicationSchema.safeParse(trimmed);
		expect(result.success).toBe(true);
		if (result.success) {
			expect(result.data.email).toBe('me@example.com');
		}
	});
});

describe('readReferralConflict', () => {
	it('classifies a bare code_taken code', () => {
		expect(readReferralConflict({ code: 'code_taken' })).toBe('code_taken');
	});

	it('classifies a bare pending_application code as "pending"', () => {
		expect(readReferralConflict({ code: 'pending_application' })).toBe('pending');
	});

	it('classifies a realistic full "code taken" body off its code', () => {
		expect(
			readReferralConflict({ detail: 'This referral code is already taken.', code: 'code_taken' })
		).toBe('code_taken');
	});

	it('classifies a realistic full "pending application" body off its code', () => {
		expect(
			readReferralConflict({
				detail: 'You already have a pending application.',
				code: 'pending_application'
			})
		).toBe('pending');
	});

	// This is the entire point of BE #987's follow-up: the code is the stable,
	// locale-independent discriminator that replaced matching a fragment of
	// each of the six `django.po` catalogs. A translated `detail` must not
	// stop the classification from working.
	it('classifies a non-English (Italian) "already taken" body via its code, not its detail', () => {
		expect(
			readReferralConflict({ detail: 'Questo codice referral è già in uso.', code: 'code_taken' })
		).toBe('code_taken');
	});

	// Regression guard: `detail` must never be consulted. If it were, this
	// contradictory body (wrong text, right code) would be misclassified.
	it('follows the code even when detail says the opposite thing', () => {
		expect(
			readReferralConflict({
				detail: 'You already have a pending application.',
				code: 'code_taken'
			})
		).toBe('code_taken');
	});

	it('returns null for an admin-only code that cannot reach the public endpoint', () => {
		expect(readReferralConflict({ code: 'already_decided' })).toBeNull();
		expect(readReferralConflict({ code: 'blocked_email' })).toBeNull();
	});

	it('returns null for undefined', () => {
		expect(readReferralConflict(undefined)).toBeNull();
	});

	it('returns null for null', () => {
		expect(readReferralConflict(null)).toBeNull();
	});

	it('returns null for an empty object', () => {
		expect(readReferralConflict({})).toBeNull();
	});

	it('returns null for a body with detail but no code', () => {
		expect(readReferralConflict({ detail: 'something' })).toBeNull();
	});

	it('returns null for a bare string', () => {
		expect(readReferralConflict('code_taken')).toBeNull();
	});

	it('returns null for a number', () => {
		expect(readReferralConflict(42)).toBeNull();
	});

	it('returns null for a non-string code', () => {
		expect(readReferralConflict({ code: 123 })).toBeNull();
	});
});

describe('isReferralInviteId', () => {
	it('accepts a valid lowercase UUID', () => {
		expect(isReferralInviteId('123e4567-e89b-12d3-a456-426614174000')).toBe(true);
	});

	it('accepts a valid uppercase UUID', () => {
		expect(isReferralInviteId('123E4567-E89B-12D3-A456-426614174000')).toBe(true);
	});

	it('rejects null', () => {
		expect(isReferralInviteId(null)).toBe(false);
	});

	it('rejects an empty string', () => {
		expect(isReferralInviteId('')).toBe(false);
	});

	it('rejects a non-UUID string', () => {
		expect(isReferralInviteId('not-a-uuid')).toBe(false);
	});

	it('rejects a UUID with a trailing character', () => {
		expect(isReferralInviteId('123e4567-e89b-12d3-a456-426614174000x')).toBe(false);
	});

	it('rejects a UUID-ish string with wrong segment lengths', () => {
		expect(isReferralInviteId('123e456-e89b-12d3-a456-426614174000')).toBe(false);
	});
});
