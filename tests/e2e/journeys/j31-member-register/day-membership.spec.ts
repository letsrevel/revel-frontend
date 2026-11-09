import { test, expect } from '../../support/fixtures';
import {
	claimTicketViaApi,
	createOrganization,
	createTicketedEvent,
	createTicketTier,
	createVerifiedUser
} from '../../support/factories';
import { authenticateContext } from '../../support/session';
import { gotoHydrated, waitForClientAuth } from '../../support/navigation';
import {
	createDayMembershipTier,
	listRegisterEntries,
	registerEntry,
	registerPath
} from '../../support/member-register';

// FE #1167 (BE#1317): a ticket tier can GRANT a day membership. Taking such a
// ticket writes a `temporary` register entry for the event; the attendee does
// not become a regular member. Staff see it in the register and as a
// "Day member" badge on the event's ticket list.

test.describe('J31 day membership from a ticket @p1', () => {
	test('a free ticket that grants a day membership creates a register entry and a ticket badge', async ({
		browser
	}) => {
		test.setTimeout(180_000);
		const org = await createOrganization({ publicVisibility: true });
		const dayTier = await createDayMembershipTier(org.owner, org.slug, 'Day member E2E');
		const event = await createTicketedEvent({
			owner: org.owner,
			orgSlug: org.slug,
			freeTier: false
		});
		const ticketTier = await createTicketTier(
			event.id,
			{
				name: 'Public day ticket',
				payment_method: 'free',
				price: '0.00',
				grants_membership_tier_id: dayTier.id,
				max_tickets_per_user: 1
			},
			org.owner
		);
		const attendee = await createVerifiedUser('DayMember');
		const attendeeName = `${attendee.firstName} ${attendee.lastName}`;
		await claimTicketViaApi(attendee, event.id, ticketTier.id);

		const entries = await listRegisterEntries(org.owner, org.slug, 'kind=temporary');
		expect(entries).toHaveLength(1);
		expect(entries[0]).toMatchObject({ kind: 'temporary', source: 'ticket', event_id: event.id });

		const context = await browser.newContext();
		await authenticateContext(context, org.owner);
		const page = await context.newPage();
		try {
			// Register: a Day membership entry sourced from the ticket.
			await gotoHydrated(page, `${registerPath(org.slug)}?kind=temporary`);
			await waitForClientAuth(page);
			const entry = registerEntry(page, attendeeName);
			await expect(entry).toBeVisible({ timeout: 15_000 });
			await expect(entry.getByTestId('register-badge-day-member')).toBeVisible();
			await expect(entry.getByText('Ticket', { exact: true })).toBeVisible();

			// Staff ticket list: the holder carries the "Day member" badge.
			await gotoHydrated(page, `/org/${org.slug}/admin/events/${event.id}/tickets`);
			await waitForClientAuth(page);
			// The list is a table on desktop and plain-div cards on mobile, so match the
			// smallest container that holds both the holder and the badge.
			const badge = page.getByTestId('day-member-badge').filter({ visible: true });
			await expect(badge).toBeVisible({ timeout: 15_000 });
			await expect(badge).toHaveText('Day member');
			await expect(
				page
					.locator('tr, article, li, div')
					.filter({ hasText: attendeeName })
					.filter({ has: page.getByTestId('day-member-badge') })
					.filter({ visible: true })
					.first()
			).toBeVisible();
		} finally {
			await context.close();
		}
	});
});
