import type { Locator, Page } from '@playwright/test';
import { test, expect } from '../../support/fixtures';
import {
	claimTicketViaApi,
	createOrganization,
	createTicketedEvent,
	createTicketTier,
	createVerifiedUser,
	type ThrowawayUser
} from '../../support/factories';
import { ApiClient } from '../../support/api';
import { authenticateContext } from '../../support/session';
import { gotoHydrated, waitForClientAuth } from '../../support/navigation';

// J10.15 / J25.4 (USER_JOURNEYS.md) — per-event revenue on the event admin
// Tickets page. TicketStats renders the whole-event aggregate from
// GET /event-admin/{id}/tickets/revenue ("Total earned": Gross / Refunds /
// Net / Net taxable / VAT, plus "Sold: n" and — once anything was refunded —
// "Refunded: n" / "Net: n"), independently of the page-local stat grid.
//
// No Stripe: an OFFLINE €20 tier. Offline tickets start PENDING and only count
// as sold once staff confirm the payment — two are confirmed via API, the third
// through the row's Confirm Payment action, which must refresh the card live.
//
// Offline refunds: the backend tracks them (POST …/mark-refunded, or cancel
// with `refund_amount`), but the admin Cancel Ticket dialog only offers its
// refund section when the refund-context endpoint reports something
// refundable, and `build_refund_context` hard-codes 0 for non-ONLINE tiers —
// so there is no UI path to record an offline refund today. The refund is
// therefore ARRANGED via API; the journey under test is the figures.
//
// Money figures asserted are the VAT-independent ones (Gross, Refunds): Net /
// Net taxable / VAT depend on the org's VAT setup. The org is a throwaway, so
// the aggregate covers exactly the tickets this test created.

const PRICE = '20.00';

/** The "Total earned" card (deepest container with its title and figures). */
function revenueCard(page: Page): Locator {
	return page
		.locator('div')
		.filter({ has: page.getByText('Total earned', { exact: true }) })
		.filter({ has: page.locator('dl') })
		.last();
}

/** A money figure in the card, by its <dt> label. */
function figure(card: Locator, label: string): Locator {
	return card
		.locator('dl > div')
		.filter({ has: card.page().locator('dt', { hasText: new RegExp(`^${label}$`) }) })
		.locator('dd');
}

async function confirmPayment(owner: ThrowawayUser, eventId: string, ticketId: string) {
	const api = await ApiClient.login(owner.email, owner.password);
	await api.post(`/api/event-admin/${eventId}/tickets/${ticketId}/confirm-payment`);
}

/** Record a manual (offline) refund, which also cancels the ticket. */
async function markRefunded(
	owner: ThrowawayUser,
	eventId: string,
	ticketId: string,
	amount: string
) {
	const api = await ApiClient.login(owner.email, owner.password);
	await api.post(`/api/event-admin/${eventId}/tickets/${ticketId}/mark-refunded`, {
		refund_amount: amount
	});
}

test.describe('J10 per-event revenue stats @p2', () => {
	test('confirmed offline sales and a manual refund roll into Total earned', async ({
		browser
	}) => {
		test.setTimeout(150_000);

		const org = await createOrganization();
		const event = await createTicketedEvent({
			owner: org.owner,
			orgSlug: org.slug,
			freeTier: false
		});
		const tier = await createTicketTier(
			event.id,
			{ name: 'Door Tier', payment_method: 'offline', price: PRICE },
			org.owner
		);
		const buyers = await Promise.all([
			createVerifiedUser('RevenueA'),
			createVerifiedUser('RevenueB'),
			createVerifiedUser('RevenueC')
		]);
		const tickets = await Promise.all(
			buyers.map((buyer) => claimTicketViaApi(buyer, event.id, tier.id))
		);

		const context = await browser.newContext();
		await authenticateContext(context, org.owner);
		const page = await context.newPage();
		const ticketsPath = `/org/${org.slug}/admin/events/${event.id}/tickets`;
		const names = buyers.map((b) => `${b.firstName} ${b.lastName}`);
		try {
			// Unpaid reservations earn nothing: no revenue card yet.
			await gotoHydrated(page, ticketsPath);
			await waitForClientAuth(page);
			await expect(page.getByRole('heading', { name: 'Manage Tickets' })).toBeVisible();
			await expect(page.getByText(names[0]).filter({ visible: true })).not.toHaveCount(0, {
				timeout: 15_000
			});
			await expect(page.getByText('Total earned', { exact: true })).toHaveCount(0);

			// Two offline payments confirmed → two sales.
			await confirmPayment(org.owner, event.id, tickets[0].id);
			await confirmPayment(org.owner, event.id, tickets[1].id);
			await gotoHydrated(page, ticketsPath);
			await waitForClientAuth(page);
			const card = revenueCard(page);
			await expect(card).toBeVisible({ timeout: 15_000 });
			await expect(figure(card, 'Gross')).toHaveText('€40.00');
			await expect(figure(card, 'Refunds')).toHaveText('€0.00');
			await expect(card.getByText('Sold: 2', { exact: true })).toBeVisible();
			await expect(card.getByText(/^Refunded: /)).toHaveCount(0);

			// The third payment is confirmed through the row action.
			const pendingRow = page
				.locator('tr, article, li, div')
				.filter({ hasText: names[2] })
				.filter({ hasNot: page.getByText(names[0]) })
				.filter({ hasNot: page.getByText(names[1]) })
				.filter({ has: page.getByRole('button', { name: 'Confirm Payment' }) })
				.filter({ visible: true })
				.first();
			await pendingRow.getByRole('button', { name: 'Confirm Payment' }).first().click();
			const confirmDialog = page.getByRole('dialog', { name: 'Confirm Payment' });
			await confirmDialog.getByRole('button', { name: 'Confirm Payment' }).click();
			await expect(confirmDialog).toBeHidden({ timeout: 15_000 });
			await expect(figure(revenueCard(page), 'Gross')).toHaveText('€60.00', { timeout: 15_000 });
			await expect(revenueCard(page).getByText('Sold: 3', { exact: true })).toBeVisible();

			// A partial manual refund on one offline ticket (arranged via API — the
			// admin Cancel dialog offers no refund for offline tickets, see header).
			// The aggregate keeps the sale and tracks the refund on top of it.
			await markRefunded(org.owner, event.id, tickets[0].id, '5.00');
			await expect(async () => {
				await gotoHydrated(page, ticketsPath);
				await expect(figure(revenueCard(page), 'Refunds')).toHaveText('€5.00', {
					timeout: 5_000
				});
			}).toPass({ timeout: 30_000 });
			const after = revenueCard(page);
			await expect(figure(after, 'Gross')).toHaveText('€60.00');
			await expect(after.getByText('Sold: 3', { exact: true })).toBeVisible();
			await expect(after.getByText('Refunded: 1', { exact: true })).toBeVisible();
			await expect(after.getByText('Net: 2', { exact: true })).toBeVisible();
		} finally {
			await context.close();
		}
	});
});
