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
			// The list is a table (<tr>, md and up) and a stack of cards (below md; the
			// card is the bordered `rounded-lg` div directly under the md:hidden wrapper).
			// Pick the visible holder container and require the badge INSIDE it.
			const holder = page
				.locator('tr, div.md\\:hidden > div.rounded-lg')
				.filter({ hasText: attendeeName })
				.filter({ visible: true });
			await expect(holder).toHaveCount(1, { timeout: 15_000 });
			const badge = holder.getByTestId('day-member-badge');
			await expect(badge).toBeVisible();
			await expect(badge).toHaveText('Day member');
		} finally {
			await context.close();
		}
	});
});
