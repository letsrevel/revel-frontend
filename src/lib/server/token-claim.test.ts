import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Cookies } from '@sveltejs/kit';

const eventClaim = vi.hoisted(() => vi.fn());
vi.mock('$lib/api/generated/sdk.gen', () => ({
	organizationClaimInvitation: vi.fn(),
	eventpublicdiscoveryClaimInvitation: eventClaim
}));

import {
	claimPendingTokens,
	dropClaimedEventToken,
	setClaimFlashCookie,
	type ClaimResults
} from './token-claim';

interface FakeCookies {
	cookies: Cookies;
	set: ReturnType<typeof vi.fn>;
	del: ReturnType<typeof vi.fn>;
}

function fakeCookies(values: Record<string, string>): FakeCookies {
	const set = vi.fn();
	const del = vi.fn();
	const cookies = {
		get: (name: string) => values[name],
		set,
		delete: del
	} as unknown as Cookies;
	return { cookies, set, del };
}

const fakeFetch = vi.fn() as unknown as typeof fetch;

describe('claimPendingTokens (event token)', () => {
	beforeEach(() => eventClaim.mockReset());

	it('records the claimed token and deletes the cookie with the attributes it was set with', async () => {
		eventClaim.mockResolvedValue({ response: { ok: true }, data: { name: 'Gala', slug: 'gala' } });
		const { cookies, del } = fakeCookies({ pending_event_token: 'et-1' });

		const results = await claimPendingTokens(cookies, 'acc', fakeFetch);

		expect(results.event).toMatchObject({ success: true, token: 'et-1', slug: 'gala' });
		expect(del).toHaveBeenCalledWith(
			'pending_event_token',
			expect.objectContaining({ path: '/', httpOnly: true, sameSite: 'lax' })
		);
	});

	it('records no token for a failed claim', async () => {
		eventClaim.mockResolvedValue({ response: { ok: false }, data: undefined });
		const { cookies } = fakeCookies({ pending_event_token: 'et-1' });

		const results = await claimPendingTokens(cookies, 'acc', fakeFetch);

		expect(results.event).toEqual({ type: 'event', success: false });
	});
});

describe('setClaimFlashCookie', () => {
	it('never puts the token id into the client-readable flash cookie', () => {
		const { cookies, set } = fakeCookies({});
		setClaimFlashCookie(cookies, {
			event: { type: 'event', success: true, name: 'Gala', slug: 'gala', token: 'et-secret' }
		});

		const encoded = set.mock.calls[0][1] as string;
		const decoded = Buffer.from(encoded, 'base64').toString();
		expect(decoded).toContain('gala');
		expect(decoded).not.toContain('et-secret');
	});
});

describe('dropClaimedEventToken', () => {
	const claimed: ClaimResults = {
		event: { type: 'event', success: true, token: 'et-1' }
	};

	it('removes the claimed ?et= and keeps the rest of the URL', () => {
		expect(dropClaimedEventToken('/events/acme/gala?et=et-1&tab=info#tickets', claimed)).toBe(
			'/events/acme/gala?tab=info#tickets'
		);
		expect(dropClaimedEventToken('/events/acme/gala?et=et-1', claimed)).toBe('/events/acme/gala');
	});

	it('keeps an ?et= for another token', () => {
		expect(dropClaimedEventToken('/events/acme/gala?et=et-2', claimed)).toBe(
			'/events/acme/gala?et=et-2'
		);
	});

	it('keeps the target when no event token was claimed', () => {
		const failed: ClaimResults = { event: { type: 'event', success: false } };
		expect(dropClaimedEventToken('/events/acme/gala?et=et-1', failed)).toBe(
			'/events/acme/gala?et=et-1'
		);
		expect(dropClaimedEventToken('/events/acme/gala?et=et-1', {})).toBe(
			'/events/acme/gala?et=et-1'
		);
	});

	it('keeps a target without ?et= as it is', () => {
		expect(dropClaimedEventToken('/dashboard', claimed)).toBe('/dashboard');
	});
});
