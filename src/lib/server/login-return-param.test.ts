import { describe, it, expect } from 'vitest';

/**
 * Codebase guard for #914.
 *
 * The login/register actions read the post-auth target from `?returnUrl=` only
 * (`safeReturnUrl`, see `routes/(public)/login/+page.server.ts`). A link that
 * passes `?redirect=` to /login is silently ignored and the user lands on the
 * dashboard instead of back where they started. Thirteen call sites had drifted
 * onto `?redirect=` before this guard existed.
 *
 * `?redirect=` on the account profile/settings pages is legitimate (those pages
 * read it themselves) and does not match: the pattern requires the login route
 * immediately before the query string.
 */

// `/login?redirect=` and `resolve('/(public)/login', {})}?redirect=`
const LOGIN_WITH_REDIRECT_PARAM = /\/login(?:['"`],\s*\{\}\)\})?\?redirect=/;

const sources = import.meta.glob<string>(
	['/src/**/*.svelte', '/src/**/*.ts', '!/src/lib/api/generated/**', '!/src/**/*.test.ts'],
	{ query: '?raw', import: 'default', eager: true }
);

describe('login links carry ?returnUrl=, never ?redirect=', () => {
	it('the pattern catches both the raw and the resolve() spelling', () => {
		expect(LOGIN_WITH_REDIRECT_PARAM.test('`/login?redirect=${x}`')).toBe(true);
		expect(
			LOGIN_WITH_REDIRECT_PARAM.test("`${resolve('/(public)/login', {})}?redirect=${x}`")
		).toBe(true);
		expect(LOGIN_WITH_REDIRECT_PARAM.test('`/login?returnUrl=${x}`')).toBe(false);
		expect(
			LOGIN_WITH_REDIRECT_PARAM.test("`${resolve('/(auth)/account/settings', {})}?redirect=${x}`")
		).toBe(false);
	});

	it('scans a non-trivial number of source files', () => {
		// Guards against the glob silently matching nothing (a vacuous pass).
		expect(Object.keys(sources).length).toBeGreaterThan(100);
	});

	it('no source file sends ?redirect= to /login', () => {
		const offenders = Object.entries(sources)
			.filter(([, content]) => LOGIN_WITH_REDIRECT_PARAM.test(content))
			.map(([file]) => file);
		expect(offenders).toEqual([]);
	});
});
