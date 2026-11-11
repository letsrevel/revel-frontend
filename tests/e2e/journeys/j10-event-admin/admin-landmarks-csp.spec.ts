import { test, expect } from '../../support/fixtures';
import { createOrganization } from '../../support/factories';
import { authenticateContext } from '../../support/session';
import { gotoHydrated, waitForClientAuth } from '../../support/navigation';

// Regression guards for #1193: the org admin shell renders exactly one `main`
// landmark and one `#main-content`, the skip link lands focus past the admin
// sidebar, and /admin/events attaches no inline event handlers (a CSP violation
// under the nonce-based production policy).

const ADMIN_PAGES = [
	'',
	'/events',
	'/members',
	'/venues',
	'/settings',
	'/billing',
	'/tickets',
	'/discount-codes'
];

test.describe('Admin shell landmarks and CSP @p2', () => {
	test('admin pages: one main, one #main-content, skip link bypasses the sidebar', async ({
		browser
	}) => {
		test.setTimeout(150_000);
		const org = await createOrganization();
		const context = await browser.newContext();
		await authenticateContext(context, org.owner);
		const page = await context.newPage();

		for (const sub of ADMIN_PAGES) {
			await gotoHydrated(page, `/org/${org.slug}/admin${sub}`);
			await waitForClientAuth(page);
			await expect(page.getByRole('heading', { level: 1 }).first()).toBeVisible();
			await expect(page.locator('main'), `main count on ${sub || '/'}`).toHaveCount(1);
			await expect(page.locator('#main-content'), `#main-content on ${sub || '/'}`).toHaveCount(1);
		}

		// Skip link: the skip link is focused; activating it must move focus
		// to #main-content, i.e. past the admin sidebar navigation.
		await gotoHydrated(page, `/org/${org.slug}/admin`);
		await waitForClientAuth(page);
		const skip = page.getByRole('link', { name: 'Skip to main content' });
		await skip.focus();
		await expect(skip).toBeFocused();
		await page.keyboard.press('Enter');
		await expect(page.locator('#main-content')).toBeFocused();
		await context.close();
	});

	test('/admin/events logs no inline-event-handler CSP errors', async ({ browser }) => {
		const org = await createOrganization();
		const context = await browser.newContext();
		await authenticateContext(context, org.owner);
		const page = await context.newPage();

		const violations: string[] = [];
		page.on('console', (msg) => {
			const text = msg.text();
			if (/inline event handler|Content Security Policy|Content-Security-Policy/i.test(text)) {
				violations.push(text);
			}
		});
		page.on('pageerror', (err) => violations.push(err.message));

		await gotoHydrated(page, `/org/${org.slug}/admin/events`);
		await waitForClientAuth(page);
		await expect(page.getByRole('heading', { level: 1 }).first()).toBeVisible();
		await page.waitForLoadState('networkidle');

		expect(violations).toEqual([]);
		await context.close();
	});
});
