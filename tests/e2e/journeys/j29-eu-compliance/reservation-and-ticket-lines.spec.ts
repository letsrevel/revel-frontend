import { test, expect, type Page } from '../../support/fixtures';
import { claimTicketViaApi, createVerifiedUser, type ThrowawayUser } from '../../support/factories';
import { pageAs } from '../../support/session';
import { gotoHydrated, waitForClientAuth } from '../../support/navigation';
import { complianceApi, fixtureEvent, fixtureTiers } from './helpers';
import type { Browser } from '@playwright/test';

// J29.5 / J29.6 (USER_JOURNEYS.md) — paying the organizer directly in Italy.
// The event page tells the buyer their Revel ticket is a reservation; the web
// ticket view renders the backend's `compliance_lines` (#1077), the same
// lines the PDF and wallet passes print. Each case uses its own throwaway
// buyer; the tickets it creates are the buyer's own and need no cleanup.

const RESERVATION_COPY =
	"You'll pay the organizer directly. Your Revel ticket is a reservation; the organizer gives you the fiscal ticket.";
const IT_RESERVATION =
	"Reservation only: this isn't a fiscal access ticket (titolo d'accesso). The organizer issues it.";

/** The buyer's ticket modal, opened from the dashboard. */
async function openTicket(page: Page): Promise<ReturnType<Page['getByRole']>> {
	await gotoHydrated(page, '/dashboard/tickets');
	await waitForClientAuth(page);
	await page.getByRole('button', { name: 'View ticket and QR code' }).first().click();
	const modal = page.getByRole('dialog', { name: 'Your Ticket', exact: true });
	await expect(modal).toBeVisible({ timeout: 15_000 });
	return modal;
}

function lineValue(modal: ReturnType<Page['getByRole']>, key: string) {
	return modal.getByTestId('ticket-compliance-lines').locator(`[data-key="${key}"] dd`);
}

async function buyerWithTicket(
	browser: Browser,
	tierName: string
): Promise<{ buyer: ThrowawayUser; page: Page; ticketId: string; eventId: string }> {
	const event = await fixtureEvent('compliance-it', 'it-club-night');
	const tier = (await fixtureTiers(event.id)).get(tierName);
	if (!tier) throw new Error(`fixture tier "${tierName}" is missing — reseed the backend`);
	const buyer = await createVerifiedUser('ItalyTicket');
	const ticket = await claimTicketViaApi(buyer, event.id, tier.id);
	const page = await pageAs(browser, buyer);
	return { buyer, page, ticketId: ticket.id, eventId: event.id };
}

test.describe('J29.5 / J29.6 reservations and ticket lines in Italy @p2', () => {
	test('the event page marks direct-payment tiers as reservations', async ({ browser }) => {
		const event = await fixtureEvent('compliance-it', 'it-club-night');
		const page = await pageAs(browser, await createVerifiedUser('ItalyBrowse'));
		try {
			await gotoHydrated(page, event.path);
			await waitForClientAuth(page);
			const notes = page.getByTestId('tier-reservation-note');
			// Door, Bank transfer and the offline PWYC tier — not the free or card tiers.
			await expect(notes).toHaveCount(3, { timeout: 15_000 });
			await expect(notes.first()).toHaveText(RESERVATION_COPY);
		} finally {
			await page.context().close();
		}
	});

	test('a door ticket lists every compliance line, numbered and marked a reservation', async ({
		browser
	}) => {
		const { page } = await buyerWithTicket(browser, 'Door');
		try {
			const modal = await openTicket(page);
			const keys = await modal
				.getByTestId('ticket-compliance-lines')
				.locator('[data-key]')
				.evaluateAll((els) => els.map((el) => el.getAttribute('data-key')));
			expect(keys).toEqual([
				'organizer',
				'tax_id',
				'ticket_number',
				'issued_at',
				'price',
				'notice',
				'it_reservation'
			]);
			await expect(lineValue(modal, 'organizer')).toHaveText('Compliance IT Legal Entity');
			await expect(lineValue(modal, 'tax_id')).toHaveText('IT12345678901');
			await expect(lineValue(modal, 'ticket_number')).toHaveText(/^COMPLIANCEIT-\d{6}$/);
			await expect(lineValue(modal, 'price')).toHaveText('EUR 10.00');
			await expect(lineValue(modal, 'notice')).toHaveText(
				'This ticket is not a tax invoice or receipt.'
			);
			await expect(lineValue(modal, 'it_reservation')).toHaveText(IT_RESERVATION);
		} finally {
			await page.context().close();
		}
	});

	test('a free ticket reads "Free" and is not a reservation', async ({ browser }) => {
		const { page } = await buyerWithTicket(browser, 'Free entry');
		try {
			const modal = await openTicket(page);
			await expect(lineValue(modal, 'price')).toHaveText('Free');
			await expect(lineValue(modal, 'it_reservation')).toHaveCount(0);
		} finally {
			await page.context().close();
		}
	});

	test('a bank-transfer ticket gets its number once the organizer confirms payment', async ({
		browser
	}) => {
		const { page, ticketId, eventId } = await buyerWithTicket(browser, 'Bank transfer');
		try {
			let modal = await openTicket(page);
			await expect(lineValue(modal, 'price')).toHaveText('EUR 15.00');
			await expect(lineValue(modal, 'ticket_number')).toHaveCount(0);
			await expect(lineValue(modal, 'issued_at')).toHaveCount(0);

			const owner = await complianceApi();
			await owner.post(`/api/event-admin/${eventId}/tickets/${ticketId}/confirm-payment`, {});

			modal = await openTicket(page);
			await expect(lineValue(modal, 'ticket_number')).toHaveText(/^COMPLIANCEIT-\d{6}$/);
			await expect(lineValue(modal, 'issued_at')).toHaveCount(1);
		} finally {
			await page.context().close();
		}
	});
});
