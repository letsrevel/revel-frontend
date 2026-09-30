import { test, expect } from '../../support/fixtures';
import { createOrganization, createVerifiedUser } from '../../support/factories';
import { authenticateContext } from '../../support/session';
import { gotoHydrated, waitForClientAuth } from '../../support/navigation';

// J3.9 / J15.3 (USER_JOURNEYS.md) — announcement mute: any signed-in user
// (members and attendees, not only followers) can mute an organization's
// announcements from its page; muted organizations are listed in account
// settings with unmute. For followers the follow menu's announcements toggle
// is the same mute, so the separate button is hidden, and following never
// un-mutes.
//
// Isolation: a fresh public org and a throwaway user (mutes are per user).

test.describe('J03 muted organizations @p2', () => {
	test('mute from the org page, see it in settings, unmute there', async ({ browser }) => {
		const [org, user] = await Promise.all([
			createOrganization({ publicVisibility: true }),
			createVerifiedUser('Muter')
		]);
		const context = await browser.newContext();
		await authenticateContext(context, user);
		const page = await context.newPage();

		await gotoHydrated(page, `/org/${org.slug}`);
		await waitForClientAuth(page);
		await page.getByRole('button', { name: 'Mute announcements' }).click();
		await expect(page.getByText(`Announcements from ${org.name} are muted.`)).toBeVisible();
		await expect(page.getByRole('button', { name: 'Unmute announcements' })).toBeVisible();

		await gotoHydrated(page, '/account/settings');
		await waitForClientAuth(page);
		const card = page.getByRole('region', { name: 'Muted organizations' });
		await expect(card.getByRole('link', { name: org.name })).toHaveAttribute(
			'href',
			`/org/${org.slug}`
		);
		await card.getByRole('button', { name: `Unmute announcements from ${org.name}` }).click();
		await expect(card.getByText('No muted organizations')).toBeVisible();
	});

	test('following keeps the mute, and the follow menu shows it', async ({ browser }) => {
		const [org, user] = await Promise.all([
			createOrganization({ publicVisibility: true }),
			createVerifiedUser('MuteFollower')
		]);
		const context = await browser.newContext();
		await authenticateContext(context, user);
		const page = await context.newPage();

		await gotoHydrated(page, `/org/${org.slug}`);
		await waitForClientAuth(page);
		await page.getByRole('button', { name: 'Mute announcements' }).click();
		await expect(page.getByRole('button', { name: 'Unmute announcements' })).toBeVisible();

		await page.getByRole('button', { name: 'Follow', exact: true }).click();
		await expect(page.getByText(`You are now following ${org.name}`)).toBeVisible({
			timeout: 15_000
		});
		// Followers manage the same mute from the follow menu instead.
		await expect(page.getByRole('button', { name: /mute announcements/i })).toHaveCount(0);
		await page.getByRole('button', { name: 'Following' }).click();
		await expect(
			page.getByRole('menuitemcheckbox', { name: 'Notify me about announcements' })
		).toHaveAttribute('aria-checked', 'false');
	});
});
