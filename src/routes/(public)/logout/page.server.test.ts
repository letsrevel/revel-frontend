import { describe, it, expect, vi } from 'vitest';

vi.mock('$lib/server/logger', () => ({
	log: { debug: vi.fn(), warning: vi.fn(), error: vi.fn() }
}));

import { load } from './+page.server';

function loadArgs(search: string) {
	const cookies = { set: vi.fn(), get: vi.fn(), delete: vi.fn() };
	return {
		args: {
			url: new URL(`http://localhost:5173/logout${search}`),
			cookies
		} as unknown as Parameters<typeof load>[0],
		cookies
	};
}

async function loadRedirect(
	search: string
): Promise<{ location: string; cookies: { delete: ReturnType<typeof vi.fn> } }> {
	const { args, cookies } = loadArgs(search);
	try {
		await load(args);
	} catch (err) {
		const redirect = err as { status?: number; location?: string };
		if (redirect.status === 303 && typeof redirect.location === 'string') {
			return { location: redirect.location, cookies };
		}
		throw err;
	}
	throw new Error('load() did not redirect');
}

describe('/logout', () => {
	it('keeps redirecting home without a returnUrl', async () => {
		const { location, cookies } = await loadRedirect('');
		expect(location).toBe('/?logged_out=true');
		expect(cookies.delete).toHaveBeenCalledWith('access_token', { path: '/' });
		expect(cookies.delete).toHaveBeenCalledWith('refresh_token', { path: '/' });
		expect(cookies.delete).toHaveBeenCalledWith('remember_me', { path: '/' });
	});

	it('sends the user to login with a safe returnUrl (switch account)', async () => {
		const target = '/oauth/authorize?client_id=x&resource=a&resource=b';
		const { location, cookies } = await loadRedirect(`?returnUrl=${encodeURIComponent(target)}`);
		expect(location).toBe(`/login?returnUrl=${encodeURIComponent(target)}`);
		expect(cookies.delete).toHaveBeenCalledTimes(3);
	});

	it.each(['https://evil.com', '//evil.com', '/\\evil.com', ''])(
		'falls back to home for an unsafe or empty returnUrl (%s)',
		async (value) => {
			const { location } = await loadRedirect(`?returnUrl=${encodeURIComponent(value)}`);
			expect(location).toBe('/?logged_out=true');
		}
	);

	it('falls back to home for a tab-smuggled protocol-relative returnUrl (/\\t//evil)', async () => {
		const { location } = await loadRedirect('?returnUrl=%2F%09%2F%2Fevil');
		expect(location).toBe('/?logged_out=true');
	});
});
