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
import { completeStripeCheckout } from '../../support/stripe';
import { waitForEmail } from '../../support/mailpit';

// J22 (USER_JOURNEYS.md) — HYBRID attendee invoicing, organizer side: in
// hybrid mode a paid checkout (with billing info) generates a DRAFT invoice
// that the buyer cannot see yet; the organizer reviews it on the Attendee
// Invoices page, edits the buyer fields, and ISSUES it — which emails the
// buyer (PDF attached, subject "Invoice {number} — {event}") and finally
// surfaces it under the buyer's /account/invoices.
//
// Org Alpha is the only Stripe-connected org, so the org-level invoicing mode
// is shared suite state: every invoicing spec pins it to 'hybrid' (see
// setOrgInvoicingMode) — the mode is read at WEBHOOK time and mixed modes
// would race each other's checkouts across parallel workers.

const INVOICES_PATH = '/org/revel-events-collective/admin/billing/attendee-invoices';

test.describe('J22 hybrid invoicing @p3', () => {
	test('draft after purchase → edit buyer → issue → buyer email + visible invoice', async ({
		browser,
		asOwner
	}) => {
		test.setTimeout(300_000);

		await setOrgInvoicingMode('hybrid');
		const [event, buyer] = await Promise.all([
			createTicketedEvent({ freeTier: false }),
			createVerifiedUser('Hybrid')
		]);
		const tier = await createTicketTier(event.id, { name: 'Hybrid Entry', price: '10.00' });
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

			// Organizer: the draft appears on the Attendee Invoices page (webhook +
			// inline generation → poll by reload, scoped through the search box).
			await gotoHydrated(asOwner, INVOICES_PATH);
			await waitForClientAuth(asOwner);
			const draftRow = asOwner
				.getByRole('row')
				.filter({ hasText: buyer.email })
				.filter({ hasText: 'Draft' });
			await expect(async () => {
				await gotoHydrated(asOwner, INVOICES_PATH);
				await asOwner.getByPlaceholder('Search invoices...').fill(buyer.email);
				await expect(draftRow).toBeVisible({ timeout: 8_000 });
			}).toPass({ timeout: 120_000 });

			// While it's a draft, the buyer sees NOTHING under /account/invoices —
			// the dashboard endpoint serves issued invoices only.
			const buyerRow = buyerPage.getByRole('row').filter({ hasText: 'Issued' });
			await gotoHydrated(buyerPage, '/account/invoices');
			await waitForClientAuth(buyerPage);
			await expect(buyerRow).toBeHidden();
			await expect(buyerPage.getByText('No invoices yet')).toBeVisible({ timeout: 15_000 });

			// Detail dialog → edit the buyer fields on the draft. In-dialog buttons
			// get dispatchEvent clicks: on the mobile viewport the long scrollable
			// dialog keeps them "unstable" for Playwright's actionability check and
			// a normal click waits forever — every step is outcome-keyed instead.
			await draftRow.getByRole('button').first().click();
			const detail = asOwner.getByRole('dialog', { name: 'Invoice Detail' });
			await expect(detail).toBeVisible();
			const nameField = detail.getByLabel('Name', { exact: true });
			await expect(async () => {
				if (await nameField.isVisible()) return;
				await detail.getByRole('button', { name: 'Edit' }).dispatchEvent('click');
				await expect(nameField).toBeVisible({ timeout: 3_000 });
			}).toPass({ timeout: 30_000 });

			// Outcome-keyed save: success = the view mode renders the edited buyer
			// name as TEXT (while editing it only exists as an input value, which
			// getByText ignores). The VAT ID deliberately stays EMPTY — the form
			// posts cleared fields as null, which used to 500 on the backend's
			// NOT NULL buyer columns (BE #700, fixed by revel-backend#701); this
			// save doubles as the FE-side regression for it.
			const editedName = `${buyer.firstName} ${buyer.lastName} GmbH`;
			const savedName = detail.getByText(editedName);
			await expect(async () => {
				if (await savedName.isVisible()) return;
				await nameField.fill(editedName);
				await detail.getByRole('button', { name: 'Save Changes' }).dispatchEvent('click');
				await expect(savedName).toBeVisible({ timeout: 5_000 });
			}).toPass({ timeout: 45_000 });

			// Issue it (confirm dialog) — sent to the buyer, no longer editable.
			const confirm = asOwner.getByRole('dialog', { name: 'Issue this invoice?' });
			await expect(async () => {
				if (await confirm.isVisible()) return;
				await detail.getByRole('button', { name: 'Issue Invoice' }).dispatchEvent('click');
				await expect(confirm).toBeVisible({ timeout: 3_000 });
			}).toPass({ timeout: 30_000 });
			await expect(async () => {
				if (await confirm.isHidden()) return;
				await confirm.getByRole('button', { name: 'Yes, Issue' }).dispatchEvent('click');
				await expect(confirm).toBeHidden({ timeout: 5_000 });
			}).toPass({ timeout: 45_000 });

			// The buyer receives the org-branded invoice email (PDF attached).
			const email = await waitForEmail({ to: buyer.email, subject: 'Invoice' }, 30_000);
			expect(email.Subject).toMatch(/^Invoice .+ — /);
			expect(email.Subject).toContain(event.name);

			// …and the invoice now shows under /account/invoices as Issued.
			await expect(async () => {
				await gotoHydrated(buyerPage, '/account/invoices');
				await expect(buyerRow).toBeVisible({ timeout: 5_000 });
			}).toPass({ timeout: 45_000 });
			await expect(buyerRow.getByText(/10[.,]00/).first()).toBeVisible();
		} finally {
			await buyerContext.close();
		}
	});
});
