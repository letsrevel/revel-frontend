import { test, expect } from '../../support/fixtures';
import { gotoHydrated, waitForClientAuth } from '../../support/navigation';

// J29.8 (USER_JOURNEYS.md) — the pre-gate HYBRID draft on compliance-hr can no
// longer be issued. Since #1008 the list carries `issue_blocked_reason`, so
// Issue is disabled up front and described by the backend's reason; Delete
// stays available. Read-only: nothing to restore.

const INVOICE = 'COMPLIANCEHR-2026-000001';
const REASON = "Revel can't issue invoices to your attendees in Croatia.";

test.describe('J29.8 invoice that can no longer be issued @p2', () => {
	test('the Croatian draft shows why Issue is disabled', async ({ asCompliance: page }) => {
		await gotoHydrated(page, '/org/compliance-hr/admin/billing/attendee-invoices');
		await waitForClientAuth(page);
		const row = page.getByRole('row').filter({ hasText: INVOICE });
		await expect(row).toBeVisible({ timeout: 15_000 });

		const rowIssue = row.getByRole('button', { name: 'Issue Invoice' });
		await expect(rowIssue).toBeDisabled();
		await expect(rowIssue).toHaveAccessibleDescription(new RegExp(REASON));

		await row.getByRole('button', { name: INVOICE }).click();
		const detail = page.getByRole('dialog');
		const reason = detail.getByTestId('issue-blocked-reason');
		await expect(reason).toHaveAttribute('role', 'status');
		await expect(reason).toContainText(REASON);
		const issue = detail.getByRole('button', { name: 'Issue Invoice' });
		await expect(issue).toBeDisabled();
		await expect(issue).toHaveAccessibleDescription(new RegExp(REASON));
		await expect(detail.getByRole('button', { name: 'Delete', exact: true })).toBeEnabled();
	});
});
