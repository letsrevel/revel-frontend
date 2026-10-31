import { describe, it, expect, vi } from 'vitest';

vi.mock('$lib/server/logger', () => ({
	log: { debug: vi.fn(), warning: vi.fn(), error: vi.fn() }
}));

import { load, actions } from './+page.server';

interface Opts {
	search?: string;
	signedIn?: boolean;
	refreshCookie?: boolean;
}

function loadArgs({ search = '', signedIn = false, refreshCookie = false }: Opts = {}) {
	const cookies = {
		set: vi.fn(),
		get: vi.fn((name: string) => (name === 'refresh_token' && refreshCookie ? 'rt' : undefined)),
		delete: vi.fn()
	};
	return {
		args: {
			url: new URL(`http://localhost:5173/logout${search}`),
			cookies,
			locals: signedIn ? { user: { id: 'u1' } } : {}
		} as unknown as Parameters<typeof load>[0],
		cookies
	};
}

async function runLoad(opts: Opts) {
	const { args, cookies } = loadArgs(opts);
	try {
		const data = await load(args);
		return { data, location: null as string | null, cookies };
	} catch (err) {
		const redirect = err as { status?: number; location?: string };
		if (redirect.status === 303 && typeof redirect.location === 'string') {
			return { data: null, location: redirect.location, cookies };
		}
		throw err;
	}
}

function postArgs(returnUrl?: string) {
	const body = new FormData();
	if (returnUrl !== undefined) body.set('returnUrl', returnUrl);
	const cookies = { set: vi.fn(), get: vi.fn(), delete: vi.fn() };
	return {
		args: {
			request: new Request('http://localhost:5173/logout', { method: 'POST', body }),
			cookies
		} as unknown as Parameters<NonNullable<typeof actions.default>>[0],
		cookies
	};
}

async function runPost(returnUrl?: string) {
	const { args, cookies } = postArgs(returnUrl);
	try {
		await actions.default(args);
	} catch (err) {
		const redirect = err as { status?: number; location?: string };
		if (redirect.status === 303 && typeof redirect.location === 'string') {
			return { location: redirect.location, cookies };
		}
		throw err;
	}
	throw new Error('action did not redirect');
}

describe('GET /logout', () => {
	it('never deletes cookies, signed in or out', async () => {
		for (const opts of [
			{ signedIn: true },
			{ signedIn: false },
			{ refreshCookie: true },
			{ signedIn: true, search: '?returnUrl=%2Fx' }
		]) {
			const { cookies } = await runLoad(opts);
			expect(cookies.delete).not.toHaveBeenCalled();
			expect(cookies.set).not.toHaveBeenCalled();
		}
	});

	it('redirects home when signed out', async () => {
		const { location } = await runLoad({});
		expect(location).toBe('/');
	});

	it('redirects a signed-out visitor to login with a safe returnUrl', async () => {
		const target = '/oauth/authorize?client_id=x&resource=a&resource=b';
		const { location } = await runLoad({ search: `?returnUrl=${encodeURIComponent(target)}` });
		expect(location).toBe(`/login?returnUrl=${encodeURIComponent(target)}`);
	});

	it('shows the confirmation page when signed in (locals.user)', async () => {
		const { data, location } = await runLoad({ signedIn: true });
		expect(location).toBeNull();
		expect(data).toEqual({ returnUrl: '' });
	});

	it('shows the confirmation page when only a refresh cookie is present', async () => {
		const { data } = await runLoad({ refreshCookie: true });
		expect(data).toEqual({ returnUrl: '' });
	});

	it('returns the safe returnUrl when signed in', async () => {
		const { data } = await runLoad({ signedIn: true, search: '?returnUrl=%2Fdashboard' });
		expect(data).toEqual({ returnUrl: '/dashboard' });
	});

	it.each(['https://evil.com', '//evil.com', '/\\evil.com', 'javascript:alert(1)', ''])(
		'drops an unsafe returnUrl (%s)',
		async (value) => {
			const q = `?returnUrl=${encodeURIComponent(value)}`;
			const signedIn = await runLoad({ signedIn: true, search: q });
			expect(signedIn.data).toEqual({ returnUrl: '' });
			const signedOut = await runLoad({ search: q });
			expect(signedOut.location).toBe('/');
		}
	);

	it('drops a tab-smuggled protocol-relative returnUrl', async () => {
		const { data } = await runLoad({ signedIn: true, search: '?returnUrl=%2F%09%2F%2Fevil' });
		expect(data).toEqual({ returnUrl: '' });
	});
});

describe('POST /logout', () => {
	it('clears all three cookies and goes home with no returnUrl', async () => {
		const { location, cookies } = await runPost();
		expect(location).toBe('/?logged_out=true');
		expect(cookies.delete).toHaveBeenCalledTimes(3);
		expect(cookies.delete).toHaveBeenCalledWith('access_token', { path: '/' });
		expect(cookies.delete).toHaveBeenCalledWith('refresh_token', { path: '/' });
		expect(cookies.delete).toHaveBeenCalledWith('remember_me', { path: '/' });
	});

	it('sends the user to login with a safe returnUrl (switch account)', async () => {
		const target = '/oauth/authorize?client_id=x&resource=a&resource=b';
		const { location, cookies } = await runPost(target);
		expect(location).toBe(`/login?returnUrl=${encodeURIComponent(target)}`);
		expect(cookies.delete).toHaveBeenCalledTimes(3);
	});

	it.each([
		'https://evil.com',
		'//evil.com',
		'/\\evil.com',
		'javascript:alert(1)',
		'',
		'/\t//evil'
	])('falls back to home for an unsafe or empty returnUrl (%s)', async (value) => {
		const { location, cookies } = await runPost(value);
		expect(location).toBe('/?logged_out=true');
		expect(cookies.delete).toHaveBeenCalledTimes(3);
	});
});
