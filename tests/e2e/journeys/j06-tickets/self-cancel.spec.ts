import { test, expect } from '../../support/fixtures';
import {
	createTicketedEvent,
	createTicketTier,
	createVerifiedUser,
	startOnlineCheckout
} from '../../support/factories';
import { authenticateContext } from '../../support/session';
import { gotoHydrated, waitForClientAuth } from '../../support/navigation';
import { completeStripeCheckout } from '../../support/stripe';

// J6.7 (USER_JOURNEYS.md) — attendee self-cancellation on an online ticket:
// the cancel dialog quotes the refund from the tier's policy before anything
// happens, confirming cancels the ticket and issues the Stripe refund.
//
// Requires the full Stripe test-mode setup (tests/e2e/README.md): the ticket
// must be PAID for a refund quote to exist, so the arrange drives the hosted
// checkout with the API-returned session URL.
//
// Isolation: own event + online tier with allow_user_cancellation and a
// 100%-until-start refund policy; throwaway buyer.

test.describe('J6 self-cancel @p2', () => {
	test('refund preview → confirm → ticket cancelled with refund toast', async ({ browser }) => {
		// Stripe hosted checkout + webhook + refund round-trips.
		test.setTimeout(240_000);

		const [event, buyer] = await Promise.all([
			createTicketedEvent({ freeTier: false }),
			createVerifiedUser('SelfCancel')
		]);
		const tier = await createTicketTier(event.id, {
			name: 'Refundable Entry',
			payment_method: 'online',
			price: '10.00',
			allow_user_cancellation: true,
			refund_policy: {
				tiers: [{ hours_before_event: 0, refund_percentage: '100' }],
				flat_fee: '0'
			}
		});

		const checkoutUrl = await startOnlineCheckout(buyer, event.id, tier.id);

		const context = await browser.newContext();
		await authenticateContext(context, buyer);
		const page = await context.newPage();
		await page.goto(checkoutUrl);
		await completeStripeCheckout(page);

		// Activation arrives via the webhook — poll the dashboard.
		const activeCard = page
			.locator('article, li, div')
			.filter({ hasText: event.name })
			.filter({ hasText: /Active/i })
			.first();
		await expect(async () => {
			await gotoHydrated(page, '/dashboard/tickets');
			await expect(activeCard).toBeVisible({ timeout: 5_000 });
		}).toPass({ timeout: 90_000 });
		await waitForClientAuth(page);

		// Open the ticket modal → "Cancel ticket" (rendered only for active
		// tickets on allow_user_cancellation tiers before event start).
		await activeCard.getByRole('button', { name: 'View Ticket' }).click();
		const ticketModal = page.getByRole('dialog', { name: 'Your Ticket', exact: true });
		await expect(ticketModal).toBeVisible({ timeout: 15_000 });
		await ticketModal.getByRole('button', { name: 'Cancel ticket' }).click();

		// The dialog quotes the full refund (100% window, no flat fee) before
		// any mutation happens.
		const cancelDialog = page.getByRole('dialog', { name: 'Cancel your ticket' });
		await expect(cancelDialog).toBeVisible({ timeout: 15_000 });
		const summary = cancelDialog.getByTestId('refund-summary');
		await expect(summary.getByText("You'll receive")).toBeVisible({ timeout: 15_000 });
		await expect(summary.getByText(/10[.,]00/)).toBeVisible();
		await expect(cancelDialog.getByText('Refund schedule')).toBeVisible();

		await cancelDialog.getByLabel('Reason (optional)').fill('E2E self-cancel journey');
		await cancelDialog.getByRole('button', { name: 'Confirm cancellation' }).click();

		// Success toast announces the refund; the dashboard card flips to
		// Cancelled once the list refetches.
		await expect(page.getByText('Ticket cancelled')).toBeVisible({ timeout: 30_000 });
		const cancelledCard = page
			.locator('article, li, div')
			.filter({ hasText: event.name })
			.filter({ hasText: /Cancelled/i })
			.first();
		await expect(async () => {
			await gotoHydrated(page, '/dashboard/tickets');
			await expect(cancelledCard).toBeVisible({ timeout: 5_000 });
		}).toPass({ timeout: 45_000 });

		await context.close();
	});
});
