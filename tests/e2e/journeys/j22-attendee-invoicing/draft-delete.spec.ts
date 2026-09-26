import { test, expect } from '../../support/fixtures';
import {
	createTicketedEvent,
	createTicketTier,
	createVerifiedUser,
	setOrgInvoicingMode,
	startOnlineCheckout
} from '../../support/factories';
import { authenticateContext } from '../../support/session';
import { gotoHydrated, waitForClientAuth } from '../../support/navigation';
import {
	completeStripeCheckout,
	expectWebhookEffect,
	requireStripeWebhooks
} from '../../support/stripe';

// J22.4 (USER_JOURNEYS.md) — HYBRID mode, organizer deletes a DRAFT attendee
// invoice from the Attendee Invoices table (row action → confirm dialog).
// The draft vanishes for good and the buyer never sees it. (Edit + issue are
// covered by hybrid-flow.)
//
// Drafts only exist downstream of a real checkout webhook on Org Alpha (the
// only Stripe-connected org), pinned suite-wide to 'hybrid'.

const INVOICES_PATH = '/org/revel-events-collective/admin/billing/attendee-invoices';

test.describe('J22 draft invoice deletion @p3', () => {
	test('organizer deletes a draft invoice from the table', async ({ browser, asOwner }) => {
		test.setTimeout(240_000);
		requireStripeWebhooks();

		await setOrgInvoicingMode('hybrid');
		const [event, buyer] = await Promise.all([
			createTicketedEvent({ freeTier: false }),
			createVerifiedUser('DraftDelete')
		]);
		const tier = await createTicketTier(event.id, { name: 'Draft Entry', price: '10.00' });
		const checkoutUrl = await startOnlineCheckout(buyer, event.id, tier.id, {
			billingInfo: {
				billing_name: `${buyer.firstName} ${buyer.lastName}`,
				billing_address: 'Musterstraße 1, 1010 Wien',
				vat_country_code: 'AT',
				billing_email: buyer.email
			}
		});

		const buyerContext = await browser.newContext();
		await authenticateContext(buyerContext, buyer);
		const buyerPage = await buyerContext.newPage();
		try {
			await buyerPage.goto(checkoutUrl);
			await completeStripeCheckout(buyerPage);

			const page = asOwner;
			await gotoHydrated(page, INVOICES_PATH);
			await waitForClientAuth(page);
			const search = page.getByPlaceholder('Search invoices...');
			const draftRow = page
				.getByRole('row')
				.filter({ hasText: buyer.email })
				.filter({ hasText: 'Draft' });
			await expectWebhookEffect(
				"the draft invoice to appear on the organizer's Attendee Invoices page",
				async () => {
					await gotoHydrated(page, INVOICES_PATH);
					await search.fill(buyer.email);
					await expect(draftRow).toBeVisible({ timeout: 8_000 });
				},
				{ timeout: 120_000 }
			);

			// Row action → confirm dialog. Cancel first: nothing is deleted.
			await draftRow.getByRole('button', { name: 'Delete', exact: true }).click();
			const confirm = page.getByRole('dialog', { name: 'Delete this draft invoice?' });
			await expect(confirm).toBeVisible();
			await confirm.getByRole('button', { name: 'Cancel' }).click();
			await expect(confirm).toBeHidden();
			await expect(draftRow).toBeVisible();

			await draftRow.getByRole('button', { name: 'Delete', exact: true }).click();
			await expect(confirm).toBeVisible();
			await confirm.getByRole('button', { name: 'Yes, Delete' }).click();
			await expect(page.getByText('Draft invoice deleted')).toBeVisible({ timeout: 15_000 });
			await expect(confirm).toBeHidden();
			await expect(draftRow).toHaveCount(0);

			// Gone after a reload too — the buyer has no invoice left at all.
			await gotoHydrated(page, INVOICES_PATH);
			await search.fill(buyer.email);
			await expect(page.getByText('No attendee invoices')).toBeVisible({ timeout: 15_000 });
			await expect(page.getByRole('row').filter({ hasText: buyer.email })).toHaveCount(0);

			// …and the buyer never sees it.
			await gotoHydrated(buyerPage, '/account/invoices');
			await waitForClientAuth(buyerPage);
			await expect(buyerPage.getByText('No invoices yet')).toBeVisible({ timeout: 15_000 });
		} finally {
			await buyerContext.close();
		}
	});
});
