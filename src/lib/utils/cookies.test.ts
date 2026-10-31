import { describe, it, expect, vi } from 'vitest';

vi.mock('$app/environment', () => ({ dev: false }));

import { getClientCookieOptions } from './cookies';

describe('getClientCookieOptions', () => {
	it('is client-readable, secure outside dev, lax, with optional maxAge', () => {
		expect(getClientCookieOptions(60)).toEqual({
			path: '/',
			httpOnly: false,
			secure: true,
			sameSite: 'lax',
			maxAge: 60
		});
		expect(getClientCookieOptions()).not.toHaveProperty('maxAge');
	});
});
