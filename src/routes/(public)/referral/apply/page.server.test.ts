import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('$lib/api/generated/sdk.gen', () => ({
	referralApply: vi.fn()
}));
vi.mock('$lib/server/features', () => ({
	getFeatures: vi.fn()
}));
vi.mock('$lib/server/logger', () => ({
	log: { warning: vi.fn(), error: vi.fn(), debug: vi.fn(), info: vi.fn() }
}));
vi.mock('$lib/seo', () => ({ buildSeo: vi.fn(() => ({})) }));
vi.mock('$lib/seo/server', () => ({ resolveLang: vi.fn(() => 'en') }));

import { referralApply } from '$lib/api/generated/sdk.gen';
import { getFeatures } from '$lib/server/features';
import { load, actions } from './+page.server';

const apply = vi.mocked(referralApply);
const features = vi.mocked(getFeatures);

/** Minimal stand-in for the SvelteKit load event this loader actually reads. */
function loadEvent(): Parameters<typeof load>[0] {
	return {
		fetch: globalThis.fetch,
		url: new URL('https://letsrevel.io/referral/apply'),
		request: new Request('https://letsrevel.io/referral/apply')
	} as unknown as Parameters<typeof load>[0];
}

/** Minimal stand-in for the SvelteKit action event: only `request` and `fetch` are read. */
function actionEvent(fields: Record<string, string>): Parameters<typeof actions.default>[0] {
	const fd = new FormData();
	for (const [key, value] of Object.entries(fields)) {
		fd.set(key, value);
	}
	return {
		request: { formData: async () => fd } as unknown as Request,
		fetch: globalThis.fetch,
		url: new URL('https://letsrevel.io/referral/apply')
	} as unknown as Parameters<typeof actions.default>[0];
}

const VALID_FIELDS = { email: 'me@example.com', code: 'abc123', note: 'I would love to join.' };

function respond(status: number, error?: unknown): void {
	apply.mockResolvedValue({
		data: status === 202 ? {} : undefined,
		error,
		response: { status }
	} as never);
}

/**
 * Narrows the action's `{ success: true } | ActionFailure<...>` return union
 * to the failure branch, so callers get typed `.status`/`.data.errors` access
 * instead of casting.
 */
function expectFailure(result: Awaited<ReturnType<typeof actions.default>>) {
	if (!('data' in result)) {
		throw new Error('expected an ActionFailure, got a success result');
	}
	return result;
}

describe('referral apply loader', () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it('returns seo data when the flag is on', async () => {
		features.mockResolvedValue({ referral_applications: true } as never);

		const result = await load(loadEvent());

		expect(result).toHaveProperty('seo');
	});

	it('404s the whole route when the flag is off', async () => {
		features.mockResolvedValue({ referral_applications: false } as never);

		await expect(load(loadEvent())).rejects.toMatchObject({ status: 404 });
	});
});

describe('referral apply action', () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	describe('validation (before any network call)', () => {
		it('rejects a bad email', async () => {
			const result = expectFailure(
				await actions.default(actionEvent({ ...VALID_FIELDS, email: 'not-an-email' }))
			);

			expect(result.status).toBe(400);
			expect(result.data).toMatchObject({ errors: { email: 'email_invalid' } });
			expect(apply).not.toHaveBeenCalled();
		});

		it('rejects a too-short code', async () => {
			const result = expectFailure(
				await actions.default(actionEvent({ ...VALID_FIELDS, code: 'ab' }))
			);

			expect(result.status).toBe(400);
			expect(result.data).toMatchObject({ errors: { code: 'code_invalid' } });
			expect(apply).not.toHaveBeenCalled();
		});

		it('rejects an empty note', async () => {
			const result = expectFailure(
				await actions.default(actionEvent({ ...VALID_FIELDS, note: '' }))
			);

			expect(result.status).toBe(400);
			expect(result.data).toMatchObject({ errors: { note: 'note_required' } });
			expect(apply).not.toHaveBeenCalled();
		});

		it('rejects a note over the 2000-char cap', async () => {
			const result = expectFailure(
				await actions.default(actionEvent({ ...VALID_FIELDS, note: 'a'.repeat(2001) }))
			);

			expect(result.status).toBe(400);
			expect(result.data).toMatchObject({ errors: { note: 'note_too_long' } });
			expect(apply).not.toHaveBeenCalled();
		});

		it('echoes back the TRIMMED values on a validation failure, not the raw submission', async () => {
			// Code trims to 2 chars ("ab"), which still fails validation — this
			// exercises the re-rendered form getting the CLEANED values back, not
			// whatever whitespace the visitor actually typed.
			const result = expectFailure(
				await actions.default(
					actionEvent({ email: '  me@example.com ', code: '  ab  ', note: '  hi  ' })
				)
			);

			expect(result.data.values).toEqual({ email: 'me@example.com', code: 'ab', note: 'hi' });
			expect(apply).not.toHaveBeenCalled();
		});

		it('trims before calling the API on a submission that passes validation', async () => {
			respond(202);

			await actions.default(
				actionEvent({ email: '  me@example.com ', code: '  abc123  ', note: '  hi  ' })
			);

			expect(apply).toHaveBeenCalledWith(
				expect.objectContaining({
					body: { email: 'me@example.com', code: 'abc123', note: 'hi' }
				})
			);
		});
	});

	describe('202 success', () => {
		it('returns success with no errors or values, identically for an ordinary email', async () => {
			respond(202);

			const result = await actions.default(actionEvent(VALID_FIELDS));

			expect(result).toEqual({ success: true });
		});

		// SECURITY: the backend answers 202 for an ordinary email, a BLOCKED
		// email, and an already-enrolled email alike (BE #987) — this endpoint
		// must never let a caller enumerate which. The action has no branch on
		// the response body for a 202, so the three cases are byte-identical by
		// construction; this test pins that down against a "helpful" future
		// diff that inspects `response.data` on success.
		it('returns the exact same shape for a blocked/enrolled email as for an ordinary one', async () => {
			respond(202, undefined);
			const ordinary = await actions.default(actionEvent(VALID_FIELDS));

			respond(202, undefined);
			const blocked = await actions.default(
				actionEvent({ ...VALID_FIELDS, email: 'blocked@example.com' })
			);

			expect(ordinary).toEqual({ success: true });
			expect(blocked).toEqual({ success: true });
			expect(ordinary).not.toHaveProperty('errors');
			expect(ordinary).not.toHaveProperty('values');
		});
	});

	describe('409 conflicts', () => {
		it('a code_taken code classifies as code_taken, with no form error', async () => {
			respond(409, { detail: 'This referral code is already taken.', code: 'code_taken' });

			const result = expectFailure(await actions.default(actionEvent(VALID_FIELDS)));

			expect(result.status).toBe(409);
			expect(result.data.errors.code).toBe('code_taken');
			expect(result.data.errors).not.toHaveProperty('form');
		});

		it('a pending_application code classifies as a form error, with no code error', async () => {
			respond(409, {
				detail: 'You already have a pending application.',
				code: 'pending_application'
			});

			const result = expectFailure(await actions.default(actionEvent(VALID_FIELDS)));

			expect(result.status).toBe(409);
			expect(result.data.errors.form).toBe('pending');
			expect(result.data.errors).not.toHaveProperty('code');
		});

		// This branch matters: silently mislabelling an unrecognised conflict as
		// "pending" (or as "code_taken") would tell the user something false
		// about their application state. `readReferralConflict` falls back to
		// `null` precisely so an unmatched (or absent) code degrades to a
		// generic banner instead of guessing — pin that down explicitly, not
		// just via "not code_taken".
		it('an unrecognised 409 code classifies as generic, explicitly not pending', async () => {
			respond(409, { detail: 'Some new backend wording.', code: 'some_new_code' });

			const result = expectFailure(await actions.default(actionEvent(VALID_FIELDS)));

			expect(result.status).toBe(409);
			expect(result.data.errors.form).toBe('generic');
			expect(result.data.errors.form).not.toBe('pending');
		});

		// This is the entire point of BE #987's follow-up: the code is the
		// stable, locale-independent discriminator, so a translated `detail`
		// must not stop the classification from working.
		it('classifies a non-English (Italian) detail via its code_taken code', async () => {
			respond(409, { detail: 'Questo codice referral è già in uso.', code: 'code_taken' });

			const result = expectFailure(await actions.default(actionEvent(VALID_FIELDS)));

			expect(result.status).toBe(409);
			expect(result.data.errors.code).toBe('code_taken');
		});
	});

	it('404s (throws) rather than failing, when the flag flipped off mid-submission', async () => {
		respond(404, { detail: 'Not found' });

		await expect(actions.default(actionEvent(VALID_FIELDS))).rejects.toMatchObject({
			status: 404
		});
	});

	describe('422 (two different shapes share this status)', () => {
		// The discriminator is the BODY SHAPE, not the status — a 422 can come
		// from either ninja's own request validation (`detail` is a LIST of
		// per-field objects) or the service's `HttpError(422, "...")` for a note
		// that sanitizes down to empty (`detail` is a plain STRING). Only the
		// string form is the specific "your note is empty" case; anything else
		// is a schema mismatch we did not anticipate and must not blame the
		// note field for.
		it('a STRING detail blames the note field', async () => {
			respond(422, { detail: 'A note is required.' });

			const result = expectFailure(await actions.default(actionEvent(VALID_FIELDS)));

			expect(result.status).toBe(422);
			expect(result.data.errors.note).toBe('note_required');
		});

		it('a LIST detail (ninja field-validation shape) falls back to a generic form error', async () => {
			respond(422, { detail: [{ loc: ['body', 'code'], msg: 'field required', type: 'missing' }] });

			const result = expectFailure(await actions.default(actionEvent(VALID_FIELDS)));

			expect(result.status).toBe(422);
			expect(result.data.errors.form).toBe('generic');
			expect(result.data.errors).not.toHaveProperty('note');
		});
	});

	it('429 surfaces as a throttled form error', async () => {
		respond(429, { detail: 'Request was throttled.' });

		const result = expectFailure(await actions.default(actionEvent(VALID_FIELDS)));

		expect(result.status).toBe(429);
		expect(result.data.errors.form).toBe('throttled');
	});

	it('500 (or any other unknown status) surfaces as a generic form error', async () => {
		respond(500, { detail: 'Internal server error.' });

		const result = expectFailure(await actions.default(actionEvent(VALID_FIELDS)));

		expect(result.status).toBe(500);
		expect(result.data.errors.form).toBe('generic');
	});
});
