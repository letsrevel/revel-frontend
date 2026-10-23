import { test, expect } from '../../support/fixtures';
import {
	ALPHA_CANONICAL_ORIGIN,
	ALPHA_HOST,
	ALPHA_ORG_SLUG,
	tenantUnavailableReason
} from '../../support/tenant';

// Custom domains (#1056) — platform discovery links straight to the custom
// domain. Org payloads carry `custom_domain`, so cards built on the platform
// point at `https://{custom_domain}` (no port, by design). Assert the href and
// never click it: nothing listens on https://alpha.localhost.

test.describe('J30 platform discovery links @p1', () => {
	// eslint-disable-next-line no-empty-pattern
	test.beforeEach(async ({}, testInfo) => {
		const reason = await tenantUnavailableReason(ALPHA_HOST, { needsTenantMode: false });
		testInfo.skip(reason !== null, reason ?? '');
	});

	test('event cards of a custom-domain org link to its domain', async ({ page }) => {
		await page.goto('/events');

		const customDomainCards = page.locator(
			`a[href^="${ALPHA_CANONICAL_ORIGIN}/events/${ALPHA_ORG_SLUG}/"]`
		);
		await expect(customDomainCards.first()).toBeAttached();

		// None of that org's events may still link to the platform path.
		await expect(page.locator(`a[href^="/events/${ALPHA_ORG_SLUG}/"]`)).toHaveCount(0);
	});

	test('the organization list links to the custom domain', async ({ page }) => {
		await page.goto('/organizations');
		await expect(
			page.locator(`a[href^="${ALPHA_CANONICAL_ORIGIN}/org/${ALPHA_ORG_SLUG}"]`).first()
		).toBeAttached();
		await expect(page.locator(`a[href^="/org/${ALPHA_ORG_SLUG}"]`)).toHaveCount(0);
	});
});
