import { test, expect } from '../../support/fixtures';

// J1.9 (USER_JOURNEYS.md) — the public legal pages (privacy/terms, backend
// Markdown) and a representative marketing landing page render in English
// with a level-1 heading and a 200 response. Read-only, no arrange.

test.describe('J01 legal & marketing pages @p2', () => {
	const pages = [
		{ path: '/legal/privacy', heading: 'Privacy Policy' },
		{ path: '/legal/terms', heading: 'Terms of Service' },
		{ path: '/privacy-focused-events', heading: 'Event Management That Respects Privacy' }
	];

	for (const { path, heading } of pages) {
		test(`renders ${path}`, async ({ page }) => {
			const response = await page.goto(path);
			expect(response?.status()).toBe(200);
			await expect(page.getByRole('heading', { level: 1, name: heading })).toBeVisible();
		});
	}
});
