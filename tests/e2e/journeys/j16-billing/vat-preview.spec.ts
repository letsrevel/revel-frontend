import { test, expect } from '../../support/fixtures';
import { ApiClient } from '../../support/api';
import {
	createTicketedEvent,
	createTicketTier,
	createVerifiedUser,
	setOrgInvoicingMode
} from '../../support/factories';
import { authenticateContext } from '../../support/session';
import { gotoHydrated, waitForClientAuth } from '../../support/navigation';

// J16 (USER_JOURNEYS.md) — buyer-facing VAT preview in the checkout billing
// form: a domestic (same-country) B2B buyer still pays the org's VAT, an EU
// cross-border buyer with a VIES-valid VAT ID gets the reverse charge (no
// VAT). The VAT math itself is backend-tested — this asserts the breakdown
// UI reacts to the billing fields.
//
// The billing section only renders when the org has attendee invoicing
// enabled AND the tier is online — the arrange pins Org Alpha (AT, 20%) to
// 'hybrid', the suite-wide invoicing mode (see setOrgInvoicingMode).
//
// VAT IDs are validated against the LIVE EU VIES service (no backend stub),
// so the spec uses two real, stable registrations — Red Bull GmbH (AT,
// domestic) and Ferrari S.p.A. (IT, cross-border) — and skips itself when
// VIES is down instead of failing the run.

const DOMESTIC_VAT_ID = 'ATU33864707'; // Red Bull GmbH — same country as Org Alpha
const CROSS_BORDER_VAT_ID = 'IT00159560366'; // Ferrari S.p.A. — EU B2B reverse charge

test.describe('J16 VAT preview @p2', () => {
	test('domestic B2B pays VAT; EU B2B with valid VAT ID gets reverse charge', async ({
		browser
	}) => {
		await setOrgInvoicingMode('hybrid');
		const [event, buyer] = await Promise.all([
			createTicketedEvent({ freeTier: false }),
			createVerifiedUser('VatPreview')
		]);
		// €10.00 gross at AT 20% VAT → net 8.33 + VAT 1.67.
		const tier = await createTicketTier(event.id, { name: 'Invoiced Entry', price: '10.00' });

		// Probe VIES through the backend preview endpoint — skip (not fail)
		// when the external service is unavailable or won't validate the IDs.
		const api = await ApiClient.login(buyer.email, buyer.password);
		for (const vatId of [DOMESTIC_VAT_ID, CROSS_BORDER_VAT_ID]) {
			let probe: { vat_id_valid: boolean | null } | null = null;
			try {
				probe = await api.post<{ vat_id_valid: boolean | null }>(
					`/api/events/${event.id}/tickets/vat-preview`,
					{
						billing_info: { billing_name: 'Probe', vat_id: vatId },
						items: [{ tier_id: tier.id, count: 1 }]
					}
				);
			} catch (err) {
				test.skip(
					true,
					`VIES probe request failed: ${err instanceof Error ? err.message : String(err)}`
				);
			}
			test.skip(
				probe?.vat_id_valid !== true,
				`VIES did not validate ${vatId} (service down or registration changed)`
			);
		}

		const context = await browser.newContext();
		await authenticateContext(context, buyer);
		const page = await context.newPage();
		await gotoHydrated(page, event.path);
		await waitForClientAuth(page);

		// Open the purchase confirmation dialog (fixed-price online tier).
		const tierDialog = page.getByRole('dialog', { name: 'Select Your Ticket' });
		const confirmDialog = page.getByRole('dialog', { name: 'Confirm Purchase' });
		await expect(async () => {
			if (await confirmDialog.isVisible()) return;
			if (!(await tierDialog.isVisible())) {
				await page.getByRole('button', { name: 'Get Tickets', exact: true }).click();
			}
			await tierDialog.getByRole('button', { name: 'Buy Ticket' }).click();
			await expect(confirmDialog).toBeVisible({ timeout: 8_000 });
		}).toPass({ timeout: 60_000 });

		// Expand the billing form and fill the domestic B2B case. The preview
		// fetch fires on VAT-ID blur.
		await confirmDialog.getByRole('checkbox', { name: 'Request Invoice' }).click();
		await confirmDialog.getByLabel('Legal Name').fill('E2E Buyer GmbH');
		await confirmDialog.getByLabel('Country Code').fill('AT');
		const vatInput = confirmDialog.getByLabel('VAT ID (optional)');
		await vatInput.fill(DOMESTIC_VAT_ID);
		await vatInput.blur();

		const preview = confirmDialog.locator('[aria-label="VAT Preview"]');
		await expect(preview.getByText('VAT ID valid')).toBeVisible({ timeout: 30_000 });
		await expect(preview.getByText('Total VAT')).toBeVisible();
		// EUR 1.67 renders twice (line VAT column + Total VAT).
		await expect(preview.getByText(/1[.,]67/).first()).toBeVisible();
		await expect(preview.getByText('Reverse charge applies — no VAT charged')).not.toBeVisible();

		// Switch to the EU cross-border B2B case → reverse charge, zero VAT.
		await confirmDialog.getByLabel('Country Code').fill('IT');
		await vatInput.fill(CROSS_BORDER_VAT_ID);
		await vatInput.blur();

		await expect(preview.getByText('Reverse charge applies — no VAT charged')).toBeVisible({
			timeout: 30_000
		});
		await expect(preview.getByText(/1[.,]67/).first()).not.toBeVisible();

		await context.close();
	});
});
