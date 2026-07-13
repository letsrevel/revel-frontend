import { test, expect } from '../../support/fixtures';
import { getBackendUrl } from '../../support/api';
import {
	createTicketedEvent,
	createTicketTier,
	createVerifiedUser,
	setOrgInvoicingMode,
	startOnlineCheckout
} from '../../support/factories';
import { authenticateContext } from '../../support/session';
import { gotoHydrated, waitForClientAuth } from '../../support/navigation';
import { completeStripeCheckout } from '../../support/stripe';

// J22 (USER_JOURNEYS.md) — buyer-side attendee invoicing: with the org in
// AUTO invoicing mode, a paid online purchase generates an ISSUED invoice
// that the buyer finds under /account/invoices, with the PDF served from a
// signed URL in a new tab.
//
// Requires the full Stripe test-mode setup (tests/e2e/README.md) — the
// invoice is generated from the webhook's payment record. No org in the
// seed has invoicing enabled, so the arrange flips Org Alpha to 'auto'
// (idempotent, deliberately not reverted; see setOrgInvoicingMode).

test.describe('J22 buyer invoices @p2', () => {
	test('auto-invoiced purchase → issued invoice in /account/invoices → PDF', async ({
		browser
	}) => {
		// Stripe hosted checkout + webhook + invoice generation.
		test.setTimeout(240_000);

		await setOrgInvoicingMode('auto');
		const [event, buyer] = await Promise.all([
			createTicketedEvent({ freeTier: false }),
			createVerifiedUser('Invoiced')
		]);
		const tier = await createTicketTier(event.id, { name: 'Invoiced Entry', price: '10.00' });
		// Billing info at checkout is what opts the buyer into an invoice.
		const checkoutUrl = await startOnlineCheckout(buyer, event.id, tier.id, {
			billingInfo: {
				billing_name: `${buyer.firstName} ${buyer.lastName}`,
				billing_address: 'Musterstraße 1, 1010 Wien',
				vat_country_code: 'AT',
				billing_email: buyer.email
			}
		});

		const context = await browser.newContext();
		await authenticateContext(context, buyer);
		const page = await context.newPage();
		await page.goto(checkoutUrl);
		await completeStripeCheckout(page);

		// The invoice is generated when the webhook lands (inline Celery) — a
		// fresh buyer has exactly one, so poll for its Issued table row.
		const invoiceRow = page.getByRole('row').filter({ hasText: 'Issued' });
		await expect(async () => {
			await gotoHydrated(page, '/account/invoices');
			await expect(invoiceRow).toBeVisible({ timeout: 5_000 });
		}).toPass({ timeout: 90_000 });
		await waitForClientAuth(page);

		// Gross amount (€10.00) renders in the row.
		await expect(invoiceRow.getByText(/10[.,]00/).first()).toBeVisible();

		// Detail dialog opens from the invoice-number button; Escape closes it
		// (the footer Close and the X share the same accessible name).
		await invoiceRow.getByRole('button', { name: /View details/ }).click();
		const detail = page.getByRole('dialog', { name: 'Invoice Details' });
		await expect(detail).toBeVisible({ timeout: 15_000 });
		await page.keyboard.press('Escape');
		await expect(detail).not.toBeVisible({ timeout: 15_000 });

		// "Download PDF" resolves a signed URL from the API and window.open()s
		// it — Chromium turns the PDF into a download, so the popup never
		// commits a URL. Assert the journey at the network layer instead:
		// capture the resolved download_url and fetch the PDF from it (a 404
		// means the PDF is still rendering — the loop clicks again).
		await expect(async () => {
			const responsePromise = page.waitForResponse(
				(r) => /\/api\/dashboard\/invoices\/[^/]+\/download/.test(r.url()),
				{ timeout: 10_000 }
			);
			await invoiceRow.getByRole('button', { name: /Download PDF/ }).click();
			const response = await responsePromise;
			expect(response.status()).toBe(200);
			const { download_url } = (await response.json()) as { download_url: string };
			const pdf = await page.request.get(getBackendUrl(download_url));
			expect(pdf.status()).toBe(200);
			expect(pdf.headers()['content-type'] ?? '').toContain('pdf');
		}).toPass({ timeout: 60_000 });

		await context.close();
	});
});
