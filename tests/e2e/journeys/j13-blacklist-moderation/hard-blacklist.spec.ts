import { test, expect } from '../../support/fixtures';
import {
	addStaff,
	addToBlacklist,
	approveMembershipRequest,
	createOrganization,
	createTicketedEvent,
	createVerifiedUser,
	requestMembership
} from '../../support/factories';
import { authenticateContext } from '../../support/session';
import { gotoHydrated, waitForClientAuth } from '../../support/navigation';

// J13 (USER_JOURNEYS.md) — hard blacklist consequences. Blacklisting a user
// who is an active STAFF MEMBER strips their staff role, flips their
// membership to BANNED, and blocks their event access — all applied
// atomically by the backend's post_save signal when the entry links to the
// account (matching email).
//
// Isolation: throwaway-owned org, throwaway member-then-staff victim.

test.describe('J13 hard blacklist @p2', () => {
	test('blacklisted staff member is stripped, banned, and blocked from events', async ({
		browser
	}) => {
		test.setTimeout(150_000);

		const org = await createOrganization({ acceptMembershipRequests: true });
		const victim = await createVerifiedUser('Banned');
		const request = await requestMembership(victim, org.slug);
		await approveMembershipRequest(org.owner, org.slug, request.id, org.defaultTierId);
		await addStaff(org.owner, org.slug, victim.email);
		const event = await createTicketedEvent({
			owner: org.owner,
			orgSlug: org.slug,
			freeTier: false,
			event: { requires_ticket: false }
		});
		const victimName = `${victim.firstName} ${victim.lastName}`;

		// Sanity: as staff, the victim can access the org admin and the event.
		const victimContext = await browser.newContext();
		await authenticateContext(victimContext, victim);
		const victimPage = await victimContext.newPage();
		await gotoHydrated(victimPage, event.path);
		await waitForClientAuth(victimPage);
		await expect(victimPage.getByRole('heading', { name: 'Will you attend?' })).toBeVisible();

		// The owner blacklists them by email (auto-links to the account).
		await addToBlacklist(org.owner, org.slug, {
			email: victim.email,
			reason: 'E2E hard-blacklist journey'
		});

		// Owner's admin view: no staff left, membership shows Banned.
		const ownerContext = await browser.newContext();
		await authenticateContext(ownerContext, org.owner);
		const ownerPage = await ownerContext.newPage();
		await gotoHydrated(ownerPage, `/org/${org.slug}/admin/members`);
		await waitForClientAuth(ownerPage);
		await ownerPage.getByRole('tab', { name: /^Staff/ }).click();
		await expect(ownerPage.getByText('No staff members found')).toBeVisible({ timeout: 15_000 });
		await ownerPage.getByRole('tab', { name: /^Members/ }).click();
		const memberCard = ownerPage
			.locator('article, li, div')
			.filter({ hasText: victimName })
			.filter({ hasText: /Banned/ })
			.first();
		await expect(memberCard).toBeVisible({ timeout: 15_000 });

		// The banned user's event access is gone outright — hard-blacklisting
		// hides the org's events entirely: direct URL → 404.
		const bannedResponse = await victimPage.goto(event.path);
		expect(bannedResponse?.status()).toBe(404);
		await expect(victimPage.getByRole('heading', { name: 'Page Not Found' })).toBeVisible();

		await victimContext.close();
		await ownerContext.close();
	});
});
