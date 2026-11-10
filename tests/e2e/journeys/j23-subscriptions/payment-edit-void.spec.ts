import type { Page } from '@playwright/test';
import { test, expect } from '../../support/fixtures';
import {
	approveMembershipRequest,
	createOrganization,
	createSubscriptionPlan,
	createVerifiedUser,
	requestMembership,
	uniqueName
} from '../../support/factories';
import { authenticateContext } from '../../support/session';
import { gotoHydrated, waitForClientAuth } from '../../support/navigation';
import { toDatetimeLocal } from '../../support/member-register';

// J23 — correcting a recorded membership payment. Before this, a payment saved
// for a member could not be touched: a mistyped amount or a payment that was
// really made last month stayed wrong forever.
//
// Arrange: an OFFLINE plan and an approved member, then ONE subscription
// created through the real "Create subscription" dialog with a BACKDATED
// initial payment (so the dialog's new "Payment date" field is part of the
// journey, not just the API behind it). Act, all inside the subscription
// drawer: edit the amount and the date, void the payment, then reveal it again
// with "Include voided payments".
//
// Everything is arranged inside the test body on a throwaway org, so a retry
// never inherits the previous attempt's payment.

const DAY_MS = 24 * 60 * 60 * 1000;

/** `formatDate` renders a SHORT textual month, e.g. "Aug 7, 2026" (en locale). */
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function shortDate(date: Date): string {
	return `${MONTHS[date.getMonth()]} ${date.getDate()}, ${date.getFullYear()}`;
}

async function openDrawer(admin: Page, memberName: string) {
	const drawer = admin.getByRole('dialog').filter({ hasText: memberName });
	try {
		await expect(drawer).toBeVisible({ timeout: 10_000 });
	} catch {
		// The drawer auto-opens on the fresh subscription; open the row ourselves
		// if that handoff is missed under load.
		await admin
			.getByRole('button', { name: 'Open subscription details' })
			.or(admin.getByRole('button', { name: new RegExp(memberName) }))
			.filter({ visible: true })
			.first()
			.click({ timeout: 5_000 });
		await expect(drawer).toBeVisible({ timeout: 10_000 });
	}
	return drawer;
}

test.describe('J23 edit and void a membership payment @p2', () => {
	test('backdated first payment → edit amount and date → void → shown again as Voided', async ({
		browser
	}) => {
		test.setTimeout(150_000);

		const [org, member] = await Promise.all([
			createOrganization({ acceptMembershipRequests: true }),
			createVerifiedUser('PayEdit')
		]);
		const request = await requestMembership(member, org.slug);
		await approveMembershipRequest(org.owner, org.slug, request.id, org.defaultTierId);
		const plan = await createSubscriptionPlan(org.owner, org.slug, org.defaultTierId, {
			name: uniqueName('Edit Plan'),
			price: '15.00',
			currency: 'EUR',
			payment_method: 'offline'
		});

		const context = await browser.newContext();
		await authenticateContext(context, org.owner);
		const admin = await context.newPage();
		await gotoHydrated(admin, `/org/${org.slug}/admin/members`);
		await waitForClientAuth(admin);

		// --- Create with a payment made 10 days ago -----------------------------
		const paidOn = new Date(Date.now() - 10 * DAY_MS);
		await admin.getByRole('tab', { name: /Subs/ }).click();
		await admin.getByRole('button', { name: 'Create subscription' }).click();
		const createDialog = admin.getByRole('dialog', { name: 'Create subscription' });
		await createDialog.locator('input[role="combobox"]').fill('PayEdit');
		await createDialog
			.getByRole('option', { name: /E2E PayEdit/ })
			.first()
			.click();
		await createDialog.locator('#sub-plan').selectOption(plan.id);
		await createDialog.getByRole('checkbox', { name: 'Record initial payment' }).click();
		await createDialog.locator('#sub-amt').fill('15');
		await expect(
			createDialog.getByText(/membership start date is edited separately, in the register entry/)
		).toBeVisible();
		await createDialog.getByLabel('Payment date').fill(toDatetimeLocal(paidOn));
		await createDialog.getByRole('button', { name: 'Create', exact: true }).click();
		await expect(createDialog).toBeHidden({ timeout: 15_000 });

		const drawer = await openDrawer(admin, 'E2E PayEdit');
		const editButton = drawer.getByRole('button', { name: /^Edit the payment of/ });

		// POSITIVE ANCHORS: the payment exists and shows the BACKDATED day, not today.
		await expect(drawer.getByText('€15.00', { exact: true }).first()).toBeVisible({
			timeout: 15_000
		});
		await expect(drawer.getByText(shortDate(paidOn)).first()).toBeVisible();
		await expect(editButton).toBeVisible();

		// --- Edit amount and date ----------------------------------------------
		const newDate = new Date(Date.now() - 5 * DAY_MS);
		await editButton.click();
		const editDialog = admin.getByRole('dialog', { name: 'Edit payment' });
		await expect(editDialog).toBeVisible();
		// Currency is shown but cannot be changed.
		await expect(editDialog.getByLabel('Currency')).toHaveAttribute('readonly', '');
		await editDialog.getByLabel('Amount').fill('20');
		await editDialog.getByLabel('Payment date').fill(toDatetimeLocal(newDate));
		await editDialog.getByRole('button', { name: 'Save changes' }).click();
		await expect(editDialog).toBeHidden({ timeout: 20_000 });
		await expect(admin.getByText('Payment updated.')).toBeVisible({ timeout: 15_000 });

		await expect(drawer.getByText('€20.00', { exact: true }).first()).toBeVisible({
			timeout: 15_000
		});
		await expect(drawer.getByText(shortDate(newDate)).first()).toBeVisible();
		await expect(drawer.getByText('€15.00', { exact: true })).toHaveCount(0);

		// --- Void ----------------------------------------------------------------
		await drawer.getByRole('button', { name: /^Void the payment of/ }).click();
		const voidDialog = admin.getByRole('dialog', { name: 'Void this payment?' });
		await expect(voidDialog).toBeVisible();
		await expect(
			voidDialog.getByText(/removes this payment from totals and lists and recalculates/)
		).toBeVisible();
		await voidDialog.getByLabel('Reason (optional)').fill('E2E entered by mistake');
		await voidDialog.getByRole('button', { name: 'Void payment' }).click();
		await expect(voidDialog).toBeHidden({ timeout: 20_000 });
		await expect(
			admin.getByText('Payment voided. The membership period was recalculated.')
		).toBeVisible({ timeout: 15_000 });

		// It disappears from the default list…
		await expect(drawer.getByText('No payments yet.')).toBeVisible({ timeout: 15_000 });
		await expect(drawer.getByText('€20.00', { exact: true })).toHaveCount(0);

		// …and comes back, as Voided and without any action, when asked for.
		await drawer.getByLabel('Include voided payments').check();
		await expect(drawer.getByText('€20.00', { exact: true }).first()).toBeVisible({
			timeout: 15_000
		});
		await expect(drawer.getByTestId('status-badge').filter({ hasText: 'Voided' })).toBeVisible();
		await expect(drawer.getByRole('button', { name: /^Edit the payment of/ })).toHaveCount(0);
		await expect(drawer.getByRole('button', { name: /^Void the payment of/ })).toHaveCount(0);

		await context.close();
	});
});
