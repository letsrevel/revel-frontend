import { test, expect } from '../../support/fixtures';
import {
	createOrganization,
	createTicketedEvent,
	createVerifiedUser,
	uniqueName
} from '../../support/factories';
import { authenticateContext } from '../../support/session';
import { gotoHydrated, waitForClientAuth } from '../../support/navigation';

// J8 (USER_JOURNEYS.md) — org blacklist admin: add an entry by email (which
// auto-links to the registered account and blocks them), add a name-only
// entry, remove it again. The blocked user's side is asserted on a public
// event of the org: the eligibility gate flips from the RSVP ask to the
// blacklist message.
//
// Isolation: throwaway-owned org + throwaway blocked user; the name-only
// entry uses a uniqueName() so fuzzy matching can never touch real personas.

test.describe('J8 blacklist admin @p2', () => {
	test('add by email blocks the user; name-only entry can be added and removed', async ({
		browser
	}) => {
		test.setTimeout(150_000);

		const org = await createOrganization();
		const blocked = await createVerifiedUser('Blocked');
		const event = await createTicketedEvent({
			owner: org.owner,
			orgSlug: org.slug,
			freeTier: false,
			event: { requires_ticket: false }
		});

		// Before: the user is an ordinary eligible visitor on the org's event.
		const blockedContext = await browser.newContext();
		await authenticateContext(blockedContext, blocked);
		const blockedPage = await blockedContext.newPage();
		await gotoHydrated(blockedPage, event.path);
		await waitForClientAuth(blockedPage);
		await expect(blockedPage.getByRole('heading', { name: 'Will you attend?' })).toBeVisible();

		// Admin adds them to the blacklist by email.
		const context = await browser.newContext();
		await authenticateContext(context, org.owner);
		const page = await context.newPage();
		await gotoHydrated(page, `/org/${org.slug}/admin/blacklist`);
		await waitForClientAuth(page);
		await expect(page.getByRole('heading', { name: 'Blacklist Management' })).toBeVisible();

		const modal = page.getByRole('dialog', { name: 'Add to Blacklist' });
		await page.getByRole('button', { name: 'Add to Blacklist' }).click();
		await expect(modal).toBeVisible();
		await modal.getByLabel('Email Address').fill(blocked.email);
		await modal.getByLabel('Reason for Blacklisting').fill('E2E blacklist journey');
		await modal.getByRole('button', { name: 'Add to Blacklist' }).click();
		await expect(modal).not.toBeVisible({ timeout: 15_000 });
		await expect(page.getByText(blocked.email).first()).toBeVisible();

		// The blocked user loses event access outright — a hard-blacklisted user
		// can't even SEE the org's events anymore: direct URL → 404.
		const blockedResponse = await blockedPage.goto(event.path);
		expect(blockedResponse?.status()).toBe(404);
		await expect(blockedPage.getByRole('heading', { name: 'Page Not Found' })).toBeVisible();

		// Name-only entry (no linked account) can be added…
		const alias = uniqueName('Alias');
		await page.getByRole('button', { name: 'Add to Blacklist' }).click();
		await expect(modal).toBeVisible();
		await modal.getByLabel('First Name').fill(alias);
		await modal.getByLabel('Last Name').fill('Doe');
		await modal.getByRole('button', { name: 'Add to Blacklist' }).click();
		await expect(modal).not.toBeVisible({ timeout: 15_000 });
		await expect(page.getByText(alias).first()).toBeVisible();

		// …and removed again through the entry's detail modal (Remove asks for an
		// inline confirmation step).
		await page.getByRole('button', { name: `Manage blacklist entry for ${alias} Doe` }).click();
		const entryModal = page.getByRole('dialog', { name: /Blacklist Entry/ });
		await expect(entryModal).toBeVisible();
		await entryModal.getByRole('button', { name: 'Remove from Blacklist' }).click();
		await entryModal.getByRole('button', { name: 'Confirm Remove' }).click();
		await expect(entryModal).not.toBeVisible({ timeout: 15_000 });
		await expect(page.getByText(alias)).toBeHidden({ timeout: 15_000 });

		await blockedContext.close();
		await context.close();
	});
});
