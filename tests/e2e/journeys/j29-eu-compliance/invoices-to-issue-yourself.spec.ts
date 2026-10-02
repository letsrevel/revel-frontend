import { test, expect, type Page } from '../../support/fixtures';
import { gotoHydrated, waitForClientAuth } from '../../support/navigation';
import { fixtureEvent } from './helpers';

// J29.9 (USER_JOURNEYS.md) — invoices Revel skipped under a country policy
// (#1008). compliance-be and compliance-pl each have one skipped B2B invoice.
// compliance-be stays read-only. The resolve spec runs on compliance-pl, in
// one project only: the API has no "unresolve", so it can't put the row back
// (a reseed reopens it). It works from either state, so reruns pass.

const TITLE = 'Invoices to issue yourself';

async function openList(page: Page, orgSlug: string): Promise<void> {
	await gotoHydrated(page, `/org/${orgSlug}/admin/billing/skipped-documents`);
	await waitForClientAuth(page);
	await expect(page.getByRole('heading', { name: TITLE, level: 1 })).toBeVisible({
		timeout: 15_000
	});
}

test.describe('J29.9 invoices to issue yourself @p2', () => {
	test('billing links to the list, which shows the Belgian B2B sale', async ({
		asCompliance: page
	}) => {
		await gotoHydrated(page, '/org/compliance-be/admin/billing');
		await waitForClientAuth(page);
		await page.getByRole('link', { name: TITLE }).click();
		await expect(page.getByRole('heading', { name: TITLE, level: 1 })).toBeVisible({
			timeout: 15_000
		});

		const table = page.getByRole('table', { name: TITLE });
		const row = table.getByRole('row').filter({ hasText: 'E2E Business BE' });
		await expect(row).toBeVisible({ timeout: 15_000 });
		await expect(row).toContainText('BE Business Summit');
		await expect(row).toContainText('VAT ID BE0123456789');
		await expect(row).toContainText('€120.00');
		await expect(row).toContainText('To issue');
		await expect(row.getByRole('button', { name: /Mark as issued/ })).toBeVisible();

		// The view opens on what's still to issue; "Issued" has nothing here.
		await page.getByRole('button', { name: 'Issued', exact: true }).click();
		await expect(page.getByText('No documents match these filters.')).toBeVisible();
		await page.getByRole('button', { name: 'All', exact: true }).click();
		await expect(row).toBeVisible();
	});

	test('search narrows the list', async ({ asCompliance: page }) => {
		await openList(page, 'compliance-be');
		const rows = page.getByTestId('skipped-document-row');
		await expect(rows).toHaveCount(1, { timeout: 15_000 });
		await page
			.getByRole('searchbox', { name: 'Search invoices to issue yourself' })
			.fill('nomatch');
		await expect(page.getByText('No documents match these filters.')).toBeVisible();
		await page.getByRole('searchbox', { name: 'Search invoices to issue yourself' }).fill('BE0123');
		await expect(rows).toHaveCount(1);
	});

	test('mark the Polish sale as issued', async ({ asCompliance: page }) => {
		test.skip(
			test.info().project.name !== 'chromium',
			'Resolving is not undoable; one project owns the row.'
		);
		await openList(page, 'compliance-pl');
		await page.getByRole('button', { name: 'All', exact: true }).click();
		const row = page.getByTestId('skipped-document-row').filter({ hasText: 'NL123456789B01' });
		await expect(row).toBeVisible({ timeout: 15_000 });

		const action = row.getByRole('button', { name: /Mark as issued|Edit reference/ });
		await action.click();
		const dialog = page.getByRole('dialog', { name: 'Mark as issued' });
		const input = dialog.getByLabel('Document number in your system');

		// Blank is refused inline.
		await input.fill('');
		await dialog.getByRole('button', { name: 'Save' }).click();
		await expect(dialog.getByRole('alert')).toHaveText('Enter the document number.');

		const reference = `KSEF-E2E-${Date.now()}`;
		await input.fill(reference);
		await dialog.getByRole('button', { name: 'Save' }).click();
		await expect(dialog).not.toBeVisible();
		await expect(row).toContainText('Issued');
		await expect(row).toContainText(`Ref. ${reference}`);
		// Focus comes back to the row's action.
		await expect(row.getByRole('button', { name: /Edit reference/ })).toBeFocused();
	});

	test('ticket list flags the skipped sale and filters on it', async ({ asCompliance: page }) => {
		const event = await fixtureEvent('compliance-be', 'be-business-summit');
		await gotoHydrated(page, `/org/compliance-be/admin/events/${event.id}/tickets`);
		await waitForClientAuth(page);
		const badges = page.locator('[data-testid="invoice-skipped-badge"]:visible');
		await expect(badges).toHaveCount(1, { timeout: 15_000 });
		await expect(badges.first()).toHaveText('Invoice to issue yourself');

		await page.getByRole('checkbox', { name: 'Invoice skipped by Revel' }).check();
		await expect(page).toHaveURL(/invoice_skipped=true/);
		await expect(page.getByRole('checkbox', { name: 'Invoice skipped by Revel' })).toBeChecked();
		await expect(badges).toHaveCount(1);
		await expect(page.getByText('Showing 1 ticket', { exact: true })).toBeAttached();
	});
});
