import { test, expect } from '../../support/fixtures';
import {
	createMembershipTier,
	createOrganization,
	createVerifiedUser,
	requestMembership
} from '../../support/factories';
import { authenticateContext } from '../../support/session';
import { gotoHydrated, waitForClientAuth } from '../../support/navigation';
import { closeDialog, pickSelectOption } from '../../support/ui';

// J8.3 (USER_JOURNEYS.md) — member management: approve a membership request
// with a tier, reject another, pause the approved member, remove them.
//
// Isolation: throwaway-owned org accepting requests; two throwaway
// applicants. A SECOND membership tier is arranged so approval goes through
// the tier-selection modal (with a single tier the UI auto-approves).
//
// Failure paths in these flows use native alert() — the dialog handler
// accepts and records everything; unexpected messages fail the test.

test.describe('J8 member management @p1', () => {
	test('approve request with tier, reject request, pause and remove member', async ({
		browser
	}) => {
		// Outcome-keyed retry loops below need headroom beyond the default 90s.
		test.setTimeout(180_000);

		const org = await createOrganization({ acceptMembershipRequests: true });
		const [applicant, rejected] = await Promise.all([
			createVerifiedUser('Applicant'),
			createVerifiedUser('Rejected')
		]);
		await createMembershipTier(org.owner, org.slug, 'Premium');
		await Promise.all([
			requestMembership(applicant, org.slug, 'Please let me in'),
			requestMembership(rejected, org.slug)
		]);
		const applicantName = `${applicant.firstName} ${applicant.lastName}`;
		const rejectedName = `${rejected.firstName} ${rejected.lastName}`;

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
		await page.getByRole('tab', { name: 'Requests' }).click();

		// Approve with tier: two tiers exist, so the tier-selection modal opens.
		await page.getByRole('button', { name: `Approve request from ${applicantName}` }).click();
		const approveModal = page.getByRole('dialog', { name: 'Approve Membership Request' });
		await expect(approveModal).toBeVisible();
		await pickSelectOption(page, approveModal.getByLabel('Membership Tier'), 'Premium');
		await approveModal.getByRole('button', { name: 'Approve Request' }).click();
		await expect(approveModal).not.toBeVisible({ timeout: 15_000 });
		await expect(
			page.getByRole('button', { name: `Approve request from ${applicantName}` })
		).not.toBeVisible();

		// Reject the other request → pending list is empty.
		await page.getByRole('button', { name: `Reject request from ${rejectedName}` }).click();
		await expect(page.getByText('No pending requests')).toBeVisible({ timeout: 15_000 });

		// The approved applicant is an active member; pause them. (Tab names
		// carry count badges, e.g. "Members (1)" — match on the prefix.) Small
		// viewports occasionally drop clicks mid re-render, so the modal
		// sequences run as idempotent loops keyed on the visible outcome.
		await page.getByRole('tab', { name: /^Members/ }).click();
		const manageModal = page.getByRole('dialog', { name: `Manage ${applicantName}` });
		const pausedCard = page
			.locator('article, li, div')
			.filter({ hasText: applicantName })
			.filter({ hasText: /Paused/ })
			.first();
		await expect(async () => {
			await closeDialog(page, manageModal);
			if (!(await pausedCard.isVisible())) {
				await page.getByRole('button', { name: `Manage ${applicantName}` }).click({
					timeout: 3_000
				});
				await pickSelectOption(page, manageModal.getByLabel('Membership Status'), 'Paused');
				const save = manageModal.getByRole('button', { name: 'Save Changes' });
				if (await save.isVisible()) {
					await save.click({ timeout: 3_000 });
				}
				await closeDialog(page, manageModal);
			}
			await expect(pausedCard).toBeVisible({ timeout: 5_000 });
		}).toPass({ timeout: 90_000 });

		// Remove the member entirely.
		const membersEmpty = page.getByText('No members found');
		await expect(async () => {
			await closeDialog(page, manageModal);
			if (!(await membersEmpty.isVisible())) {
				await page.getByRole('button', { name: `Manage ${applicantName}` }).click({
					timeout: 3_000
				});
				await manageModal
					.getByRole('button', { name: 'Remove from Organization' })
					.click({ timeout: 3_000 });
				await manageModal.getByRole('button', { name: 'Yes, Remove' }).click({ timeout: 3_000 });
			}
			await expect(membersEmpty).toBeVisible({ timeout: 5_000 });
		}).toPass({ timeout: 90_000 });

		expect(dialogs).toHaveLength(0);

		await context.close();
	});
});
