import { test, expect } from '../../support/fixtures';
import { ApiClient } from '../../support/api';
import {
	createEventSeries,
	createSeriesPass,
	createTicketedEvent,
	createVerifiedUser
} from '../../support/factories';
import { authenticateContext } from '../../support/session';
import { gotoHydrated, waitForClientAuth } from '../../support/navigation';
import { completeStripeCheckout } from '../../support/stripe';

// J26 (USER_JOURNEYS.md) — season pass, online flavor: hosted-Stripe purchase
// of a pass (the held pass only materializes when the webhook lands), then
// the ORGANIZER cancels it from the Holders dialog — remaining tickets are
// cancelled and the succeeded payment refunded backend-side; the buyer's pass
// card flips to Cancelled and loses its View-pass action.
//
// Lives on Org Alpha (the only Stripe-connected org — CONNECTED_TEST_STRIPE_ID
// at bootstrap) with the standard full Stripe test-mode setup
// (tests/e2e/README.md); the series itself is arranged fresh per run.

test.describe('J26 season pass online cancel @p3', () => {
	test('Stripe pass purchase → organizer cancels → pass and tickets cancelled', async ({
		browser,
		asOwner
	}) => {
		test.setTimeout(300_000);

		const series = await createEventSeries('owner', 'revel-events-collective');
		const [eventA, eventB] = await Promise.all([
			createTicketedEvent({ event: { event_series_id: series.id } }),
			createTicketedEvent({ event: { event_series_id: series.id } })
		]);
		const pass = await createSeriesPass('owner', series.id, {
			payment_method: 'online',
			price: '10.00',
			tier_links: [
				{ event_id: eventA.id, tier_id: eventA.freeTierId as string },
				{ event_id: eventB.id, tier_id: eventB.freeTierId as string }
			]
		});

		const buyer = await createVerifiedUser('OnlinePass');
		const buyerContext = await browser.newContext();
		await authenticateContext(buyerContext, buyer);
		const page = await buyerContext.newPage();

		// Purchase through the series page → hosted Stripe checkout.
		await gotoHydrated(page, series.path);
		await waitForClientAuth(page);
		await page.getByRole('button', { name: 'Get season pass' }).click();
		const dialog = page.getByRole('dialog', { name: new RegExp(pass.name) });
		await expect(dialog).toBeVisible();
		await dialog.getByRole('button', { name: 'Continue to payment' }).click();
		await completeStripeCheckout(page);

		// The webhook creates + activates the held pass — poll My passes for it.
		const activeCard = page
			.locator('article, li, div')
			.filter({ hasText: pass.name })
			.filter({ hasText: /Active/ })
			.first();
		await expect(async () => {
			await gotoHydrated(page, '/dashboard/passes');
			await expect(activeCard).toBeVisible({ timeout: 5_000 });
		}).toPass({ timeout: 90_000 });

		// Organizer cancels the held pass from the Holders dialog.
		await gotoHydrated(asOwner, `/org/revel-events-collective/admin/event-series/${series.id}`);
		await waitForClientAuth(asOwner);
		// The dashboard's tab strip is plain buttons, not a WAI-ARIA tablist.
		await asOwner.getByRole('button', { name: 'Passes', exact: true }).click();
		await asOwner.getByRole('button', { name: 'Holders' }).click();
		const holders = asOwner.getByRole('dialog', { name: new RegExp(`Holders — ${pass.name}`) });
		await expect(holders).toBeVisible();
		await expect(holders.getByText(`${buyer.firstName} ${buyer.lastName}`)).toBeVisible({
			timeout: 15_000
		});
		await holders.getByRole('button', { name: 'Cancel pass' }).click();
		// The cancel dialog stacks under the (still-open, aria-modal) holders
		// dialog, whose overlay intercepts pointer events — dispatch the click
		// straight to the button, outcome-keyed on the dialog closing (it stays
		// open on failure; a just-mounted button can swallow the first dispatch
		// under parallel-worker load). The optional reason stays empty. The
		// backend cancel is idempotent, so a re-dispatch is always safe.
		const cancelDialog = asOwner.getByRole('dialog', { name: 'Cancel held pass' });
		await expect(cancelDialog).toBeVisible();
		await expect(async () => {
			if (await cancelDialog.isHidden()) return;
			await cancelDialog.getByRole('button', { name: 'Cancel pass' }).dispatchEvent('click');
			await expect(cancelDialog).toBeHidden({ timeout: 5_000 });
		}).toPass({ timeout: 45_000 });
		// The holder row re-renders with the Cancelled badge (its Cancel-pass
		// action disappears with it).
		await expect(holders.getByText('Cancelled').first()).toBeVisible({ timeout: 15_000 });
		await expect(holders.getByRole('button', { name: 'Cancel pass' })).toBeHidden();

		// Buyer side: the pass flips Cancelled and the View-pass action is gone;
		// the materialized tickets are cancelled with it (none left Active).
		await expect(async () => {
			await gotoHydrated(page, '/dashboard/passes');
			await expect(
				page
					.locator('article, li, div')
					.filter({ hasText: pass.name })
					.filter({ hasText: /Cancelled/ })
					.first()
			).toBeVisible({ timeout: 5_000 });
		}).toPass({ timeout: 45_000 });
		await expect(page.getByRole('button', { name: 'View pass' })).toBeHidden();

		// The materialized tickets went down with the pass (asserted at the API —
		// a page-level absence check would false-positive on the status filter
		// chips, which also read "Active").
		const buyerApi = await ApiClient.login(buyer.email, buyer.password);
		const tickets = await buyerApi.get<{ results: Array<{ status: string }> }>(
			'/api/dashboard/tickets'
		);
		expect(tickets.results.length).toBeGreaterThan(0);
		for (const ticket of tickets.results) {
			expect(ticket.status).toBe('cancelled');
		}

		await buyerContext.close();
	});
});
