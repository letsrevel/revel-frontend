import { test, expect } from '../../support/fixtures';
import { createVerifiedUser } from '../../support/factories';
import { gotoHydrated, waitForClientAuth } from '../../support/navigation';
import {
	TENANT_HOST,
	TENANT_RSVP_EVENT_PATH,
	TENANT_ORIGIN,
	tenantPage,
	tenantUnavailableReason
} from '../../support/tenant';

// Custom domains (#1056) — an attendee RSVPs to the seeded RSVP-only event of
// the tenant org (`tenant-rsvp-event`), end to end on `tenant.localhost`.
//
// Arrange via API: a throwaway verified attendee, so the spec is re-runnable
// against the one shared seeded event. The attendee's session is planted for the tenant host (cookies are host-only); the event page is then
// driven entirely through the UI on that host.

test.describe('J30 attendee flow on a tenant host @p1', () => {
	// eslint-disable-next-line no-empty-pattern
	test.beforeEach(async ({}, testInfo) => {
		const reason = await tenantUnavailableReason(TENANT_HOST, { needsTenantMode: true });
		testInfo.skip(reason !== null, reason ?? '');
	});

	test('RSVP yes to a tenant event on the custom domain', async ({ browser }) => {
		const attendee = await createVerifiedUser('TenantAttendee');

		const page = await tenantPage(browser, TENANT_ORIGIN, attendee);
		await gotoHydrated(page, TENANT_RSVP_EVENT_PATH);
		await waitForClientAuth(page);
		expect(new URL(page.url()).host).toBe(new URL(TENANT_ORIGIN).host);

		// Tenant chrome, not the platform's, around the event page.
		await expect(page.getByRole('heading', { level: 1 }).first()).toBeVisible();
		await expect(page.getByRole('contentinfo')).toContainText('Powered by');

		await page.getByRole('button', { name: /^RSVP Yes/ }).click();
		// Events that accept RSVP notes ask for confirmation first; this one does not,
		// but tolerate the dialog rather than depend on the event defaults.
		const confirm = page
			.getByRole('dialog', { name: 'Confirm your RSVP' })
			.getByRole('button', { name: /^RSVP (Yes|Maybe|No)$/ });
		if (await confirm.isVisible({ timeout: 2_000 }).catch(() => false)) await confirm.click();
		await expect(page.getByRole('status').filter({ hasText: "You're attending" })).toBeVisible();

		// Persisted server-side, and still on the tenant host after a reload.
		await page.reload();
		await expect(page.getByRole('status').filter({ hasText: "You're attending" })).toBeVisible();
		expect(new URL(page.url()).host).toBe(new URL(TENANT_ORIGIN).host);

		await page.context().close();
	});
});
