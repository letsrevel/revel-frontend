import { test, expect, type Page } from '../../support/fixtures';
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
// form. This asserts the breakdown UI reacts to the billing fields; the VAT
// math itself is backend-tested.
//
// PLACE OF SUPPLY (BE #868/#871, FE #829/#830) is the rule these two tests
// exist to pin, because it is counter-intuitive and was previously wrong:
//
//   • PHYSICAL event → admission is taxed where the EVENT is (Art. 53 VAT
//     Directive). A cross-border EU business buyer pays the ORGANIZER's VAT.
//     There is NO reverse charge, however valid their VAT ID.
//   • VIRTUAL event → post-2025 rules put the place of supply at the BUYER,
//     so a cross-border EU business buyer IS reverse-charged and pays no VAT.
//
// Before #871 the backend reverse-charged both, and this spec asserted that —
// which is why it kept passing while the behaviour was incorrect.
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
const CROSS_BORDER_VAT_ID = 'IT00159560366'; // Ferrari S.p.A. — EU cross-border B2B

/** €10.00 gross at AT 20% → net 8.33 + VAT 1.67. */
const GROSS_PRICE = '10.00';
const VAT_AMOUNT = /1[.,]67/;

interface Arranged {
	eventPath: string;
	buyer: Awaited<ReturnType<typeof createVerifiedUser>>;
}

/**
 * Arrange an invoiced online tier and a buyer, then probe VIES through the
 * backend preview endpoint — skipping (not failing) when the external service
 * is unavailable or won't validate the IDs we depend on.
 */
async function arrange(label: string, options: { isVirtual?: boolean } = {}): Promise<Arranged> {
	await setOrgInvoicingMode('hybrid');
	const [event, buyer] = await Promise.all([
		createTicketedEvent({
			freeTier: false,
			event: options.isVirtual ? { is_virtual: true } : undefined
		}),
		createVerifiedUser(label)
	]);
	const tier = await createTicketTier(event.id, { name: 'Invoiced Entry', price: GROSS_PRICE });

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

	return { eventPath: event.path, buyer };
}

/** Open the purchase confirmation dialog for a fixed-price online tier. */
async function openConfirmDialog(page: Page) {
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
	return confirmDialog;
}

test.describe('J16 VAT preview @p2', () => {
	test('physical event: cross-border EU B2B is still charged the organizer VAT', async ({
		browser
	}) => {
		test.setTimeout(150_000);
		const { eventPath, buyer } = await arrange('VatPhysical');

		const context = await browser.newContext();
		await authenticateContext(context, buyer);
		const page = await context.newPage();
		await gotoHydrated(page, eventPath);
		await waitForClientAuth(page);

		const confirmDialog = await openConfirmDialog(page);

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
		await expect(preview.getByText(VAT_AMOUNT).first()).toBeVisible();
		await expect(preview.getByText(/reverse charge/i)).not.toBeVisible();

		// Switch to the EU CROSS-BORDER B2B case. This is the assertion that
		// #871 inverted: admission to a physical event is taxed at the place of
		// supply, so Ferrari still pays Austrian VAT and is NOT reverse-charged.
		await confirmDialog.getByLabel('Country Code').fill('IT');
		await vatInput.fill(CROSS_BORDER_VAT_ID);
		await vatInput.blur();

		await expect(preview.getByText('VAT ID valid')).toBeVisible({ timeout: 30_000 });
		await expect(preview.getByText('Total VAT')).toBeVisible();
		await expect(preview.getByText(VAT_AMOUNT).first()).toBeVisible();
		await expect(preview.getByText(/reverse charge/i)).not.toBeVisible();

		await context.close();
	});

	test('virtual event: cross-border EU B2B is reverse-charged and pays no VAT', async ({
		browser
	}) => {
		test.setTimeout(150_000);
		const { eventPath, buyer } = await arrange('VatVirtual', { isVirtual: true });

		const context = await browser.newContext();
		await authenticateContext(context, buyer);
		const page = await context.newPage();
		await gotoHydrated(page, eventPath);
		await waitForClientAuth(page);

		const confirmDialog = await openConfirmDialog(page);

		await confirmDialog.getByRole('checkbox', { name: 'Request Invoice' }).click();
		await confirmDialog.getByLabel('Legal Name').fill('E2E Buyer Srl');
		await confirmDialog.getByLabel('Country Code').fill('IT');
		const vatInput = confirmDialog.getByLabel('VAT ID (optional)');
		await vatInput.fill(CROSS_BORDER_VAT_ID);
		await vatInput.blur();

		// Matched loosely on "reverse charge" rather than the full sentence: the
		// copy already changed once with #829/#830 (it now leads with "Virtual
		// event —"), and the assertion is scoped to the preview panel, where
		// nothing else uses the phrase.
		const preview = confirmDialog.locator('[aria-label="VAT Preview"]');
		await expect(preview.getByText(/reverse charge/i)).toBeVisible({ timeout: 30_000 });
		await expect(preview.getByText(VAT_AMOUNT)).toHaveCount(0);

		await context.close();
	});
});
