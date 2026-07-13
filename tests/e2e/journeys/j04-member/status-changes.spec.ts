import { test, expect } from '../../support/fixtures';
import {
	approveMembershipRequest,
	createOrganization,
	createTicketedEvent,
	createVerifiedUser,
	requestMembership,
	setMemberStatus
} from '../../support/factories';
import { authenticateContext } from '../../support/session';
import { gotoHydrated, waitForClientAuth } from '../../support/navigation';

// J4 (USER_JOURNEYS.md) — membership status changes: pausing a member
// degrades their access to members-only content; reactivating restores it.
//
// Isolation: throwaway-owned org with an arranged ACTIVE member and a
// members-only (non-ticketed) event. Status flips happen via the org-admin
// API (the admin UI for it is covered by j08 member-management); the journey
// under test here is what the MEMBER experiences on each side of the flip.

test.describe('J4 membership status changes @p2', () => {
	test('paused member loses members-only access, reactivation restores it', async ({ browser }) => {
		test.setTimeout(120_000);

		const org = await createOrganization({ acceptMembershipRequests: true });
		const member = await createVerifiedUser('PausedMember');
		const request = await requestMembership(member, org.slug);
		await approveMembershipRequest(org.owner, org.slug, request.id, org.defaultTierId);
		const event = await createTicketedEvent({
			owner: org.owner,
			orgSlug: org.slug,
			freeTier: false,
			event: { event_type: 'members-only', requires_ticket: false }
		});

		const context = await browser.newContext();
		await authenticateContext(context, member);
		const page = await context.newPage();

		// ACTIVE: the member gets the RSVP ask on the members-only event.
		await gotoHydrated(page, event.path);
		await waitForClientAuth(page);
		await expect(page.getByRole('heading', { name: 'Will you attend?' })).toBeVisible();

		// Pause → the eligibility gate flips to the inactive-membership message
		// (the backend reason string renders as the gate header) and the RSVP
		// affordance disappears.
		await setMemberStatus(org.owner, org.slug, member.email, 'paused');
		await gotoHydrated(page, event.path);
		await waitForClientAuth(page);
		// The gate renders twice (desktop sidebar + mobile flow); only one copy
		// is visible per viewport.
		await expect(
			page.getByText('Your membership is not active.').filter({ visible: true })
		).toBeVisible();
		await expect(page.getByRole('heading', { name: 'Will you attend?' })).toBeHidden();
		await expect(page.getByRole('button', { name: /^RSVP Yes/ })).toBeHidden();

		// The org profile reflects the paused state instead of offering a
		// membership request.
		await gotoHydrated(page, `/org/${org.slug}`);
		await waitForClientAuth(page);
		await expect(page.getByText('Paused', { exact: true })).toBeVisible();

		// Reactivate → access is restored.
		await setMemberStatus(org.owner, org.slug, member.email, 'active');
		await gotoHydrated(page, event.path);
		await waitForClientAuth(page);
		await expect(page.getByRole('heading', { name: 'Will you attend?' })).toBeVisible();

		await context.close();
	});
});
