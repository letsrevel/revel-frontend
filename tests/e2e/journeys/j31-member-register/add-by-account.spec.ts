import type { Locator, Page } from '@playwright/test';
import { test, expect } from '../../support/fixtures';
import {
	approveMembershipRequest,
	createOrganization,
	createVerifiedUser,
	requestMembership,
	uniqueEmail,
	type CreatedOrg
} from '../../support/factories';
import { authenticateContext } from '../../support/session';
import { gotoHydrated, waitForClientAuth } from '../../support/navigation';
import { registerEntry, registerPath } from '../../support/member-register';

// "Add by account": staff look a verified account up by its exact email and add
// it straight to a standard tier. The accounts are throwaway users (not seeded
// personas): the lookup is throttled per STAFF user, and a fresh owner per spec
// keeps each run on its own quota and re-runnable.

async function openDialog(page: Page, org: CreatedOrg): Promise<Locator> {
	await gotoHydrated(page, registerPath(org.slug));
	await waitForClientAuth(page);
	await page.getByRole('button', { name: 'Add person' }).click();
	await page.getByRole('menuitem', { name: 'Add by account' }).click();
	const dialog = page.getByRole('dialog', { name: 'Add by account' });
	await expect(dialog).toBeVisible();
	// Initial focus lands on the email input.
	await expect(dialog.getByLabel('Account email')).toBeFocused();
	return dialog;
}

async function findAccount(dialog: Locator, email: string): Promise<void> {
	await dialog.getByLabel('Account email').fill(email);
	await dialog.getByRole('button', { name: 'Find account' }).click();
}

test.describe('J31 add a member by account @p1', () => {
	test('unknown email: neutral not-found and the invite-link CTA', async ({ browser }) => {
		test.setTimeout(180_000);
		const org = await createOrganization();
		const context = await browser.newContext();
		await authenticateContext(context, org.owner);
		const page = await context.newPage();
		try {
			const dialog = await openDialog(page, org);
			await findAccount(dialog, uniqueEmail('Nobody'));
			await expect(dialog.getByText(/No verified account uses this email/)).toBeVisible({
				timeout: 15_000
			});
			await dialog.getByRole('button', { name: 'Create an invite link instead' }).click();
			await expect(dialog).toBeHidden();
			// The invite-link dialog is the one the "Add person" menu opens.
			await expect(page.getByRole('dialog').first()).toBeVisible();
		} finally {
			await context.close();
		}
	});

	test('existing member: "Open person" opens their sheet', async ({ browser }) => {
		test.setTimeout(240_000);
		const org = await createOrganization({ acceptMembershipRequests: true });
		const member = await createVerifiedUser('ByAccountMember');
		const request = await requestMembership(member, org.slug);
		await approveMembershipRequest(org.owner, org.slug, request.id, org.defaultTierId);
		const memberName = `${member.firstName} ${member.lastName}`;

		const context = await browser.newContext();
		await authenticateContext(context, org.owner);
		const page = await context.newPage();
		try {
			const dialog = await openDialog(page, org);
			await findAccount(dialog, member.email);
			await expect(dialog.getByText(/already has a membership here/)).toBeVisible({
				timeout: 15_000
			});
			await dialog.getByRole('button', { name: 'Open person' }).click();
			await expect(dialog).toBeHidden();
			await expect(page.getByRole('dialog', { name: memberName, exact: true })).toBeVisible({
				timeout: 15_000
			});
		} finally {
			await context.close();
		}
	});

	test('verified non-member: add with a tier and the row appears in People', async ({
		browser
	}) => {
		test.setTimeout(240_000);
		const org = await createOrganization();
		const person = await createVerifiedUser('ByAccountNew');
		const personName = `${person.firstName} ${person.lastName}`;

		const context = await browser.newContext();
		await authenticateContext(context, org.owner);
		const page = await context.newPage();
		try {
			const dialog = await openDialog(page, org);
			await findAccount(dialog, person.email);
			await expect(dialog.getByText(/Account found/)).toBeVisible({ timeout: 15_000 });
			// The org has a single standard tier, so it is preselected.
			await expect(dialog.getByLabel('Tier')).toHaveValue(org.defaultTierId);
			await dialog.getByRole('button', { name: 'Add as member' }).click();
			await expect(dialog).toBeHidden({ timeout: 15_000 });

			// The sheet opens on the new member...
			const sheet = page.getByRole('dialog', { name: personName, exact: true });
			await expect(sheet).toBeVisible({ timeout: 15_000 });
			await page.keyboard.press('Escape');
			await expect(sheet).toBeHidden();

			// ...and the row is in the People list.
			await expect(registerEntry(page, personName)).toBeVisible({ timeout: 15_000 });
		} finally {
			await context.close();
		}
	});
});
