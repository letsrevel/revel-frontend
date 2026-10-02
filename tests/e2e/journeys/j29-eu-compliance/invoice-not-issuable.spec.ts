import { test, expect } from '../../support/fixtures';
import { gotoHydrated, waitForClientAuth } from '../../support/navigation';

// J29.8 (USER_JOURNEYS.md) — the pre-gate HYBRID draft on compliance-hr can no
// longer be issued. The issue call answers 422; the dialog shows the
// backend's reason plus the static helper, and the draft stays a draft.
// Nothing changes server-side, so the fixture needs no restoring.

const INVOICE = 'COMPLIANCEHR-2026-000001';

test.describe('J29.8 invoice that can no longer be issued @p2', () => {
	test('issuing the Croatian draft is refused inline', async ({ asCompliance: page }) => {
		await gotoHydrated(page, '/org/compliance-hr/admin/billing/attendee-invoices');
		await waitForClientAuth(page);
		await expect(page.getByText(INVOICE).first()).toBeVisible({ timeout: 15_000 });

		await page.getByRole('button', { name: 'Issue Invoice' }).first().click();
		const dialog = page.getByRole('dialog', { name: 'Issue this invoice?' });
		await expect(dialog).toBeVisible();
		await dialog.getByRole('button', { name: 'Yes, Issue' }).click();

		const refusal = dialog.getByRole('alert');
		await expect(refusal).toContainText(
			"Revel can't issue invoices to your attendees in Croatia.",
			{
				timeout: 15_000
			}
		);
		await expect(refusal).toContainText(
			"This invoice can't be issued from Revel anymore. Issue it from your own invoicing software."
		);

		// Still a draft after closing the dialog. Escape, not Cancel: on the
		// mobile viewport the dialog overlay intercepts the footer click.
		await page.keyboard.press('Escape');
		await expect(dialog).not.toBeVisible();
		await page.reload();
		await waitForClientAuth(page);
		await expect(page.getByRole('button', { name: 'Issue Invoice' }).first()).toBeVisible({
			timeout: 15_000
		});
	});
});
