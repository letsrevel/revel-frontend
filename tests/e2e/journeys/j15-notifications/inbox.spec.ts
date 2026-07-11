import { test, expect } from '../../support/fixtures';
import {
	approveMembershipRequest,
	createOrganization,
	createTicketedEvent,
	createVerifiedUser,
	inviteToEvent,
	requestMembership
} from '../../support/factories';
import { authenticateContext } from '../../support/session';
import { gotoHydrated, waitForClientAuth } from '../../support/navigation';

// J15 (USER_JOURNEYS.md) — in-app inbox: a direct invitation raises the
// bell's unread badge, the dropdown lists it, the full page marks it
// read/unread, an API-approved membership request lands its notification
// (regression: BE #673 — the approval notification used to die on missing
// context keys), and mark-all clears the badge.
//
// Isolation: throwaway user — seeded personas accumulate notifications from
// other suites, making unread counts meaningless. The membership approval is
// arranged MID-test so the exact "1 unread" badge assertion still holds at
// the start.

test.describe('J15 inbox @p1', () => {
	test('bell badge, dropdown, mark read/unread, approval notification, mark all', async ({
		browser
	}) => {
		test.setTimeout(180_000);
		const [user, event, org] = await Promise.all([
			createVerifiedUser('Inboxer'),
			createTicketedEvent({ freeTier: false }),
			createOrganization({ acceptMembershipRequests: true })
		]);
		// The post_save signal raises INVITATION_RECEIVED synchronously.
		await inviteToEvent(event.id, [user.email]);

		const context = await browser.newContext();
		await authenticateContext(context, user);
		const page = await context.newPage();

		await gotoHydrated(page, '/dashboard');
		await waitForClientAuth(page);

		// Exactly one unread: the invitation (fresh account, nothing else).
		await expect(page.getByRole('status', { name: '1 unread notification' })).toBeVisible({
			timeout: 15_000
		});

		// The bell dropdown lists it and links to the full page.
		await page.getByRole('button', { name: 'Open notifications' }).click();
		await expect(page.getByText(`You're invited to ${event.name}`)).toBeVisible();
		await page.getByRole('menuitem', { name: 'View all notifications' }).click();
		await page.waitForURL(/\/account\/notifications/);
		await expect(page.getByRole('heading', { name: 'Notifications' })).toBeVisible();

		// Mark read → the card flips state and the badge clears; mark unread
		// brings both back (the mutations invalidate the unread-count query).
		await page.getByRole('button', { name: 'Mark as read' }).click();
		await expect(page.getByRole('button', { name: 'Mark as unread' })).toBeVisible({
			timeout: 15_000
		});
		await expect(page.getByRole('status', { name: /unread notification/ })).toBeHidden();
		await page.getByRole('button', { name: 'Mark as unread' }).click();
		await expect(page.getByRole('status', { name: '1 unread notification' })).toBeVisible({
			timeout: 15_000
		});

		// An approved membership request notifies the applicant in-app (#673).
		const request = await requestMembership(user, org.slug, 'E2E inbox membership');
		await approveMembershipRequest(org.owner, org.slug, request.id, org.defaultTierId);
		await gotoHydrated(page, '/account/notifications');
		await waitForClientAuth(page);
		await expect(page.getByText(`Membership Request Approved: ${org.name}`)).toBeVisible({
			timeout: 15_000
		});

		// Mark all as read — toast confirms, no per-card unread actions remain,
		// and the badge is gone.
		await page.getByRole('button', { name: 'Mark all as read' }).click();
		await expect(page.getByText('All notifications marked as read')).toBeVisible({
			timeout: 15_000
		});
		await expect(page.getByRole('button', { name: 'Mark as read' })).toHaveCount(0);
		await expect(page.getByRole('status', { name: /unread notification/ })).toBeHidden();

		await context.close();
	});
});
