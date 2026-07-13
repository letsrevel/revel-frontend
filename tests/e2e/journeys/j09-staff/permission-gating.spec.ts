import type { Page } from '@playwright/test';
import { test, expect } from '../../support/fixtures';
import {
	addStaff,
	approveMembershipRequest,
	createOrganization,
	createVerifiedUser,
	requestMembership,
	setStaffPermissions
} from '../../support/factories';
import { authenticateContext } from '../../support/session';
import { gotoHydrated, waitForClientAuth } from '../../support/navigation';

// J9 (USER_JOURNEYS.md) — staff permission gating. A staff member with a
// narrow permission map sees exactly the allowed admin surfaces:
// - owner-only nav items (Billing, Financials) are hidden and their direct
//   URLs render the 403 error page;
// - permission-driven affordances (Create Event) appear only once the owner
//   grants the underlying permission;
// - non-staff users can't reach the admin area at all.
//
// Per-EVENT permission overrides exist in the backend PermissionsSchema but
// have no frontend editing UI yet — tracked as a follow-up issue, not
// asserted here.
//
// Isolation: throwaway-owned org; staff + outsider are throwaway users.

/** The admin nav is a sidebar on desktop and behind a toggle on mobile. */
async function openAdminNav(page: Page): Promise<ReturnType<Page['getByRole']>> {
	const desktopNav = page.getByRole('navigation', { name: 'Admin navigation' });
	if (await desktopNav.isVisible()) {
		return desktopNav;
	}
	// Both the global header and the admin layout render a toggle with this
	// label on mobile — the admin one lives inside <main>.
	await page.getByRole('main').getByRole('button', { name: 'Toggle navigation menu' }).click();
	const mobileNav = page.getByRole('navigation', { name: 'Mobile admin navigation' });
	await expect(mobileNav).toBeVisible();
	return mobileNav;
}

test.describe('J9 permission gating @p2', () => {
	test('staff sees only permitted surfaces; owner grant unlocks them', async ({ browser }) => {
		test.setTimeout(180_000);

		const org = await createOrganization({ acceptMembershipRequests: true });
		const [staffUser, outsider] = await Promise.all([
			createVerifiedUser('NarrowStaff'),
			createVerifiedUser('Outsider')
		]);
		const request = await requestMembership(staffUser, org.slug);
		await approveMembershipRequest(org.owner, org.slug, request.id, org.defaultTierId);
		// Narrow permission set: nothing beyond the default view permission.
		const staffUserId = await addStaff(org.owner, org.slug, staffUser.email, {
			create_event: false,
			manage_event: false,
			manage_members: false,
			edit_organization: false
		});

		const context = await browser.newContext();
		await authenticateContext(context, staffUser);
		const page = await context.newPage();

		// The staff member reaches the admin area…
		await gotoHydrated(page, `/org/${org.slug}/admin`);
		await waitForClientAuth(page);
		await expect(page.getByText('Staff', { exact: true }).first()).toBeVisible();

		// …but the owner-only nav items aren't offered.
		const nav = await openAdminNav(page);
		await expect(nav.getByRole('link', { name: 'Events', exact: true })).toBeVisible();
		await expect(nav.getByRole('link', { name: 'Billing' })).toBeHidden();
		await expect(nav.getByRole('link', { name: 'Financials' })).toBeHidden();

		// Direct URLs to owner-only pages render the 403 error page.
		for (const path of ['financials', 'billing', 'billing/invoices']) {
			await page.goto(`/org/${org.slug}/admin/${path}`);
			await expect(page.getByRole('heading', { name: 'Access Denied' })).toBeVisible();
		}

		// create_event=false: no Create Event button, and the wizard URL is
		// server-blocked too.
		await gotoHydrated(page, `/org/${org.slug}/admin/events`);
		await waitForClientAuth(page);
		await expect(page.getByRole('heading', { name: 'Events', level: 1 })).toBeVisible();
		await expect(page.getByRole('button', { name: 'Create Event' })).toBeHidden();
		await page.goto(`/org/${org.slug}/admin/events/new`);
		await expect(page.getByRole('heading', { name: 'Access Denied' })).toBeVisible();

		// The owner grants create_event → the surface unlocks.
		await setStaffPermissions(org.owner, org.slug, staffUserId, { create_event: true });
		await gotoHydrated(page, `/org/${org.slug}/admin/events`);
		await waitForClientAuth(page);
		await expect(page.getByRole('button', { name: 'Create Event' }).first()).toBeVisible();
		await page.goto(`/org/${org.slug}/admin/events/new`);
		await expect(page.getByRole('heading', { name: 'Access Denied' })).toBeHidden();

		await context.close();

		// A non-staff user can't reach the admin area at all — the backend hides
		// the admin org resource from outsiders, so the page 404s rather than 403s.
		const outsiderContext = await browser.newContext();
		await authenticateContext(outsiderContext, outsider);
		const outsiderPage = await outsiderContext.newPage();
		await outsiderPage.goto(`/org/${org.slug}/admin`);
		await expect(outsiderPage.getByRole('heading', { name: 'Page Not Found' })).toBeVisible();
		await outsiderContext.close();
	});

	test('the owner sees the owner-only nav items', async ({ browser }) => {
		const org = await createOrganization();

		const context = await browser.newContext();
		await authenticateContext(context, org.owner);
		const page = await context.newPage();

		await gotoHydrated(page, `/org/${org.slug}/admin`);
		await waitForClientAuth(page);
		const nav = await openAdminNav(page);
		await expect(nav.getByRole('link', { name: 'Billing' })).toBeVisible();
		await expect(nav.getByRole('link', { name: 'Financials' })).toBeVisible();

		await context.close();
	});
});
