import { test, expect } from '@playwright/test';

// Subscriptions Phase 1 — admin + member smoke tests.
//
// These tests assume the same demo-seed backend as recurring-series-dashboard.spec.ts
// (Alice Owner as owner of "Revel Events Collective"). If fixtures for admin login
// aren't available locally, both tests skip via the early-return E2E_* env-var checks.
//
// Coverage:
//   - Admin: open the new Subscriptions tab in /admin/members.
//   - Member: visit /account/memberships (renders list or empty state).

test.describe('Subscriptions Phase 1', () => {
	test('admin can open the Subscriptions tab in /admin/members', async ({ page }) => {
		test.skip(!process.env.E2E_ADMIN_AUTH, 'requires admin auth fixture');

		await page.goto('/org/revel-events-collective/admin/members');
		await page.getByRole('tab', { name: /subscriptions/i }).click();

		// The tab renders either the empty-state copy or at least the create button.
		const createBtn = page.getByRole('button', { name: /create subscription/i });
		await expect(createBtn).toBeVisible();
	});

	test('member sees /account/memberships', async ({ page }) => {
		test.skip(!process.env.E2E_MEMBER_AUTH, 'requires member auth fixture');

		await page.goto('/account/memberships');
		await expect(page.getByRole('heading', { name: /my memberships/i })).toBeVisible();
	});
});
