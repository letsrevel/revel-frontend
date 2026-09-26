import { test, expect, type Page } from '../../support/fixtures';
import { ApiClient, ApiError } from '../../support/api';
import { createOrganization, type CreatedOrg } from '../../support/factories';
import { authenticateContext } from '../../support/session';
import { gotoHydrated, waitForClientAuth } from '../../support/navigation';

// J22.1 (USER_JOURNEYS.md) — the organizer sets the attendee invoicing mode
// from the Billing & VAT page (every other invoicing spec arranges it via
// setOrgInvoicingMode). HYBRID/AUTO require an EU org with a VIES-validated
// VAT ID, billing name and billing address; NONE is always allowed.
//
// Both tests use THROWAWAY orgs: Org Alpha's mode is suite-wide shared state
// pinned to 'hybrid' (see setOrgInvoicingMode) and must never be flipped by
// a UI test running beside Stripe checkouts.
//
// The happy path needs a VIES-validated VAT ID, and the backend validates
// against the LIVE EU VIES service (no stub) — so it uses a real, stable
// registration (Red Bull GmbH, same one j16 vat-preview relies on) and skips
// itself when VIES is down instead of failing the run.

const REAL_VAT_ID = 'ATU33864707'; // Red Bull GmbH

async function openBilling(page: Page, org: CreatedOrg): Promise<void> {
	await gotoHydrated(page, `/org/${org.slug}/admin/billing`);
	await waitForClientAuth(page);
	await expect(page.getByRole('heading', { name: 'Attendee Invoicing' })).toBeVisible({
		timeout: 15_000
	});
}

/** The section's Save button — scoped, the billing form below has its own. */
function saveMode(page: Page) {
	return page
		.locator('section')
		.filter({ has: page.getByRole('heading', { name: 'Attendee Invoicing' }) })
		.getByRole('button', { name: 'Save Changes' });
}

test.describe('J22 invoicing mode @p2', () => {
	test('switching mode persists across reloads (hybrid → auto → disabled)', async ({ browser }) => {
		test.setTimeout(120_000);
		const org = await createOrganization();
		const api = await ApiClient.login(org.owner.email, org.owner.password);

		// Arrange the prerequisites: billing name/address + a VIES-validated ID.
		await api.patch(`/api/organization-admin/${org.slug}/billing-info`, {
			billing_name: `${org.name} GmbH`,
			billing_address: 'Am Brunnen 1, 5330 Fuschl am See'
		});
		try {
			await api.put(`/api/organization-admin/${org.slug}/vat-id`, { vat_id: REAL_VAT_ID });
		} catch (err) {
			test.skip(
				err instanceof ApiError,
				`VIES did not validate ${REAL_VAT_ID} (service down or registration changed): ${String(err)}`
			);
			throw err;
		}

		const context = await browser.newContext();
		await authenticateContext(context, org.owner);
		const page = await context.newPage();
		try {
			await openBilling(page, org);
			// A new org starts with invoicing disabled.
			await expect(page.getByRole('radio', { name: 'Disabled' })).toBeChecked();

			for (const label of ['Manual Review', 'Automatic', 'Disabled'] as const) {
				await page.getByRole('radio', { name: label }).click();
				await expect(page.getByRole('radio', { name: label })).toBeChecked();
				await saveMode(page).click();
				await expect(page.getByText('Invoicing mode updated')).toBeVisible({ timeout: 15_000 });

				// Reload — the radio group re-hydrates from the persisted mode.
				await openBilling(page, org);
				await expect(page.getByRole('radio', { name: label })).toBeChecked({ timeout: 15_000 });
			}
		} finally {
			await context.close();
		}
	});

	test('enabling invoicing without the VAT prerequisites is refused', async ({ browser }) => {
		test.setTimeout(90_000);
		// No VAT ID, no billing name/address.
		const org = await createOrganization();

		const context = await browser.newContext();
		await authenticateContext(context, org.owner);
		const page = await context.newPage();
		try {
			await openBilling(page, org);
			await page.getByRole('radio', { name: 'Automatic' }).click();
			await saveMode(page).click();

			// The backend's 422 names every missing prerequisite; the toast relays it.
			await expect(page.getByText(/VAT ID must be validated via VIES/)).toBeVisible({
				timeout: 15_000
			});
			await expect(page.getByText('Invoicing mode updated')).toHaveCount(0);

			// Nothing persisted: after a reload the org is still Disabled.
			await openBilling(page, org);
			await expect(page.getByRole('radio', { name: 'Disabled' })).toBeChecked({
				timeout: 15_000
			});
		} finally {
			await context.close();
		}
	});
});
