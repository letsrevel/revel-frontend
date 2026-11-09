import { test, expect } from '../../support/fixtures';
import {
	createMembershipTier,
	createOrganization,
	createVerifiedUser,
	requestMembership
} from '../../support/factories';
import { authenticateContext } from '../../support/session';
import { waitForEmail } from '../../support/mailpit';
import { gotoHydrated, waitForClientAuth } from '../../support/navigation';
import { closeDialog, pickSelectOption } from '../../support/ui';
import { registerPath } from '../../support/member-register';

// J8.3 (USER_JOURNEYS.md) — member management: approve a membership request
// with a tier, reject another, pause the approved member from the person sheet,
// check the ban confirmation (behind the inline ban confirmation), remove them.
//
// Isolation: throwaway-owned org accepting requests; two throwaway
// applicants. A SECOND membership tier is arranged so approval goes through
// the tier-selection modal (with a single tier the UI auto-approves).
//
// Failure paths in these flows use native alert() — the dialog handler
// accepts and records everything; unexpected messages fail the test.

test.describe('J8 member management @p1', () => {
	test('approve request with tier, reject request, pause, ban and remove member', async ({
		browser
	}) => {
		// Outcome-keyed retry loops below need headroom beyond the default 90s.
		test.setTimeout(240_000);

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
		await page.getByRole('tab', { name: 'Applications' }).click();

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
		// The approved applicant is notified by email (regression: BE #673 —
		// the notification used to die on missing context keys).
		await waitForEmail({ to: applicant.email, subject: 'pproved' });

		// Reject the other request → pending list is empty.
		await page.getByRole('button', { name: `Reject request from ${rejectedName}` }).click();
		await expect(page.getByText('No pending requests')).toBeVisible({ timeout: 15_000 });

		// The approved applicant is an active member; pause them from the person
		// sheet (People row -> sheet -> Manage membership). Small viewports
		// occasionally drop clicks mid re-render, so the modal sequences run as
		// idempotent loops keyed on the visible outcome.
		await gotoHydrated(page, registerPath(org.slug, 'current'));
		await waitForClientAuth(page);
		const sheet = page.getByRole('dialog', { name: applicantName, exact: true });
		const manageModal = page.getByRole('dialog', { name: `Manage ${applicantName}` });
		const openManage = async () => {
			if (!(await sheet.isVisible())) {
				await page
					.getByRole('button', { name: `Open ${applicantName}` })
					.first()
					.click({ timeout: 3_000 });
			}
			await sheet.getByRole('button', { name: 'Manage membership' }).click({ timeout: 3_000 });
		};
		const pausedBadge = sheet.getByTestId('register-status-paused');
		await expect(async () => {
			await closeDialog(page, manageModal);
			if (!(await pausedBadge.isVisible())) {
				await openManage();
				await pickSelectOption(page, manageModal.getByLabel('Membership Status'), 'Paused');
				const save = manageModal.getByRole('button', { name: 'Save Changes' });
				if (await save.isVisible()) {
					await save.click({ timeout: 3_000 });
				}
				await closeDialog(page, manageModal);
			}
			await expect(pausedBadge).toBeVisible({ timeout: 5_000 });
		}).toPass({ timeout: 90_000 });

		// Banning is gated behind an inline confirmation because the backend also
		// cancels the member's subscription and stops Stripe billing (BE d4570cf3)
		// — "Save Changes" only opens the panel; the ban lands on "Yes, Ban
		// Member". The ban ENDS the register entry, which takes the person off the
		// Current list and out of reach of the member actions, so this run only
		// checks the confirmation panel and backs out; the member is removed next.
		// (Executing a ban is covered by the blacklist journeys, j13.)
		await expect(async () => {
			await closeDialog(page, manageModal);
			await openManage();
			await pickSelectOption(page, manageModal.getByLabel('Membership Status'), 'Banned');
			const save = manageModal.getByRole('button', { name: 'Save Changes' });
			if (await save.isVisible()) {
				await save.click({ timeout: 3_000 });
			}
			// The confirm panel — not the ban — is what "Save Changes" produces.
			await expect(manageModal.getByRole('button', { name: 'Yes, Ban Member' })).toBeVisible({
				timeout: 5_000
			});
			await expect(
				manageModal.getByText(/lose access to every event in this organization/).first()
			).toBeVisible();
			// This member holds a tier but pays nothing, so the panel must NOT
			// claim a subscription is being cancelled (BE #805 / FE: the billing
			// sentence is now conditional on an inlined live subscription).
			await expect(manageModal.getByText(/recurring billing stops/)).toHaveCount(0);
		}).toPass({ timeout: 90_000 });
		await closeDialog(page, manageModal);
		await expect(pausedBadge).toBeVisible();

		// Remove the member entirely: the entry ends and the sheet stays open,
		// re-rendered as an ended membership ("Ended: removed" in its periods).
		// The Current view is read as of today and the entry ends today, so the
		// row stays in the list, now flagged Ended (and has no member actions).
		const personRow = page.getByRole('button', { name: `Open ${applicantName}` });
		const endedBadge = sheet.getByTestId('register-status-ended');
		await expect(async () => {
			await closeDialog(page, manageModal);
			if (!(await endedBadge.isVisible())) {
				await openManage();
				await manageModal
					.getByRole('button', { name: 'Remove from Organization' })
					.click({ timeout: 3_000 });
				await manageModal.getByRole('button', { name: 'Yes, Remove' }).click({ timeout: 3_000 });
			}
			await expect(endedBadge).toBeVisible({ timeout: 5_000 });
		}).toPass({ timeout: 90_000 });
		await expect(sheet.getByTestId('person-periods')).toContainText('Ended: removed');
		await closeDialog(page, sheet);
		await expect(personRow).toHaveCount(1, { timeout: 15_000 });
		await expect(
			page
				.locator('[data-testid="register-row"], [data-testid="register-card"]')
				.filter({
					has: personRow
				})
				.filter({ visible: true })
				.getByTestId('register-status-ended')
		).toBeVisible();

		expect(dialogs).toHaveLength(0);

		await context.close();
	});
});
