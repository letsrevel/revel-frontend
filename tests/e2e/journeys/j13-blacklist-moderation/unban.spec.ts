import { test, expect } from '../../support/fixtures';
import {
	addToBlacklist,
	approveMembershipRequest,
	createOrganization,
	createTicketedEvent,
	createVerifiedUser,
	requestMembership
} from '../../support/factories';
import { authenticateContext } from '../../support/session';
import { gotoHydrated, waitForClientAuth } from '../../support/navigation';

// J13 (USER_JOURNEYS.md) — unban: removing a hard blacklist entry restores
// the user's VISIBILITY of the org, but deliberately not their privileges —
// the backend flips the BANNED membership to CANCELLED (never back to
// ACTIVE), so re-joining takes a fresh membership request.
//
// Isolation: throwaway org, throwaway member-victim blacklisted by email
// (auto-links → membership BANNED → org/events 404 for them).

test.describe('J13 unban @p3', () => {
	test('remove blacklist entry → org visible again, membership Cancelled not Active', async ({
		browser
	}) => {
		test.setTimeout(180_000);

		const org = await createOrganization({ acceptMembershipRequests: true });
		const victim = await createVerifiedUser('Unban');
		const request = await requestMembership(victim, org.slug);
		await approveMembershipRequest(org.owner, org.slug, request.id, org.defaultTierId);
		const event = await createTicketedEvent({
			owner: org.owner,
			orgSlug: org.slug,
			freeTier: false,
			event: { requires_ticket: false }
		});
		await addToBlacklist(org.owner, org.slug, {
			email: victim.email,
			reason: 'E2E unban journey'
		});
		const victimName = `${victim.firstName} ${victim.lastName}`;

		// While banned: the org page is a 404 for the victim.
		const victimContext = await browser.newContext();
		await authenticateContext(victimContext, victim);
		const victimPage = await victimContext.newPage();
		const bannedResponse = await victimPage.goto(`/org/${org.slug}`);
		expect(bannedResponse?.status()).toBe(404);

		// The owner removes the entry through the blacklist page's detail modal.
		const ownerContext = await browser.newContext();
		await authenticateContext(ownerContext, org.owner);
		const ownerPage = await ownerContext.newPage();
		await gotoHydrated(ownerPage, `/org/${org.slug}/admin/blacklist`);
		await waitForClientAuth(ownerPage);
		// The org has exactly one entry — the victim's (linked by email).
		await ownerPage
			.getByRole('button', { name: /^Manage blacklist entry for / })
			.first()
			.click();
		const entryModal = ownerPage.getByRole('dialog', { name: /Blacklist Entry/ });
		await expect(entryModal).toBeVisible();
		await entryModal.getByRole('button', { name: 'Remove from Blacklist' }).click();
		await entryModal.getByRole('button', { name: 'Confirm Remove' }).click();
		await expect(entryModal).not.toBeVisible({ timeout: 15_000 });
		await expect(ownerPage.getByText('Removed from blacklist')).toBeVisible({ timeout: 15_000 });

		// Membership lands on CANCELLED — explicitly not reactivated (a member's
		// status is single-valued, so Cancelled on the card rules out Active).
		await gotoHydrated(ownerPage, `/org/${org.slug}/admin/members`);
		await waitForClientAuth(ownerPage);
		const memberCard = ownerPage
			.locator('article, li, div')
			.filter({ hasText: victimName })
			.filter({ hasText: /Cancelled/ })
			.first();
		await expect(memberCard).toBeVisible({ timeout: 15_000 });

		// Visibility returns for the victim: org page and event page load again
		// (the event greets them as an ordinary eligible visitor).
		await expect(async () => {
			const response = await victimPage.goto(`/org/${org.slug}`);
			expect(response?.status()).toBe(200);
		}).toPass({ timeout: 30_000 });
		await gotoHydrated(victimPage, event.path);
		await waitForClientAuth(victimPage);
		await expect(victimPage.getByRole('heading', { name: 'Will you attend?' })).toBeVisible({
			timeout: 15_000
		});

		await victimContext.close();
		await ownerContext.close();
	});
});
