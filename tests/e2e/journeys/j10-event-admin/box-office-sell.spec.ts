import crypto from 'node:crypto';
import type { Page } from '@playwright/test';
import { test, expect } from '../../support/fixtures';
import {
	createCategoryPricedVenue,
	createTicketedEvent,
	createTicketTier,
	deleteDefaultTier,
	uniqueEmail,
	type CreatedEvent
} from '../../support/factories';
import { gotoHydrated, waitForClientAuth } from '../../support/navigation';

// J19.7 / J10.5 (USER_JOURNEYS.md) + the #663 box-office contract — the
// event-admin Seating page's "Sell at the door" tab (BoxOfficeSellPanel):
//
// 1. DOOR SALE: the owner picks a free seat painted with a price category,
//    picks the seated tier, types a walk-up recipient (email get-or-create
//    guest) and issues the ticket "At the door". Before issuing, the panel shows
//    door staff the amount to collect (the seat's CATEGORY price, #958); after,
//    it echoes the recorded amount with the issued seat + recipient, and the
//    seat re-renders SOLD. The ticket then appears on
//    Manage Tickets as ACTIVE with the seat readback, and the amount recorded
//    for the sale is the seat's CATEGORY price (backend stamps price_paid on a
//    category-priced door sale, spec §5.8) — read back both on the row and in
//    the check-in dialog door staff see. Its payment reads "Door sale" (the
//    ticket's sale_source, #959), not the tier's "At the Door".
//
// 2. COMP: same flow with "Comp (free)" — the panel quotes nothing to collect,
//    the ticket is ACTIVE, its recorded amount is 0 (rendered "Free"), never
//    the tier/category price, and its payment reads "Comp" (#959).
//
// Isolation: own event on Org Alpha (owner persona / asOwner) at its own
// createCategoryPricedVenue (row A painted with a fresh category, row B
// unpainted). The tier is at_the_door user_choice priced 20.00 base / 55.00
// for the painted category, so a row-A door sale must record 55.00.

const CATEGORY_PRICE = '€55.00';
const COMP_AMOUNT = 'Free / comp — nothing to collect';

/**
 * One ticket's container: the desktop table row, or the mobile card (both
 * render; only one is visible per project). Scoped tightly on purpose — a
 * looser ancestor would also contain the revenue stats, which include the
 * door sale's 55.00 and would poison the comp row's negative assertion.
 */
const TICKET_ROW = 'tr, div.rounded-lg.border.bg-card';

/** A per-run token so the recipient's surname is searchable without collisions. */
function surname(label: string): string {
	return `${label}${crypto.randomBytes(3).toString('hex')}`;
}

async function arrangeSeatedEvent(): Promise<{ event: CreatedEvent; tierName: string }> {
	const venue = await createCategoryPricedVenue('revel-events-collective');
	const event = await createTicketedEvent({
		freeTier: false,
		event: {
			venue_id: venue.venueId,
			require_ticket_names: false,
			// Open the check-in window so the dialog's Check In action is live.
			check_in_starts_at: new Date(Date.now() - 60 * 60 * 1000).toISOString()
		}
	});
	await deleteDefaultTier(event.id);
	const tier = await createTicketTier(event.id, {
		name: 'Door Seats',
		payment_method: 'at_the_door',
		price: '20.00',
		seat_assignment_mode: 'user_choice',
		venue_id: venue.venueId,
		sector_id: venue.sectorId,
		category_prices: { [venue.category.id]: '55.00' }
	});
	return { event, tierName: tier.name };
}

/** Open the Seating page on the "Sell at the door" tab. */
async function openBoxOffice(page: Page, event: CreatedEvent): Promise<void> {
	await gotoHydrated(page, `/org/${event.orgSlug}/admin/events/${event.id}/seating`);
	await waitForClientAuth(page);
	await page.getByRole('tab', { name: 'Sell at the door' }).click();
	await expect(page.getByRole('radiogroup', { name: 'Choose a seat' })).toBeVisible({
		timeout: 20_000
	});
}

/**
 * Fill and submit the sale form. The seat radio sits in a scroll region under
 * the sticky app header, so it is selected by keyboard (focus + Space), which
 * never hit-tests — same reasoning as seat-overrides.spec.ts.
 */
async function sell(
	page: Page,
	opts: {
		seat: string;
		tierName: string;
		email: string;
		firstName: string;
		lastName: string;
		payment: 'At the door' | 'Comp (free)';
		/** What the panel must quote as the amount to collect. */
		expectedAmount: string;
	}
): Promise<void> {
	const seat = page.getByRole('radio', { name: `Seat ${opts.seat}`, exact: true });
	await expect(seat).toBeEnabled({ timeout: 20_000 });
	await seat.focus();
	await seat.press(' ');
	await expect(seat).toBeChecked();

	const tierSelect = page.getByLabel('2. Ticket tier');
	await expect(tierSelect).toBeEnabled();
	await tierSelect.selectOption({ label: opts.tierName });

	await page.getByLabel(/^Recipient email/).fill(opts.email);
	await page.getByLabel('First name (optional)').fill(opts.firstName);
	await page.getByLabel('Last name (optional)').fill(opts.lastName);
	await page.getByRole('radio', { name: opts.payment }).check();

	// Door staff see the amount to collect before issuing (#958).
	await expect(page.getByTestId('box-office-amount')).toContainText(opts.expectedAmount);

	await page.getByRole('button', { name: 'Issue ticket' }).click();
}

/** Manage Tickets, narrowed to one recipient by a NAME search. */
async function openTicketsFilteredBy(page: Page, event: CreatedEvent, name: string) {
	await gotoHydrated(page, `/org/${event.orgSlug}/admin/events/${event.id}/tickets`);
	await waitForClientAuth(page);
	await expect(page.getByRole('heading', { name: 'Manage Tickets' })).toBeVisible();
	await page.getByPlaceholder('Search by holder, purchaser, email, or tier...').fill(name);
	await expect(page).toHaveURL(new RegExp(`search=${encodeURIComponent(name)}`), {
		timeout: 15_000
	});
}

test.describe('J10 box office door sale & comp @p2', () => {
	test('door sale records the seat category price; comp records free', async ({ asOwner }) => {
		test.setTimeout(180_000);
		const { event, tierName } = await arrangeSeatedEvent();
		const page = asOwner;

		// --- Door sale on painted seat A1 ---------------------------------
		const doorLast = surname('Walkup');
		await openBoxOffice(page, event);
		await sell(page, {
			seat: 'A1',
			tierName,
			email: uniqueEmail('walkup'),
			firstName: 'Door',
			lastName: doorLast,
			payment: 'At the door',
			expectedAmount: CATEGORY_PRICE
		});

		// Result box names the seat and the (freshly created guest) recipient.
		await expect(page.getByRole('heading', { name: 'Ticket issued' })).toBeVisible({
			timeout: 15_000
		});
		await expect(page.getByText(`Seat A1 — Door ${doorLast}`)).toBeVisible();
		await expect(page.getByTestId('box-office-result-amount')).toHaveText(
			`Recorded: ${CATEGORY_PRICE}`
		);
		// Availability refetched: the seat is no longer sellable.
		await expect(page.getByRole('radio', { name: 'Seat A1, sold' })).toBeDisabled({
			timeout: 15_000
		});

		// --- Comp on seat A2 (same painted category) -----------------------
		const compLast = surname('Gratis');
		await sell(page, {
			seat: 'A2',
			tierName,
			email: uniqueEmail('gratis'),
			firstName: 'Guest',
			lastName: compLast,
			payment: 'Comp (free)',
			expectedAmount: COMP_AMOUNT
		});
		await expect(page.getByText(`Seat A2 — Guest ${compLast}`)).toBeVisible({ timeout: 15_000 });
		await expect(page.getByTestId('box-office-result-amount')).toHaveText(
			`Recorded: ${COMP_AMOUNT}`
		);
		await expect(page.getByRole('radio', { name: 'Seat A2, sold' })).toBeDisabled({
			timeout: 15_000
		});

		// --- Readback: the door sale is ACTIVE, seated, and recorded at 55.00
		await openTicketsFilteredBy(page, event, doorLast);
		const doorRow = page
			.locator(TICKET_ROW)
			.filter({ hasText: `Door ${doorLast}` })
			.filter({ visible: true })
			.first();
		await expect(doorRow).toBeVisible({ timeout: 15_000 });
		await expect(doorRow).toContainText('Active');
		await expect(doorRow).toContainText('Row A • Seat 1');
		await expect(doorRow).toContainText(CATEGORY_PRICE);
		await expect(doorRow).toContainText('Door sale');
		// The comp recipient is filtered out by the name search.
		await expect(page.getByText(`Guest ${compLast}`).filter({ visible: true })).toHaveCount(0);

		await doorRow.getByRole('button', { name: 'Check In', exact: true }).click();
		const doorDialog = page.getByRole('dialog', { name: 'Check In Attendee' });
		await expect(doorDialog).toBeVisible({ timeout: 10_000 });
		await expect(doorDialog).toContainText('Row A • Seat 1');
		await expect(doorDialog).toContainText(CATEGORY_PRICE);
		await expect(doorDialog).toContainText('Door sale');
		await expect(doorDialog).not.toContainText('At the Door');
		await doorDialog.getByRole('button', { name: 'Cancel' }).click();
		await expect(doorDialog).toBeHidden();

		// --- Readback: the comp is ACTIVE and recorded free (0), not 55.00 --
		await openTicketsFilteredBy(page, event, compLast);
		const compRow = page
			.locator(TICKET_ROW)
			.filter({ hasText: `Guest ${compLast}` })
			.filter({ visible: true })
			.first();
		await expect(compRow).toBeVisible({ timeout: 15_000 });
		await expect(compRow).toContainText('Active');
		await expect(compRow).toContainText('Row A • Seat 2');
		await expect(compRow).toContainText('Free');
		await expect(compRow).not.toContainText(CATEGORY_PRICE);
		await expect(compRow).toContainText('Comp');
		await expect(compRow).not.toContainText('At the Door');

		await compRow.getByRole('button', { name: 'Check In', exact: true }).click();
		const compDialog = page.getByRole('dialog', { name: 'Check In Attendee' });
		await expect(compDialog).toBeVisible({ timeout: 10_000 });
		await expect(compDialog).toContainText('Row A • Seat 2');
		await expect(compDialog).toContainText('Free');
		await expect(compDialog).not.toContainText(CATEGORY_PRICE);
		await expect(compDialog).toContainText('Comp');
		await expect(compDialog).not.toContainText('At the Door');
	});
});
