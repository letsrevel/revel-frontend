import { test, expect } from '../../support/fixtures';
import {
	createTicketedEvent,
	createTicketTier,
	createVerifiedUser,
	deleteDefaultTier
} from '../../support/factories';
import { authenticateContext } from '../../support/session';
import { gotoHydrated, waitForClientAuth } from '../../support/navigation';

// J6.5 (USER_JOURNEYS.md) — offline-payment tier: reserve → ticket is PENDING
// with the organizer's manual payment instructions → staff confirms the
// payment in the event admin → ticket flips ACTIVE for the buyer.
//
// Isolation: API-arranged event + offline tier + throwaway buyer; the seeded
// offline tiers (Workshop Seat, Standing Room) stay untouched.

const INSTRUCTIONS = 'Wire the amount to IBAN AT12 3456 7890 within 5 days.';

test.describe('J6 offline payment @p2', () => {
	test('reserve → pending with instructions → staff confirms → active', async ({
		browser,
		asOwner
	}) => {
		const [event, buyer] = await Promise.all([
			createTicketedEvent({ freeTier: false }),
			createVerifiedUser('Offline')
		]);
		// The auto-created General Admission tier also renders "Reserve Ticket".
		await deleteDefaultTier(event.id);
		await createTicketTier(event.id, {
			name: 'Bank Transfer',
			payment_method: 'offline',
			price: '20.00',
			manual_payment_instructions: INSTRUCTIONS
		});

		const context = await browser.newContext();
		await authenticateContext(context, buyer);
		const page = await context.newPage();
		await gotoHydrated(page, event.path);
		await waitForClientAuth(page);

		// CTA → tier dialog → "Reserve Ticket" card button → confirm dialog →
		// "Reserve Ticket" confirm. Same idempotent-loop shape as
		// free-tier.spec.ts (clicks during dialog re-renders are occasionally
		// dropped); success signal is the auto-opened "Your Ticket" modal. The
		// card button and the confirm button share the name "Reserve Ticket" —
		// they're distinguished by their containing dialog.
		const tierDialog = page.getByRole('dialog', { name: 'Select Your Ticket' });
		const confirmDialog = page.getByRole('dialog', { name: 'Reserve Ticket' });
		const success = page.getByRole('dialog', { name: 'Your Ticket', exact: true });
		await expect(async () => {
			if (await success.isVisible()) return;
			if (await confirmDialog.isVisible()) {
				await confirmDialog.getByRole('button', { name: 'Reserve Ticket' }).click();
			} else if (await tierDialog.isVisible()) {
				await tierDialog.getByRole('button', { name: 'Reserve Ticket' }).click();
				await confirmDialog.getByRole('button', { name: 'Reserve Ticket' }).click();
			} else {
				await page.getByRole('button', { name: 'Get Tickets', exact: true }).click();
				await tierDialog.getByRole('button', { name: 'Reserve Ticket' }).click();
				await confirmDialog.getByRole('button', { name: 'Reserve Ticket' }).click();
			}
			await expect(success).toBeVisible({ timeout: 8_000 });
		}).toPass({ timeout: 60_000 });

		// The ticket modal shows the pending-payment banner with the organizer's
		// manual instructions.
		await expect(success.getByText('Your ticket is pending payment')).toBeVisible();
		await expect(success.getByText('Payment Instructions:')).toBeVisible();
		await expect(success.getByText(INSTRUCTIONS)).toBeVisible();

		// Staff side: the pending ticket has an inline "Confirm Payment" action.
		await gotoHydrated(asOwner, `/org/${event.orgSlug}/admin/events/${event.id}/tickets`);
		await waitForClientAuth(asOwner);
		const buyerRow = asOwner
			.locator('tr, article, li, div')
			.filter({ hasText: `${buyer.firstName} ${buyer.lastName}` })
			.filter({ hasText: /Pending/i })
			.first();
		await expect(buyerRow).toBeVisible({ timeout: 15_000 });
		await buyerRow.getByRole('button', { name: 'Confirm Payment' }).click();

		const confirmPayment = asOwner.getByRole('dialog', { name: 'Confirm Payment' });
		await expect(confirmPayment).toBeVisible({ timeout: 15_000 });
		await confirmPayment.getByRole('button', { name: 'Confirm Payment' }).click();
		await expect(confirmPayment).not.toBeVisible({ timeout: 15_000 });

		const activeRow = asOwner
			.locator('tr, article, li, div')
			.filter({ hasText: `${buyer.firstName} ${buyer.lastName}` })
			.filter({ hasText: /Active/i })
			.first();
		await expect(activeRow).toBeVisible({ timeout: 15_000 });

		// Buyer side: the dashboard ticket flipped to Active.
		const activeCard = page
			.locator('article, li, div')
			.filter({ hasText: event.name })
			.filter({ hasText: /Active/i })
			.first();
		await expect(async () => {
			await gotoHydrated(page, '/dashboard/tickets');
			await expect(activeCard).toBeVisible({ timeout: 5_000 });
		}).toPass({ timeout: 45_000 });

		await context.close();
	});
});
