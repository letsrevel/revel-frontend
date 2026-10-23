import { test, expect } from '../../support/fixtures';
import {
	PAID_ORG_SLUG,
	FRONTEND_ORIGIN,
	TENANT_CANONICAL_ORIGIN,
	TENANT_HOST,
	TENANT_ORG_SLUG,
	TENANT_ORIGIN,
	hostRequest,
	tenantPage,
	tenantUnavailableReason
} from '../../support/tenant';

// Custom domains (#1056) — route scoping and canonical redirects.
//
// Redirect assertions use raw HTTP (`hostRequest`: Host header, no redirect
// following) so status + Location are checked verbatim and no navigation ever
// leaves the host under test. `/events` is the exception: on a tenant host it
// is the org's own event list, driven through a real browser navigation.

test.describe('J30 tenant route scoping @p1', () => {
	// eslint-disable-next-line no-empty-pattern
	test.beforeEach(async ({}, testInfo) => {
		const reason = await tenantUnavailableReason(TENANT_HOST, { needsTenantMode: true });
		testInfo.skip(reason !== null, reason ?? '');
	});

	for (const path of ['/organizations', `/org/${PAID_ORG_SLUG}`, '/referral']) {
		test(`${path} on the tenant host redirects to /`, async () => {
			const response = await hostRequest(TENANT_HOST, path);
			expect(response.status).toBe(302);
			expect(response.location).toBe('/');
		});
	}

	test('/events on the tenant host lists only the tenant org events', async ({ browser }) => {
		const page = await tenantPage(browser, TENANT_ORIGIN);
		await page.goto('/events');
		await expect(page).toHaveURL(`${TENANT_ORIGIN}/events`);
		const links = page.locator('a[href*="/events/"]');
		await expect(links.first()).toBeVisible({ timeout: 15_000 });
		const hrefs = await links.evaluateAll((as) => as.map((a) => a.getAttribute('href') ?? ''));
		for (const href of hrefs.filter((h) => /\/events\/[^/?]+\/[^/?]+/.test(h))) {
			expect(href, 'event links stay on the tenant org').toContain(`/events/${TENANT_ORG_SLUG}/`);
		}
		await page.context().close();
	});

	for (const path of [`/org/${TENANT_ORG_SLUG}/admin`, '/create-org', '/account/developer-apps']) {
		test(`${path} on the tenant host redirects to the platform origin`, async () => {
			const response = await hostRequest(TENANT_HOST, `${path}?x=1`);
			expect(response.status).toBe(302);
			expect(response.location).toBe(`${FRONTEND_ORIGIN}${path}?x=1`);
		});
	}

	test('an unknown host gets a 404', async () => {
		const response = await hostRequest('nope.localhost', '/');
		expect(response.status).toBe(404);
	});
});

test.describe('J30 canonical redirect from the platform @p1', () => {
	// Platform-host behaviour: driven by the org's custom_domain alone, so it
	// needs the backend seed but not tenant mode on the frontend.
	// eslint-disable-next-line no-empty-pattern
	test.beforeEach(async ({}, testInfo) => {
		const reason = await tenantUnavailableReason(TENANT_HOST, { needsTenantMode: false });
		testInfo.skip(reason !== null, reason ?? '');
	});

	test('the platform 301s an org page to its custom domain, keeping the query', async () => {
		const response = await hostRequest(null, `/org/${TENANT_ORG_SLUG}?payment_success=1`);
		expect(response.status).toBe(301);
		// Origin comes from PUBLIC_CUSTOM_DOMAIN_URL_TEMPLATE (http://{hostname}:5173 in e2e).
		expect(response.location).toBe(
			`${TENANT_CANONICAL_ORIGIN}/org/${TENANT_ORG_SLUG}?payment_success=1`
		);
	});

	test('embeds are never redirected (they are iframed on third-party sites)', async () => {
		const response = await hostRequest(null, `/embed/${TENANT_ORG_SLUG}`);
		expect(response.status).toBe(200);
		expect(response.location).toBeNull();
	});
});
