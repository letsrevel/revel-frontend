import { describe, it, expect } from 'vitest';
import {
	referralApplicationSchema,
	trimApplicationInput,
	classifyReferralConflict,
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

describe('classifyReferralConflict', () => {
	const codeTaken: Record<string, string> = {
		en: 'This referral code is already taken.',
		it: 'Questo codice referral è già in uso.',
		de: 'Dieser Empfehlungs-Code ist bereits vergeben.',
		fr: 'Ce code de parrainage est déjà utilisé.',
		es: 'Este código de referido ya está en uso.',
		pt: 'Este código de indicação já está em uso.'
	};

	const pending: Record<string, string> = {
		en: 'You already have a pending application.',
		it: 'Hai già una candidatura in sospeso.',
		de: 'Du hast bereits einen ausstehenden Antrag.',
		fr: 'Tu as déjà une candidature en attente.',
		es: 'Ya tienes una solicitud pendiente.',
		pt: 'Já tens uma candidatura pendente.'
	};

	for (const [lang, detail] of Object.entries(codeTaken)) {
		it(`classifies the real ${lang} "code already taken" backend message`, () => {
			expect(classifyReferralConflict(detail)).toBe('code_taken');
		});
	}

	for (const [lang, detail] of Object.entries(pending)) {
		it(`classifies the real ${lang} "pending application" backend message`, () => {
			expect(classifyReferralConflict(detail)).toBe('pending');
		});
	}

	it('returns null for an unrelated message', () => {
		expect(classifyReferralConflict('Referral applications are not open.')).toBeNull();
	});

	it('returns null for an empty string', () => {
		expect(classifyReferralConflict('')).toBeNull();
	});

	it('is case-insensitive', () => {
		expect(classifyReferralConflict('THIS REFERRAL CODE IS ALREADY TAKEN.')).toBe('code_taken');
		expect(classifyReferralConflict('YOU ALREADY HAVE A PENDING APPLICATION.')).toBe('pending');
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
