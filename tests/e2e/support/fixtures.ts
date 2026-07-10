import { test as base, expect, type Browser, type Page } from '@playwright/test';
import { PERSONAS, type PersonaName } from './personas';
import { authenticateContext } from './session';
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
		const context = await browser.newContext();
		await authenticateContext(context, name);
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
