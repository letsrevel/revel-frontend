import { test, expect } from '../../support/fixtures';
import {
	createTicketedEvent,
	createTicketTier,
	createVerifiedUser,
	deleteDefaultTier
} from '../../support/factories';
import { authenticateContext } from '../../support/session';
import { gotoHydrated, waitForClientAuth } from '../../support/navigation';

// J6 "Ticket cancellation & refund policy" (USER_JOURNEYS.md): buyers see the
// cancellation terms BEFORE purchase — the policy is snapshotted onto the
// ticket at purchase time, so it is what they agree to. The checkout rewrite
// (#863) orphaned the summary for a while; #932 (#931) re-mounted it once per
// tier group in the checkout sheet. This pins it there, per tier, for the
// three shapes a paid tier can take: bracketed refunds (+ deadline + fee),
// a flat "full refund until the deadline", and non-refundable.
//
// The sheet only opens when the cart needs input the steppers can't collect,
// so the event requires ticket-holder names. Tiers are 'offline' — no Stripe
// round-trip; nothing is confirmed here, the assertion is on what the buyer
// sees before the confirm button.
//
// Isolation: own event + tiers + throwaway buyer, all API-arranged.

test.describe('J6 refund terms before purchase @p1', () => {
	test('checkout sheet shows each tier’s cancellation terms before confirm', async ({
		browser
	}) => {
		const event = await createTicketedEvent({
			freeTier: false,
			event: { require_ticket_names: true }
		});
		await deleteDefaultTier(event.id);

		const bracketed = await createTicketTier(event.id, {
			name: 'Flexible Entry',
			payment_method: 'offline',
			price: '20.00',
			price_type: 'fixed',
			total_quantity: 50,
			allow_user_cancellation: true,
			cancellation_deadline_hours: 24,
			refund_policy: {
				tiers: [
					{ hours_before_event: 168, refund_percentage: '100' },
					{ hours_before_event: 48, refund_percentage: '50' }
				],
				flat_fee: '2.00'
			}
		});
		const flat = await createTicketTier(event.id, {
			name: 'Standard Entry',
			payment_method: 'offline',
			price: '15.00',
			price_type: 'fixed',
			total_quantity: 50,
			allow_user_cancellation: true,
			cancellation_deadline_hours: 48
		});
		const final = await createTicketTier(event.id, {
			name: 'Final Sale Entry',
			payment_method: 'offline',
			price: '10.00',
			price_type: 'fixed',
			total_quantity: 50,
			allow_user_cancellation: false
		});

		const buyer = await createVerifiedUser('RefundTerms');
		const context = await browser.newContext();
		await authenticateContext(context, buyer);
		const page = await context.newPage();
		await gotoHydrated(page, event.path);
		await waitForClientAuth(page);

		for (const tier of [bracketed, flat, final]) {
			const stepper = page.getByRole('group', { name: `Quantity for ${tier.name}` });
			await stepper.getByRole('button', { name: `Add one ${tier.name}` }).click();
			await expect(stepper.locator('span[aria-live="polite"]')).toHaveText('1');
		}

		await page
			.getByTestId('cart-summary-bar')
			.getByRole('button', { name: 'Buy', exact: true })
			.click();
		const sheet = page.getByRole('dialog', { name: 'Checkout' });
		await expect(sheet).toBeVisible();

		// One card per tier: the div holding that tier's "{name} × 1" title AND a
		// terms note, but no other tier's name (every ancestor holds them all).
		const others = (name: string): RegExp =>
			new RegExp(
				[bracketed, flat, final]
					.map((t) => t.name)
					.filter((n) => n !== name)
					.join('|')
			);
		const card = (name: string) =>
			sheet
				.locator('div')
				.filter({ hasText: `${name} × 1`, hasNotText: others(name) })
				.filter({ has: page.getByRole('note') });

		// Bracketed: every bracket (most generous first), the deadline, the fee.
		const bracketedNote = card(bracketed.name).getByRole('note');
		await expect(bracketedNote).toContainText('Cancellation policy');
		await expect(bracketedNote.getByRole('listitem')).toHaveText([
			/^Cancel ≥ 168h before → 100(\.0+)?% refund$/,
			/^Cancel ≥ 48h before → 50(\.0+)?% refund$/
		]);
		await expect(bracketedNote).toContainText('Cancellations close 24h before the event starts.');
		await expect(bracketedNote).toContainText(
			/A €\s?2\.00 processing fee is deducted from every refund\./
		);
		await expect(bracketedNote).not.toContainText('non-refundable');

		// No brackets: a single full-refund line up to the deadline.
		const flatNote = card(flat.name).getByRole('note');
		await expect(flatNote).toContainText('Cancellation policy');
		await expect(flatNote).toContainText('Full refund if cancelled at least 48h before the event.');
		await expect(flatNote.getByRole('listitem')).toHaveCount(0);

		// Non-refundable is spelled out, not merely left blank.
		const finalNote = card(final.name).getByRole('note');
		await expect(finalNote).toContainText('This ticket is non-refundable');
		await expect(finalNote).toContainText(
			"Once purchased, this ticket can't be cancelled or refunded."
		);
		await expect(finalNote).not.toContainText('Cancellation policy');

		// All of it is on screen while the purchase is still unconfirmed.
		await expect(sheet.getByRole('button', { name: 'Reserve', exact: true })).toBeVisible();

		await context.close();
	});
});
