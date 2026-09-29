import { test, expect } from '../../support/fixtures';
import { pageAs } from '../../support/session';
import { featureEnabled } from '../../support/skip';
import { authorizeUrl, newState, pkcePair } from '../../support/oauth';

// J28 (USER_JOURNEYS.md) — an authorization request the provider cannot trust
// (unknown client) renders an error screen on Revel and never redirects: an
// unverified redirect URI must not receive anything.

test.describe('J28 consent errors @p1', () => {
	test.beforeEach(async () => {
		test.skip(
			!(await featureEnabled('oauth_provider')),
			'OAuth provider is switched off on this backend'
		);
	});

	test('unknown client → error screen, no Allow, no redirect', async ({ browser }) => {
		const page = await pageAs(browser, 'user2');
		await page.goto(
			authorizeUrl({ clientId: 'not-a-client', state: newState(), challenge: pkcePair().challenge })
		);

		const headline = page.getByTestId('consent-error-headline');
		await expect(headline).toBeVisible();
		await expect(headline).not.toHaveText(/^\s*$/);
		await expect(page.getByRole('button', { name: 'Allow' })).toHaveCount(0);
		expect(new URL(page.url()).pathname).toBe('/oauth/authorize');
		// Stays put: no late navigation to the (untrusted) redirect URI.
		await expect
			.poll(() => new URL(page.url()).pathname, { timeout: 2_000 })
			.toBe('/oauth/authorize');
		await page.context().close();
	});
});
