import { describe, it, expect } from 'vitest';
import { load } from './+page.server';

function loadArgs(search: string) {
	return {
		url: new URL(`http://localhost:5173/login/confirm-email${search}`)
	} as unknown as Parameters<typeof load>[0];
}

async function loadRedirect(search: string): Promise<string> {
	try {
		await load(loadArgs(search));
	} catch (err) {
		const redirect = err as { status?: number; location?: string };
		if (redirect.status === 303 && typeof redirect.location === 'string') return redirect.location;
		throw err;
	}
	throw new Error('load() did not redirect');
}

describe('/login/confirm-email forwards to /verify', () => {
	it('forwards the token only when there is no returnUrl (unchanged behaviour)', async () => {
		expect(await loadRedirect('?token=abc')).toBe('/verify?token=abc');
		expect(await loadRedirect('')).toBe('/verify');
	});

	it('forwards returnUrl once-encoded', async () => {
		const target = '/oauth/authorize?client_id=x&resource=a&resource=b';
		expect(await loadRedirect(`?token=abc&returnUrl=${encodeURIComponent(target)}`)).toBe(
			`/verify?token=abc&returnUrl=${encodeURIComponent(target)}`
		);
	});

	it('does not double-decode: /%2F%2Fevil stays /%2F%2Fevil', async () => {
		// The link carries returnUrl=%2F%252F%252Fevil (the backend quoted "/%2F%2Fevil" once).
		expect(await loadRedirect('?token=abc&returnUrl=%2F%252F%252Fevil')).toBe(
			'/verify?token=abc&returnUrl=%2F%252F%252Fevil'
		);
	});

	it('ignores returnUrl when the token is missing', async () => {
		expect(await loadRedirect('?returnUrl=%2Fx')).toBe('/verify');
	});
});
