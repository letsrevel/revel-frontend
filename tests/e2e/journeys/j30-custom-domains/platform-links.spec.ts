import { test, expect } from '../../support/fixtures';
import {
	PAID_CANONICAL_ORIGIN,
	PAID_HOST,
	PAID_ORG_SLUG,
	tenantUnavailableReason
} from '../../support/tenant';

// Custom domains (#1056) — platform discovery links straight to the custom
// domain. Org payloads carry `custom_domain`, so cards built on the platform
// point at the origin from PUBLIC_CUSTOM_DOMAIN_URL_TEMPLATE (the e2e web server
// uses `http://{hostname}:5173`, so the links are followable).

test.describe('J30 platform discovery links @p1', () => {
	// eslint-disable-next-line no-empty-pattern
	test.beforeEach(async ({}, testInfo) => {
		const reason = await tenantUnavailableReason(PAID_HOST, { needsTenantMode: false });
		testInfo.skip(reason !== null, reason ?? '');
	});

	test('event cards of a custom-domain org link to its domain', async ({ page }) => {
		await page.goto('/events');

		const customDomainCards = page.locator(
			`a[href^="${PAID_CANONICAL_ORIGIN}/events/${PAID_ORG_SLUG}/"]`
		);
		await expect(customDomainCards.first()).toBeAttached();

		// None of that org's events may still link to the platform path.
		await expect(page.locator(`a[href^="/events/${PAID_ORG_SLUG}/"]`)).toHaveCount(0);
	});

	test('the organization list links to the custom domain', async ({ page }) => {
		await page.goto('/organizations');
		await expect(
			page.locator(`a[href^="${PAID_CANONICAL_ORIGIN}/org/${PAID_ORG_SLUG}"]`).first()
		).toBeAttached();
		await expect(page.locator(`a[href^="/org/${PAID_ORG_SLUG}"]`)).toHaveCount(0);
	});

	test('following an org-list link lands on the rendered tenant host', async ({
		page
	}, testInfo) => {
		const reason = await tenantUnavailableReason(PAID_HOST, { needsTenantMode: true });
		testInfo.skip(reason !== null, reason ?? '');

		await page.goto('/organizations');
		const link = page.locator(`a[href^="${PAID_CANONICAL_ORIGIN}/org/${PAID_ORG_SLUG}"]`).first();
		await expect(link).toBeAttached();
		await page.goto((await link.getAttribute('href')) ?? '');

		// The tenant serves its org at / (the /org/<slug> path redirects there).
		await expect(page).toHaveURL(`${PAID_CANONICAL_ORIGIN}/`);
		await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
		await expect(page.getByRole('contentinfo')).toContainText('Powered by');
	});
});
