import { test, expect } from '../../support/fixtures';
import {
	approveMembershipRequest,
	createOrganization,
	createVerifiedUser,
	requestMembership
} from '../../support/factories';
import { authenticateContext } from '../../support/session';
import { gotoHydrated, waitForClientAuth } from '../../support/navigation';
import { closeDialog, confirmInApp } from '../../support/ui';
import { registerPath } from '../../support/member-register';

// J8.5 (USER_JOURNEYS.md) — staff management: promote an existing member to
// staff, edit their permissions, remove them from staff.
//
// Isolation: throwaway-owned org; the promoted member is a throwaway user
// arranged into ACTIVE membership via the request→approve API flow.
//
// Dialog note: staff removal uses the in-app confirm dialog and several failure
// paths use native alert() — a page dialog handler accepts everything and
// records the messages so unexpected alerts fail the test at the end.

test.describe('J8 staff management @p1', () => {
	test('promote member → staff, edit permissions, remove from staff', async ({ browser }) => {
		// Outcome-keyed retry loops below need headroom beyond the default 90s.
		test.setTimeout(180_000);

		const [org, member] = await Promise.all([
			createOrganization({ acceptMembershipRequests: true }),
			createVerifiedUser('StaffCandidate')
		]);
		const request = await requestMembership(member, org.slug);
		await approveMembershipRequest(org.owner, org.slug, request.id, org.defaultTierId);
		const memberName = `${member.firstName} ${member.lastName}`;

		const context = await browser.newContext();
		await authenticateContext(context, org.owner);
		const page = await context.newPage();
		// Any NATIVE dialog is a regression (#1193): collect them to assert none appear.
		const dialogs: string[] = [];
		page.on('dialog', (dialog) => {
			dialogs.push(dialog.message());
			void dialog.accept();
		});

		await gotoHydrated(page, registerPath(org.slug, 'current'));
		await waitForClientAuth(page);

		// Promote: People row → person sheet → Manage membership → Make Staff Member → they show
		// up on the staff tab. Clicks on the small viewport are occasionally
		// dropped mid re-render (dialog open/close animations + query settles),
		// so the whole sequence is an idempotent loop keyed on the outcome.
		const sheet = page.getByRole('dialog', { name: memberName, exact: true });
		const manageModal = page.getByRole('dialog', { name: `Manage ${memberName}` });
		const staffTab = page.getByRole('tab', { name: /^Staff/ });
		const staffCard = page
			.locator('article, li, div')
			.filter({ hasText: memberName })
			.filter({ has: page.getByRole('button', { name: `Edit permissions for ${memberName}` }) })
			.first();
		await expect(async () => {
			await closeDialog(page, manageModal);
			await staffTab.click({ timeout: 3_000 });
			if (!(await staffCard.isVisible())) {
				await gotoHydrated(page, registerPath(org.slug, 'current'));
				await waitForClientAuth(page);
				await page
					.getByRole('button', { name: `Open ${memberName}` })
					.first()
					.click({
						timeout: 3_000
					});
				await sheet.getByRole('button', { name: 'Manage membership' }).click({ timeout: 3_000 });
				await manageModal
					.getByRole('button', { name: 'Make Staff Member' })
					.click({ timeout: 3_000 });
				await closeDialog(page, manageModal);
				await closeDialog(page, sheet);
				await staffTab.click({ timeout: 3_000 });
			}
			await expect(staffCard).toBeVisible({ timeout: 5_000 });
		}).toPass({ timeout: 90_000 });

		// Edit permissions: flip the first toggle, save, reopen, expect it kept.
		const permissionsDialog = page.getByRole('dialog', {
			name: `Edit Permissions for ${memberName}`
		});
		await expect(async () => {
			if (!(await permissionsDialog.isVisible())) {
				await page
					.getByRole('button', { name: `Edit permissions for ${memberName}` })
					.click({ timeout: 3_000 });
			}
			await expect(permissionsDialog).toBeVisible({ timeout: 3_000 });
		}).toPass({ timeout: 30_000 });
		const firstPermission = permissionsDialog.getByRole('checkbox').first();
		const initialState = await firstPermission.isChecked();
		await firstPermission.setChecked(!initialState);
		await permissionsDialog.getByRole('button', { name: 'Save Changes' }).click();
		await expect(permissionsDialog).not.toBeVisible({ timeout: 15_000 });

		await expect(async () => {
			if (!(await permissionsDialog.isVisible())) {
				await page
					.getByRole('button', { name: `Edit permissions for ${memberName}` })
					.click({ timeout: 3_000 });
			}
			await expect(permissionsDialog).toBeVisible({ timeout: 3_000 });
		}).toPass({ timeout: 30_000 });
		await expect(permissionsDialog.getByRole('checkbox').first()).toBeChecked({
			checked: !initialState
		});
		await closeDialog(page, permissionsDialog);

		// Remove from staff (in-app confirm dialog).
		const staffEmpty = page.getByText('No staff members found');
		await expect(async () => {
			if (!(await staffEmpty.isVisible()) && (await staffCard.isVisible())) {
				await staffCard
					.getByRole('button', { name: `Remove ${memberName} from staff` })
					.click({ timeout: 3_000 });
				await confirmInApp(page);
			}
			await expect(staffEmpty).toBeVisible({ timeout: 5_000 });
		}).toPass({ timeout: 60_000 });

		// The removal confirm is in-app now: no native dialog may have fired.
		expect(dialogs).toHaveLength(0);

		await context.close();
	});
});
