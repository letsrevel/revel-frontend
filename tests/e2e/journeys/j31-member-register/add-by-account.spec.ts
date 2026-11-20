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
import { registerPath } from '../../support/member-register';

// "Invite by account": staff look a verified account up by its exact email and invite
// it to a standard tier (it becomes a member once it accepts). The accounts are throwaway users (not seeded
// personas): the lookup is throttled per STAFF user, and a fresh owner per spec
// keeps each run on its own quota and re-runnable.

async function openDialog(page: Page, org: CreatedOrg): Promise<Locator> {
	await gotoHydrated(page, registerPath(org.slug));
	await waitForClientAuth(page);
	await page.getByRole('button', { name: 'Add person' }).click();
	await page.getByRole('menuitem', { name: 'Invite by account' }).click();
	const dialog = page.getByRole('dialog', { name: 'Invite by account' });
	await expect(dialog).toBeVisible();
	// Initial focus lands on the email input.
	await expect(dialog.getByLabel('Account email')).toBeFocused();
	return dialog;
}

async function findAccount(dialog: Locator, email: string): Promise<void> {
	await dialog.getByLabel('Account email').fill(email);
	await dialog.getByRole('button', { name: 'Find account' }).click();
}

test.describe('J31 invite a member by account @p1', () => {
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

	test('verified non-member: invite, see it pending, then withdraw it', async ({ browser }) => {
		test.setTimeout(240_000);
		const org = await createOrganization();
		const person = await createVerifiedUser('ByAccountNew');
		const personName = `${person.firstName} ${person.lastName}`;

		const context = await browser.newContext();
		await authenticateContext(context, org.owner);
		const page = await context.newPage();
		try {
			let dialog = await openDialog(page, org);
			await findAccount(dialog, person.email);
			await expect(dialog.getByText(/Account found/)).toBeVisible({ timeout: 15_000 });
			// The org has a single standard tier, so it is preselected.
			await expect(dialog.getByLabel('Tier')).toHaveValue(org.defaultTierId);
			await dialog.getByRole('button', { name: 'Send invitation' }).click();
			await expect(dialog).toBeHidden({ timeout: 15_000 });

			// No member exists until they accept: the invitation is listed as pending.
			const pending = page.getByRole('region', { name: 'Pending invitations' });
			await expect(pending.getByText(personName)).toBeVisible({ timeout: 15_000 });

			// Looking them up again offers resend and withdraw.
			dialog = await openDialog(page, org);
			await findAccount(dialog, person.email);
			await expect(dialog.getByText(/pending membership invitation/)).toBeVisible({
				timeout: 15_000
			});
			await expect(dialog.getByRole('button', { name: 'Resend invitation' })).toBeVisible();
			await dialog.getByRole('button', { name: 'Withdraw invitation' }).click();
			await expect(dialog).toBeHidden({ timeout: 15_000 });
			await expect(pending).toBeHidden({ timeout: 15_000 });
		} finally {
			await context.close();
		}
	});
});
