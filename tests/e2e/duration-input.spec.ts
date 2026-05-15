import { test, expect } from '@playwright/test';

// Smoke test for the DurationInput composite picker. Verifies the questionnaire
// admin form renders the new component and accepts input.
//
// Like the other admin smoke tests in this directory, this one skips when the
// `E2E_ADMIN_AUTH` fixture isn't configured. Run with the demo-seed backend +
// admin login fixture to exercise the real flow.

test.describe('DurationInput — questionnaire admin', () => {
	test('renders composite picker on new questionnaire page', async ({ page }) => {
		test.skip(!process.env.E2E_ADMIN_AUTH, 'requires admin auth fixture');

		await page.goto('/org/revel-events-collective/admin/questionnaires/new');

		// The migrated Submission Validity field exposes label + chip + number input + unit select.
		const validityInput = page.getByLabel(/submission validity/i);
		await expect(validityInput).toBeVisible();
		await expect(page.getByRole('button', { name: /no limit/i })).toBeVisible();

		// Typing a number persists in the input.
		await validityInput.fill('30');
		await expect(validityInput).toHaveValue('30');

		// The unit dropdown surfaces "Days" by default. Target the trigger by its
		// component-generated aria-label so we assert against the unit select
		// specifically, not some other combobox on the page.
		await expect(page.getByLabel(/submission validity unit/i)).toContainText(/days/i);
	});
});
