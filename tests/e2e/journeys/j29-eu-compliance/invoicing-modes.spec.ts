import { test, expect } from '../../support/fixtures';
import { ApiError } from '../../support/api';
import { complianceApi, openBilling } from './helpers';

// J29.2 (USER_JOURNEYS.md) — attendee invoicing modes under country rules, on
// the seeded compliance-* orgs. Read-only: the one write (forcing `auto` on
// Croatia) is refused by the backend, so nothing needs restoring.

const HR_DETAIL =
	"Revel can't issue invoices to your attendees in Croatia. The law there requires invoices to go through the Tax Administration's fiscalization system, and Revel isn't connected to it yet. Please issue invoices from your own invoicing software.";

test.describe('J29.2 attendee invoicing modes @p2', () => {
	test('Croatia: Manual Review and Automatic are disabled and explained', async ({
		asCompliance: page
	}) => {
		await openBilling(page, 'compliance-hr');

		const notice = page.getByTestId('invoicing-compliance-notice');
		await expect(notice).toHaveText(HR_DETAIL);
		await expect(notice).toHaveAttribute('role', 'status');

		// The migration switched blocked orgs to NONE; it renders selected.
		await expect(page.getByRole('radio', { name: 'Disabled' })).toBeChecked();
		await expect(page.getByRole('radio', { name: 'Disabled' })).toBeEnabled();
		for (const label of ['Manual Review', 'Automatic']) {
			const radio = page.getByRole('radio', { name: label });
			await expect(radio).toBeDisabled();
			// Every disabled control names its reason (WCAG 1.3.1 / 3.3.2).
			await expect(radio).toHaveAccessibleDescription(HR_DETAIL);
		}
	});

	test('Croatia: forcing auto through the API is refused with the same text', async () => {
		const api = await complianceApi();
		const refused = await api
			.patch('/api/organization-admin/compliance-hr/invoicing', { mode: 'auto' })
			.then(() => null)
			.catch((err: unknown) => err);
		expect(refused).toBeInstanceOf(ApiError);
		expect((refused as ApiError).status).toBe(422);
		expect(JSON.parse((refused as ApiError).body).detail).toBe(HR_DETAIL);
		// `none` always succeeds (and is already the stored value).
		await api.patch('/api/organization-admin/compliance-hr/invoicing', { mode: 'none' });
	});

	test('Belgium: modes stay enabled with the Peppol notice', async ({ asCompliance: page }) => {
		await openBilling(page, 'compliance-be');
		await expect(page.getByTestId('invoicing-compliance-notice')).toHaveText(
			"Invoices to customers with a Belgium VAT ID must be sent as e-invoices through Peppol. Revel won't create those. Issue them from your e-invoicing software. Invoices to everyone else work as usual."
		);
		await expect(page.getByRole('radio', { name: 'Manual Review' })).toBeEnabled();
		await expect(page.getByRole('radio', { name: 'Automatic' })).toBeEnabled();
	});

	test('Poland: modes stay enabled with the KSeF notice', async ({ asCompliance: page }) => {
		await openBilling(page, 'compliance-pl');
		await expect(page.getByTestId('invoicing-compliance-notice')).toHaveText(
			"Invoices to business customers must be issued through KSeF. Revel won't create those. Issue them from your e-invoicing software. Invoices to consumers work as usual."
		);
		await expect(page.getByRole('radio', { name: 'Manual Review' })).toBeEnabled();
		await expect(page.getByRole('radio', { name: 'Automatic' })).toBeEnabled();
	});

	test('Spain: the Verifactu warning before 2027, the block after', async ({
		asCompliance: page
	}) => {
		// The flip happens on the server clock (2027-01-01), so the expected state
		// is read from the API rather than hard-coded: this spec stays valid on
		// both sides of the date.
		const api = await complianceApi();
		const org = await api.get<{ compliance: { attendee_invoicing: string } }>(
			'/api/organization-admin/compliance-es'
		);
		await openBilling(page, 'compliance-es');
		const banner = page.getByTestId('invoicing-compliance-notice');
		if (org.compliance.attendee_invoicing === 'allowed') {
			await expect(banner).toContainText('From 1 January 2027');
			await expect(banner).toHaveAttribute('data-tone', 'warning');
			await expect(page.getByRole('radio', { name: 'Manual Review' })).toBeEnabled();
			await expect(page.getByRole('radio', { name: 'Automatic' })).toBeEnabled();
		} else {
			await expect(banner).toContainText('Verifactu');
			await expect(banner).toHaveAttribute('data-tone', 'blocked');
			await expect(page.getByRole('radio', { name: 'Manual Review' })).toBeDisabled();
			await expect(page.getByRole('radio', { name: 'Automatic' })).toBeDisabled();
		}
	});

	test('an org with no invoicing rule shows no invoicing notice', async ({
		asCompliance: page
	}) => {
		await openBilling(page, 'compliance-at');
		await expect(page.getByTestId('country-rules-card')).toBeVisible();
		await expect(page.getByTestId('invoicing-compliance-notice')).toHaveCount(0);
	});
});
