import { test, expect } from '../../support/fixtures';
import {
	approveMembershipRequest,
	createOrganization,
	createVerifiedUser,
	requestMembership
} from '../../support/factories';
import { authenticateContext } from '../../support/session';
import { gotoHydrated, waitForClientAuth } from '../../support/navigation';
import { closeDialog } from '../../support/ui';

// J8.2 (USER_JOURNEYS.md) — staff management: promote an existing member to
// staff, edit their permissions, remove them from staff.
//
// Isolation: throwaway-owned org; the promoted member is a throwaway user
// arranged into ACTIVE membership via the request→approve API flow.
//
// Dialog note: staff removal uses a native confirm() and several failure
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
		const dialogs: string[] = [];
		page.on('dialog', (dialog) => {
			dialogs.push(dialog.message());
			void dialog.accept();
		});

		await gotoHydrated(page, `/org/${org.slug}/admin/members`);
		await waitForClientAuth(page);

		// Promote: member card → manage modal → Make Staff Member → they show
		// up on the staff tab. Clicks on the small viewport are occasionally
		// dropped mid re-render (dialog open/close animations + query settles),
		// so the whole sequence is an idempotent loop keyed on the outcome.
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
				await page.getByRole('tab', { name: /^Members/ }).click({ timeout: 3_000 });
				await page.getByRole('button', { name: `Manage ${memberName}` }).click({ timeout: 3_000 });
				await manageModal
					.getByRole('button', { name: 'Make Staff Member' })
					.click({ timeout: 3_000 });
				await closeDialog(page, manageModal);
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

		// Remove from staff (native confirm, auto-accepted by the handler).
		const staffEmpty = page.getByText('No staff members found');
		await expect(async () => {
			if (!(await staffEmpty.isVisible()) && (await staffCard.isVisible())) {
				await staffCard
					.getByRole('button', { name: `Remove ${memberName} from staff` })
					.click({ timeout: 3_000 });
			}
			await expect(staffEmpty).toBeVisible({ timeout: 5_000 });
		}).toPass({ timeout: 60_000 });

		// The only native dialog should have been the removal confirm.
		expect(dialogs.filter((m) => !m.startsWith('Are you sure'))).toHaveLength(0);

		await context.close();
	});
});
