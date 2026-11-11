import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as m from '$lib/paraglide/messages.js';
import type { accountDeleteAccountConfirm as AccountDeleteAccountConfirm } from '$lib/api/generated';

/** The SDK result contract; `error` is widened because a network failure carries a TypeError. */
type SdkResult = Awaited<ReturnType<typeof AccountDeleteAccountConfirm>>;
type MockResult = {
	data: SdkResult['data'];
	error: unknown;
	response: SdkResult['response'] | undefined;
};

const accountDeleteAccountConfirm = vi.hoisted(() => vi.fn());
vi.mock('$lib/api/generated', () => ({ accountDeleteAccountConfirm }));
vi.mock('$lib/server/tenant-canonical', () => ({
	resolveReturnTarget: vi.fn().mockResolvedValue(null)
}));
vi.mock('$lib/server/logger', () => ({ log: { error: vi.fn() } }));

import { actions } from './+page.server';

const cookies = { delete: vi.fn() };
const eventFetch = vi.fn();

function run(extra: Record<string, string> = {}): ReturnType<typeof actions.confirmDeletion> {
	const body = new FormData();
	body.set('token', 'tok-123');
	for (const [k, v] of Object.entries(extra)) body.set(k, v);
	return actions.confirmDeletion({
		request: new Request('http://localhost/account/confirm-deletion', { method: 'POST', body }),
		cookies,
		fetch: eventFetch
	} as unknown as Parameters<typeof actions.confirmDeletion>[0]);
}

/** The generated client RESOLVES (does not throw) on a 4xx/5xx (throwOnError: false). */
function resolvesWithError(status: number, error: unknown): void {
	accountDeleteAccountConfirm.mockResolvedValue({
		data: undefined,
		error,
		response: new Response(null, { status })
	} satisfies MockResult);
}

beforeEach(() => {
	accountDeleteAccountConfirm.mockReset();
	cookies.delete.mockReset();
});

describe('confirmDeletion when the API returns an error result (#1226)', () => {
	it('does not clear cookies or report success for a rejected token (401)', async () => {
		resolvesWithError(401, { detail: 'Token expired' });
		const result = await run();
		expect(result).toMatchObject({
			status: 400,
			data: { errors: { form: m['serverErrors.public.deletionTokenInvalid']() } }
		});
		expect(cookies.delete).not.toHaveBeenCalled();
	});

	it('shows the invalid copy for code invalid_token (400)', async () => {
		resolvesWithError(400, { detail: 'Invalid token.', code: 'invalid_token' });
		const result = await run();
		expect(result).toMatchObject({
			status: 400,
			data: { errors: { form: m['serverErrors.public.deletionTokenInvalid']() } }
		});
		expect(result).toMatchObject({ data: { offerNewLink: true } });
		expect(cookies.delete).not.toHaveBeenCalled();
	});

	it('shows the expired copy for code token_expired (400)', async () => {
		resolvesWithError(400, { detail: 'Token has expired.', code: 'token_expired' });
		const result = await run();
		expect(result).toMatchObject({
			status: 400,
			data: {
				errors: { form: m['serverErrors.public.deletionTokenExpired']() },
				offerNewLink: true
			}
		});
		expect(cookies.delete).not.toHaveBeenCalled();
	});

	it('offers a new link for an already-used token (401)', async () => {
		resolvesWithError(401, { detail: 'Unauthorized' });
		expect(await run()).toMatchObject({ status: 400, data: { offerNewLink: true } });
	});

	it.each(['Invalid token: Signature verification failed', 'Jeton invalide : boom'])(
		'treats the legacy code-less "%s" as invalid and never shows the raw text',
		async (detail) => {
			resolvesWithError(400, { detail });
			const result = await run();
			expect(result).toMatchObject({
				status: 400,
				data: { errors: { form: m['serverErrors.public.deletionTokenInvalid']() } }
			});
			expect(JSON.stringify(result)).not.toMatch(/Signature|boom/);
		}
	);

	it('shows the backend detail for a code-less 400 (blacklisted token)', async () => {
		resolvesWithError(400, { detail: 'Token has been used.' });
		expect(await run()).toMatchObject({
			status: 400,
			data: { errors: { form: 'Token has been used.' }, offerNewLink: false }
		});
	});

	it('still shows the owns-organizations refusal (400 detail)', async () => {
		resolvesWithError(400, {
			detail: 'You cannot delete your account while you own organizations.'
		});
		const result = await run();
		expect(result).toMatchObject({
			status: 400,
			data: { errors: { form: 'You cannot delete your account while you own organizations.' } }
		});
		expect(cookies.delete).not.toHaveBeenCalled();
	});

	it('shows the backend detail for a 403, not the owns-orgs copy', async () => {
		resolvesWithError(403, { detail: 'Account suspended' });
		const result = await run();
		expect(result).toMatchObject({ status: 403, data: { errors: { form: 'Account suspended' } } });
		expect(cookies.delete).not.toHaveBeenCalled();
	});

	it('falls back to a generic failure for a 500 without clearing cookies', async () => {
		resolvesWithError(500, undefined);
		const result = await run();
		expect(result).toMatchObject({
			status: 500,
			data: { errors: { form: m['serverErrors.public.unexpectedErrorRetryLater']() } }
		});
		expect(cookies.delete).not.toHaveBeenCalled();
	});

	it('treats a resolved network error (no response) as a localized failure', async () => {
		accountDeleteAccountConfirm.mockResolvedValue({
			data: undefined,
			error: new TypeError('fetch failed'),
			response: undefined
		});
		const result = await run();
		expect(result).toMatchObject({
			status: 500,
			data: { errors: { form: m['serverErrors.public.unexpectedErrorRetryLater']() } }
		});
		expect(JSON.stringify(result)).not.toContain('fetch failed');
		expect(cookies.delete).not.toHaveBeenCalled();
	});

	it('clears the three auth cookies only after a 2xx', async () => {
		accountDeleteAccountConfirm.mockResolvedValue({
			data: { message: 'ok' },
			error: undefined,
			response: new Response(null, { status: 200 })
		});
		const result = await run();
		expect(result).toMatchObject({ success: true });
		expect(cookies.delete).toHaveBeenCalledTimes(3);
	});

	it('passes the event fetch to the SDK call', async () => {
		resolvesWithError(500, undefined);
		await run();
		expect(accountDeleteAccountConfirm.mock.calls[0][0].fetch).toBe(eventFetch);
	});
});

describe('confirmDeletion referral forfeiture (409)', () => {
	const forfeiture = {
		detail: 'Deleting your account will forfeit payouts',
		code: 'referral_forfeiture_confirmation_required',
		unpaid_count: 2,
		unpaid_total: '12.50',
		failed_total: '3.00',
		currency: 'EUR'
	};

	it('returns the forfeiture state and keeps cookies', async () => {
		resolvesWithError(409, forfeiture);
		const result = await run();
		expect(result).toMatchObject({
			status: 409,
			data: {
				forfeiture: {
					detail: forfeiture.detail,
					count: 2,
					total: '12.50',
					failed: '3.00',
					currency: 'EUR'
				}
			}
		});
		expect(cookies.delete).not.toHaveBeenCalled();
		expect(accountDeleteAccountConfirm.mock.calls[0][0].body).toEqual({ token: 'tok-123' });
	});

	it('sends force=true when the user confirmed, then clears the session', async () => {
		accountDeleteAccountConfirm.mockResolvedValue({
			data: { message: 'ok' },
			error: undefined,
			response: new Response(null, { status: 200 })
		});
		const result = await run({ force: 'true' });
		expect(accountDeleteAccountConfirm.mock.calls[0][0].body).toEqual({
			token: 'tok-123',
			force: true
		});
		expect(result).toMatchObject({ success: true });
		expect(cookies.delete).toHaveBeenCalledTimes(3);
	});

	it('does not treat an unrelated 409 as a forfeiture', async () => {
		resolvesWithError(409, { detail: 'Conflict', code: 'something_else' });
		const result = await run();
		expect(result).toMatchObject({ status: 500 });
		expect(result).not.toHaveProperty('data.forfeiture');
	});
});
