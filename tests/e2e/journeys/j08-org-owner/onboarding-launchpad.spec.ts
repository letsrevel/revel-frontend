import { test, expect } from '../../support/fixtures';
import { createVerifiedUser, uniqueName } from '../../support/factories';
import { authenticateContext } from '../../support/session';
import { gotoHydrated } from '../../support/navigation';

// Org onboarding launchpad — a brand-new owner creates an org through the
// two-field form, lands on /admin/welcome, publishes the (hidden) page from
// the visibility strip, starts the first event, and finds the owner-only setup
// card on the dashboard at "2 of 5 done" (created + public; no event saved).
// Stripe is deliberately not exercised (needs `stripe listen`).
//
// Isolation: throwaway verified user (one org per owner).

test.describe('J8 org onboarding launchpad @p1', () => {
	test('create org -> launchpad -> make public -> create event -> setup card', async ({
		browser
	}) => {
		test.setTimeout(120_000);
		const user = await createVerifiedUser('OrgOnboarder');
		const context = await browser.newContext();
		await authenticateContext(context, user);
		const page = await context.newPage();

		await gotoHydrated(page, '/create-org');
		await page.locator('#name').fill(uniqueName('Launchpad Org'));
		await page.locator('#contact_email').fill(user.email);
		await page.getByRole('button', { name: 'Create Organization' }).click();

		await page.waitForURL(/\/org\/([^/]+)\/admin\/welcome$/, { timeout: 30_000 });
		const slug = /\/org\/([^/]+)\/admin\/welcome$/.exec(page.url())?.[1] ?? '';
		expect(slug).not.toBe('');

		await expect(page.getByRole('heading', { name: 'Create your first event' })).toBeVisible();
		await expect(page.getByRole('heading', { name: 'Get paid for tickets' })).toBeVisible();

		// A fresh org is hidden: the strip offers to publish it.
		await expect(page.getByText('Your organization page is hidden')).toBeVisible();
		await page.getByRole('button', { name: 'Make page public' }).click();
		await expect(page.getByText(/Your page is public at/)).toBeVisible({ timeout: 15_000 });

		// Persisted: after a reload the strip is gone.
		await page.reload();
		await expect(page.getByRole('heading', { name: 'Create your first event' })).toBeVisible();
		await expect(page.getByText('Your organization page is hidden')).toHaveCount(0);
		await expect(page.getByRole('button', { name: 'Make page public' })).toHaveCount(0);

		// The event box leads into the event editor.
		await page.getByRole('link', { name: 'Create event' }).first().click();
		await page.waitForURL(new RegExp(`/org/${slug}/admin/events/new`), { timeout: 15_000 });

		// Dashboard setup card: created + public = 2 of 5, no event saved yet.
		await gotoHydrated(page, `/org/${slug}/admin`);
		await expect(page.getByText('Get set up · 2 of 5 done')).toBeVisible({ timeout: 15_000 });
		await expect(page.getByText('Create your first event').first()).toBeVisible();

		await context.close();
	});
});
