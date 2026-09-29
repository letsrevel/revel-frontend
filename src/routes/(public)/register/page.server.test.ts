import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('$lib/api/generated/sdk.gen', () => ({
	accountRegister: vi.fn(),
	referralGetInvitation: vi.fn()
}));
vi.mock('$lib/server/features', () => ({
	getDemoMode: vi.fn().mockResolvedValue(false),
	getSsoProviders: vi.fn().mockResolvedValue([])
}));
vi.mock('$lib/server/logger', () => ({
	log: { debug: vi.fn(), warning: vi.fn(), error: vi.fn() }
}));

import { accountRegister } from '$lib/api/generated/sdk.gen';
import { actions } from './+page.server';

const mockedRegister = vi.mocked(accountRegister);
const PASSWORD = 'Str0ng!Passw0rd-e2e';

function actionArgs(search: string) {
	const formData = new FormData();
	formData.set('email', 'new@example.com');
	formData.set('password', PASSWORD);
	formData.set('confirmPassword', PASSWORD);
	formData.set('acceptTerms', 'on');
	const url = new URL(`http://localhost:5173/register${search}`);
	return {
		request: new Request(url, { method: 'POST', body: formData }),
		fetch: vi.fn(),
		url
	} as unknown as Parameters<typeof actions.default>[0];
}

/** Run the action and return the thrown redirect. */
async function actionRedirect(search: string): Promise<{ status: number; location: string }> {
	try {
		await actions.default(actionArgs(search));
	} catch (err) {
		const redirect = err as { status?: number; location?: string };
		if (typeof redirect.status === 'number' && typeof redirect.location === 'string') {
			return { status: redirect.status, location: redirect.location };
		}
		throw err;
	}
	throw new Error('action did not redirect');
}

beforeEach(() => {
	mockedRegister.mockReset();
	mockedRegister.mockResolvedValue({
		data: { message: 'ok' },
		error: undefined,
		response: { ok: true, status: 201 }
	} as never);
});

describe('register action and returnUrl', () => {
	it('sends return_url and carries returnUrl to the check-email page', async () => {
		const target = '/oauth/authorize?client_id=x&resource=a&resource=b';
		const redirect = await actionRedirect(`?returnUrl=${encodeURIComponent(target)}`);

		expect(mockedRegister).toHaveBeenCalledWith(
			expect.objectContaining({ body: expect.objectContaining({ return_url: target }) })
		);
		expect(redirect).toEqual({
			status: 303,
			location: `/register/check-email?email=new%40example.com&returnUrl=${encodeURIComponent(target)}`
		});
	});

	it('omits return_url and the query when there is no returnUrl', async () => {
		const redirect = await actionRedirect('');

		const body = mockedRegister.mock.calls[0]?.[0]?.body as Record<string, unknown>;
		expect(body).not.toHaveProperty('return_url');
		expect(redirect).toEqual({
			status: 303,
			location: '/register/check-email?email=new%40example.com'
		});
	});

	it.each([
		['absolute', 'https://evil.com'],
		['protocol-relative', '//evil.com'],
		['whitespace', '/a b'],
		['over-long', '/' + 'x'.repeat(2048)]
	])('drops an unsafe returnUrl (%s) and still registers', async (_label, value) => {
		const redirect = await actionRedirect(`?returnUrl=${encodeURIComponent(value)}`);

		const body = mockedRegister.mock.calls[0]?.[0]?.body as Record<string, unknown>;
		expect(body).not.toHaveProperty('return_url');
		expect(redirect.location).toBe('/register/check-email?email=new%40example.com');
	});
});
