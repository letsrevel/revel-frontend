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

// Organizer refunds (FE #831 / BE #870) — refund and cancel are separate
// operations: the refund dialog moves money and the ticket stays valid; the
// cancel-event dialog can opt into a background refund sweep.
//
// Requires the full Stripe test-mode setup (tests/e2e/README.md): a PAID
// online ticket is the precondition for both journeys, so each arrange drives
// the hosted checkout; refund state flows back via `stripe listen` webhooks.

/** Arrange one paid online ticket and return the buyer + tier. */
async function arrangePaidTicket(
	browser: import('@playwright/test').Browser,
	label: string,
	price: string
) {
	const [event, buyer] = await Promise.all([
		createTicketedEvent({ freeTier: false }),
		createVerifiedUser(label)
	]);
	const tier = await createTicketTier(event.id, {
		name: 'Online Entry',
		payment_method: 'online',
		price
	});
	const checkoutUrl = await startOnlineCheckout(buyer, event.id, tier.id);
	const context = await browser.newContext();
	try {
		await authenticateContext(context, buyer);
		const buyerPage = await context.newPage();
		await buyerPage.goto(checkoutUrl);
		await completeStripeCheckout(buyerPage);
	} finally {
		await context.close();
	}
	return { event, buyer, tier };
}

test.describe('J10 organizer refunds @p2', () => {
	test('partial refund from the tickets tab keeps the ticket active', async ({
		asOwner,
		browser
	}) => {
		// Stripe hosted checkout + webhook round-trips.
		test.setTimeout(240_000);

		const { event, buyer } = await arrangePaidTicket(browser, 'RefundBuyer', '20.00');
		const buyerName = `${buyer.firstName} ${buyer.lastName}`;

		const page = asOwner;
		// Activation arrives via the webhook — poll the admin list.
		const activeRow = page
			.locator('tr, article, li, div')
			.filter({ hasText: buyerName })
			.filter({ hasText: /Active/ })
			.filter({ visible: true })
			.first();
		await expect(async () => {
			await gotoHydrated(page, `/org/${event.orgSlug}/admin/events/${event.id}/tickets`);
			await waitForClientAuth(page);
			await expect(activeRow).toBeVisible({ timeout: 5_000 });
		}).toPass({ timeout: 120_000 });

		// Refund €5 of €20 via the row's inline Refund action.
		await activeRow.getByRole('button', { name: 'Refund payment' }).first().click();

		const refundDialog = page.getByRole('dialog', { name: 'Refund payment' });
		await expect(refundDialog).toBeVisible({ timeout: 15_000 });
		// Context loads: amount paid + full remaining quick-select.
		await expect(refundDialog.getByText('Remaining refundable')).toBeVisible({ timeout: 15_000 });
		await expect(refundDialog.getByRole('radio', { name: /Full remaining/ })).toBeVisible();

		await refundDialog.getByRole('radio', { name: 'Custom amount' }).click();
		// spinbutton role, not getByLabel: the radiogroup shares the
		// "Refund amount" accessible name via its legend.
		await refundDialog.getByRole('spinbutton', { name: 'Refund amount' }).fill('5.00');
		await refundDialog.getByLabel('Reason (optional)').fill('E2E partial refund');
		await refundDialog.getByRole('button', { name: /^Refund .*5[.,]00/ }).click();

		// Refunding never cancels: the row stays Active and gains a refund badge
		// (Pending until the webhook confirms, then Refunded).
		await expect(page.getByText('Refund initiated')).toBeVisible({ timeout: 30_000 });
		const refundBadgeRow = page
			.locator('tr, article, li, div')
			.filter({ hasText: buyerName })
			.filter({ hasText: /Active/ })
			.filter({ hasText: /Refund pending|Refunded/ })
			.filter({ visible: true })
			.first();
		await expect(async () => {
			await gotoHydrated(page, `/org/${event.orgSlug}/admin/events/${event.id}/tickets`);
			await waitForClientAuth(page);
			await expect(refundBadgeRow).toBeVisible({ timeout: 5_000 });
		}).toPass({ timeout: 90_000 });

		// The refund history in the dialog records the attempt.
		await refundBadgeRow.getByRole('button', { name: 'Refund payment' }).first().click();
		const reopened = page.getByRole('dialog', { name: 'Refund payment' });
		await expect(reopened.getByText('Refund history')).toBeVisible({ timeout: 15_000 });
		await expect(reopened.getByText(/5[.,]00/).first()).toBeVisible();
	});

	test('cancel event with refund-all sweeps the paid ticket', async ({ asOwner, browser }) => {
		test.setTimeout(240_000);

		const { event, buyer } = await arrangePaidTicket(browser, 'SweepBuyer', '12.00');
		const buyerName = `${buyer.firstName} ${buyer.lastName}`;

		const page = asOwner;
		// Wait for the paid ticket first so the refund preview has one online
		// refundable payment to report.
		const activeRow = page
			.locator('tr, article, li, div')
			.filter({ hasText: buyerName })
			.filter({ hasText: /Active/ })
			.filter({ visible: true })
			.first();
		await expect(async () => {
			await gotoHydrated(page, `/org/${event.orgSlug}/admin/events/${event.id}/tickets`);
			await waitForClientAuth(page);
			await expect(activeRow).toBeVisible({ timeout: 5_000 });
		}).toPass({ timeout: 120_000 });

		// Cancel from the edit page with the refund sweep opted in.
		await gotoHydrated(page, `/org/${event.orgSlug}/admin/events/${event.id}/edit`);
		await waitForClientAuth(page);
		await page.getByRole('button', { name: 'Cancel event' }).click();
		const cancelDialog = page.getByRole('dialog', { name: 'Cancel this event' });
		await expect(cancelDialog).toBeVisible({ timeout: 15_000 });

		// The advisory preview reports the refundable online payment.
		await expect(cancelDialog.getByTestId('cancel-refund-preview')).toBeVisible({
			timeout: 15_000
		});
		await expect(cancelDialog.getByText(/12[.,]00/).first()).toBeVisible();

		await cancelDialog.getByLabel('Refund all tickets').click();
		// Opting in surfaces the irreversibility warning.
		await expect(
			cancelDialog.getByText('Once refunds start, this cancellation can no longer be undone.', {
				exact: false
			})
		).toBeVisible();
		await cancelDialog.getByRole('button', { name: 'Cancel event' }).click();

		await expect(page.getByText('Event cancelled', { exact: true })).toBeVisible({
			timeout: 20_000
		});

		// The background sweep cancels the ticket and issues the refund; the
		// webhook flips the refund badge. Poll the admin list for both.
		const sweptRow = page
			.locator('tr, article, li, div')
			.filter({ hasText: buyerName })
			.filter({ hasText: /Cancelled/ })
			.filter({ hasText: /Refund pending|Refunded/ })
			.filter({ visible: true })
			.first();
		await expect(async () => {
			await gotoHydrated(page, `/org/${event.orgSlug}/admin/events/${event.id}/tickets`);
			await waitForClientAuth(page);
			await expect(sweptRow).toBeVisible({ timeout: 5_000 });
		}).toPass({ timeout: 120_000 });
	});
});
