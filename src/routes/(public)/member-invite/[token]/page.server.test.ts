import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('$lib/api/generated/sdk.gen', () => ({
	memberregisterinvitesPreviewInvite: vi.fn(),
	memberregisterinvitesClaimInvite: vi.fn()
}));
vi.mock('$lib/server/logger', () => ({
	log: { warning: vi.fn(), error: vi.fn(), debug: vi.fn(), info: vi.fn() }
}));
vi.mock('$lib/seo/server', () => ({ resolveLang: vi.fn(() => 'de') }));

import {
	memberregisterinvitesPreviewInvite as previewSdk,
	memberregisterinvitesClaimInvite as claimSdk
} from '$lib/api/generated/sdk.gen';
import { load, actions } from './+page.server';

const preview = vi.mocked(previewSdk);
const claim = vi.mocked(claimSdk);

function event(signedIn: boolean): never {
	return {
		params: { token: 'tok' },
		fetch: globalThis.fetch,
		request: new Request('https://letsrevel.io/member-invite/tok'),
		locals: { user: signedIn ? { id: 'u1', accessToken: 'jwt' } : undefined }
	} as never;
}

function respond(mock: typeof preview | typeof claim, status: number, body?: unknown): void {
	mock.mockResolvedValue({
		data: status === 200 ? body : undefined,
		error: status === 200 ? undefined : body,
		response: { status }
	} as never);
}

describe('member-invite load (#1171)', () => {
	beforeEach(() => vi.clearAllMocks());

	it('previews without an Authorization header, even when signed in', async () => {
		respond(preview, 200, {
			organization_name: 'Verein X',
			organization_slug: 'verein-x',
			full_name: 'Ada L'
		});
		const result = (await load(event(true))) as Awaited<ReturnType<typeof load>>;
		const call = preview.mock.calls[0][0];
		expect(call?.headers).not.toHaveProperty('Authorization');
		expect(call?.headers).toEqual({ 'Accept-Language': 'de' });
		expect(result).toMatchObject({
			token: 'tok',
			signedIn: true,
			preview: { status: 'ok', organizationName: 'Verein X', fullName: 'Ada L' }
		});
	});

	it.each([
		[404, 'not_found'],
		[429, 'throttled'],
		[500, 'error']
	])('maps %s to %s', async (status, expected) => {
		respond(preview, status, { detail: 'x' });
		const result = (await load(event(false))) as { preview: { status: string } };
		expect(result.preview.status).toBe(expected);
	});

	it('maps a thrown network error to error, not a 500 page', async () => {
		preview.mockRejectedValue(new Error('down'));
		const result = (await load(event(false))) as { preview: { status: string } };
		expect(result.preview.status).toBe('error');
	});

	it('never claims on load', async () => {
		respond(preview, 404, { detail: 'x' });
		await load(event(true));
		expect(claim).not.toHaveBeenCalled();
	});
});

describe('member-invite claim action (#1171)', () => {
	beforeEach(() => vi.clearAllMocks());

	it('sends nothing without a session', async () => {
		const res = await actions.default(event(false));
		expect(res.claim).toEqual({ outcome: 'unauthenticated' });
		expect(claim).not.toHaveBeenCalled();
	});

	it('claims with the bearer token and returns the org slug', async () => {
		respond(claim, 200, { organization_slug: 'verein-x', record_id: 'r1' });
		const res = await actions.default(event(true));
		expect(claim.mock.calls[0][0]?.headers).toMatchObject({ Authorization: 'Bearer jwt' });
		expect(res.claim).toEqual({
			outcome: 'success',
			organizationSlug: 'verein-x',
			recordId: 'r1'
		});
	});

	it('passes the 409 detail through verbatim (no text branching)', async () => {
		respond(claim, 409, { detail: 'Server sentence' });
		expect((await actions.default(event(true))).claim).toEqual({
			outcome: 'conflict',
			detail: 'Server sentence'
		});
	});

	it('uses a null detail when a 409 has no readable body', async () => {
		respond(claim, 409, undefined);
		expect((await actions.default(event(true))).claim).toEqual({
			outcome: 'conflict',
			detail: null
		});
	});

	it.each([
		[403, 'forbidden'],
		[404, 'not_found'],
		[429, 'throttled'],
		[401, 'unauthenticated'],
		[502, 'error']
	])('maps %s to %s', async (status, outcome) => {
		respond(claim, status, { detail: 'x' });
		expect((await actions.default(event(true))).claim).toEqual({ outcome });
	});

	it('maps a thrown network error to error', async () => {
		claim.mockRejectedValue(new Error('down'));
		expect((await actions.default(event(true))).claim).toEqual({ outcome: 'error' });
	});
});
