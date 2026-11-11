import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as m from '$lib/paraglide/messages.js';

const verify = vi.hoisted(() => vi.fn());
vi.mock('$lib/api/generated/sdk.gen', () => ({ organizationadmincoreVerifyContactEmail: verify }));

import { load } from './+page.server';

function run(): ReturnType<typeof load> {
	return load({
		params: { slug: 'acme' },
		url: new URL('http://localhost/org/acme/verify-contact-email?token=t'),
		locals: { user: { id: 'u' } },
		cookies: { get: () => 'access' }
	} as unknown as Parameters<typeof load>[0]);
}

function rejectWith(error: unknown, status = 400): void {
	verify.mockResolvedValue({
		data: undefined,
		error,
		response: new Response(null, { status })
	});
}

beforeEach(() => verify.mockReset());

describe('org verify-contact-email typed link-token errors (BE #1373)', () => {
	it('shows the expired copy for code token_expired', async () => {
		rejectWith({ detail: 'Token has expired.', code: 'token_expired' });
		expect(await run()).toMatchObject({
			success: false,
			error: m['serverErrors.public.verificationTokenExpired']()
		});
	});

	it('shows the invalid copy for code invalid_token', async () => {
		rejectWith({ detail: 'Invalid token.', code: 'invalid_token' });
		expect(await run()).toMatchObject({
			success: false,
			error: m['serverErrors.public.verificationTokenInvalid']()
		});
	});

	it('shows the backend detail for a code-less 400 (organization mismatch)', async () => {
		rejectWith({ detail: 'This token was issued for another organization.' });
		expect(await run()).toMatchObject({
			success: false,
			error: 'This token was issued for another organization.'
		});
	});

	it('shows a localized message, not the transport error, when the network fails', async () => {
		verify.mockResolvedValue({
			data: undefined,
			error: new TypeError('fetch failed'),
			response: undefined
		});
		const result = await run();
		expect(result).toMatchObject({
			success: false,
			error: m['serverErrors.public.unexpectedErrorRetry']()
		});
	});

	it('reports success with the organization name', async () => {
		verify.mockResolvedValue({
			data: { name: 'Acme' },
			error: undefined,
			response: new Response(null, { status: 200 })
		});
		expect(await run()).toMatchObject({ success: true, organizationName: 'Acme' });
	});
});
