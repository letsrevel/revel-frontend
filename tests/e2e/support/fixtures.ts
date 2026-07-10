import { test as base, expect, type Browser, type Page } from '@playwright/test';
import { obtainTokenPair } from './api';
import { PERSONAS, type PersonaName } from './personas';
import { isBackendUp, BACKEND_DOWN_MESSAGE } from './skip';

/**
 * Shared test object for journey specs.
 *
 * - Journey specs import { test, expect } from here (regression specs use plain
 *   @playwright/test — they don't need a backend).
 * - Every test auto-skips when the backend probe fails.
 * - Persona fixtures (`asOwner`, `asMember`, …) hand the spec a Page already
 *   authenticated as the corresponding bootstrap-seeded user.
 *
 * Each persona fixture performs its own API login (~100ms) and plants the
 * fresh token pair as the app's auth cookies. Deliberately NOT a shared
 * storageState file: the client bootstraps its in-memory store via
 * /api/auth/refresh, which ROTATES the refresh token and blacklists the old
 * one — two parallel contexts sharing a refresh token race, and the loser is
 * silently logged out mid-test. A fresh pair per context makes rotation local
 * to that context. (Multiple token pairs per user coexist happily.)
 */

const APP_HOST = 'localhost';

function authCookie(name: string, value: string) {
	return {
		name,
		value,
		domain: APP_HOST,
		path: '/',
		expires: Math.round(Date.now() / 1000) + 60 * 60 * 24 * 7,
		httpOnly: true,
		secure: false,
		sameSite: 'Lax' as const
	};
}

interface PersonaFixtures {
	asOwner: Page;
	asStaff: Page;
	asMember: Page;
	asUser: Page;
	asMultiOrg: Page;
	asBetaOwner: Page;
	asTestAdmin: Page;
	asTestMember: Page;
}

function personaFixture(name: PersonaName) {
	return async ({ browser }: { browser: Browser }, use: (page: Page) => Promise<void>) => {
		const persona = PERSONAS[name];
		const { access, refresh } = await obtainTokenPair(persona.email, persona.password);
		const context = await browser.newContext();
		await context.addCookies([
			authCookie('access_token', access),
			authCookie('refresh_token', refresh),
			// 'true' → hooks.server.ts refreshes with persistent cookie options.
			authCookie('remember_me', 'true')
		]);
		const page = await context.newPage();
		await use(page);
		await context.close();
	};
}

export const test = base.extend<PersonaFixtures & { _backendGuard: void }>({
	_backendGuard: [
		// eslint-disable-next-line no-empty-pattern
		async ({}, use, testInfo) => {
			if (!(await isBackendUp())) {
				testInfo.skip(true, BACKEND_DOWN_MESSAGE);
			}
			await use();
		},
		{ auto: true }
	],
	asOwner: personaFixture('owner'),
	asStaff: personaFixture('staff'),
	asMember: personaFixture('member'),
	asUser: personaFixture('user'),
	asMultiOrg: personaFixture('multiOrg'),
	asBetaOwner: personaFixture('betaOwner'),
	asTestAdmin: personaFixture('testAdmin'),
	asTestMember: personaFixture('testMember')
});

export { expect, PERSONAS };
