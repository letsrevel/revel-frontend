import { test, expect } from '../../support/fixtures';
import { createOrganization, uniqueName } from '../../support/factories';
import { authenticateContext } from '../../support/session';
import { gotoHydrated, waitForClientAuth } from '../../support/navigation';
import { pickSelectOption } from '../../support/ui';

// J8 (USER_JOURNEYS.md) — billing & VAT:
// - the billing-info form persists (throwaway org, so the seeded Org Alpha
//   billing setup — which the seeded platform invoice was generated from —
//   is never mutated);
// - the platform invoices page renders the invoice `make bootstrap` seeds
//   for Org Alpha (read-only assertions, PDF download not exercised).

test.describe('J8 VAT & billing @p2', () => {
	test('billing information form saves and persists', async ({ browser }) => {
		test.setTimeout(120_000);

		const org = await createOrganization();
		const billingName = uniqueName('Billing');

		const context = await browser.newContext();
		await authenticateContext(context, org.owner);
		const page = await context.newPage();

		await gotoHydrated(page, `/org/${org.slug}/admin/billing`);
		await waitForClientAuth(page);
		await expect(page.getByRole('heading', { name: 'Billing & VAT' })).toBeVisible();

		await pickSelectOption(page, page.getByLabel('Country'), 'IT - Italy');
		await page.getByLabel('Default VAT Rate (%)').fill('22.00');
		await page.getByLabel('Legal / Billing Name').fill(billingName);
		await page.getByLabel('Billing Address').fill('Via Roma 1, 00100 Roma');
		await page.getByLabel('Billing Email').fill(org.owner.email);
		await page.getByRole('button', { name: 'Save Billing Info' }).click();
		await expect(page.getByText('Billing information updated')).toBeVisible({ timeout: 15_000 });

		// Reload — the form re-populates from the persisted billing info.
		await gotoHydrated(page, `/org/${org.slug}/admin/billing`);
		await waitForClientAuth(page);
		await expect(page.getByLabel('Legal / Billing Name')).toHaveValue(billingName, {
			timeout: 15_000
		});
		await expect(page.getByLabel('Default VAT Rate (%)')).toHaveValue('22.00');
		await expect(page.getByLabel('Country')).toContainText('Italy');

		await context.close();
	});

	test('platform invoices page renders the seeded invoice', async ({ asOwner }) => {
		await gotoHydrated(asOwner, '/org/revel-events-collective/admin/billing/invoices');
		await waitForClientAuth(asOwner);
		await expect(asOwner.getByRole('heading', { name: 'Invoices', level: 1 })).toBeVisible();

		// The seed generates one platform-fee invoice for last month's Stripe
		// sales (numbering varies with DB resets — match the pattern).
		const invoiceButton = asOwner.getByRole('button', { name: /RVL-\d{4}-\d+/ }).first();
		await expect(invoiceButton).toBeVisible({ timeout: 15_000 });
		await expect(asOwner.getByText('Issued').first()).toBeVisible();

		// Open the detail panel.
		await invoiceButton.click();
		await expect(asOwner.getByRole('heading', { name: 'Invoice Details' })).toBeVisible();
		await expect(asOwner.getByText('Fee Breakdown')).toBeVisible();
		// Two Download PDF buttons exist (per-row icon + detail panel) — the
		// detail panel's renders after the table.
		await expect(asOwner.getByRole('button', { name: 'Download PDF' }).last()).toBeVisible();
	});
});
