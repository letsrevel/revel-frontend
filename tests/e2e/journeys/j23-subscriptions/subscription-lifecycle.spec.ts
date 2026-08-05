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
import { membershipCard } from '../../support/membership-locators';
import { gotoHydrated, waitForClientAuth } from '../../support/navigation';

// J23 (USER_JOURNEYS.md) — subscription lifecycle: staff creates a
// subscription for an existing MEMBER and records the initial payment (the
// succeeded payment is what flips it PENDING → ACTIVE), the member sees the
// card under /account/memberships, then staff pause/resume/cancel and the
// member-facing status follows. The member side is deliberately READ-ONLY —
// pause/resume/cancel live only in the admin drawer.
//
// The subscribe target must already be an org member: the create-subscription
// MemberCombobox searches org MEMBERS only (the same trap as manage-rsvps'
// MemberCombobox), hence the requestMembership + approve arrange.

test.describe('J23 subscription lifecycle @p2', () => {
	test('create + record payment → member sees card → pause/resume/cancel', async ({ browser }) => {
		const [org, member] = await Promise.all([
			createOrganization({ acceptMembershipRequests: true }),
			createVerifiedUser('SubLife')
		]);
		const request = await requestMembership(member, org.slug);
		await approveMembershipRequest(org.owner, org.slug, request.id, org.defaultTierId);
		const plan = await createSubscriptionPlan(org.owner, org.slug, org.defaultTierId, {
			name: uniqueName('Plan'),
			price: '15.00'
		});

		// Admin: create the subscription with an initial payment.
		const adminContext = await browser.newContext();
		await authenticateContext(adminContext, org.owner);
		const admin = await adminContext.newPage();
		await gotoHydrated(admin, `/org/${org.slug}/admin/members`);
		await waitForClientAuth(admin);
		await admin.getByRole('tab', { name: /Subs/ }).click();
		await admin.getByRole('button', { name: 'Create subscription' }).click();

		const createDialog = admin.getByRole('dialog', { name: 'Create subscription' });
		// The member search input specifically — the native plan <select> also
		// carries an implicit combobox role.
		await createDialog.locator('input[role="combobox"]').fill('SubLife');
		await createDialog
			.getByRole('option', { name: /E2E SubLife/ })
			.first()
			.click();
		await createDialog.locator('#sub-plan').selectOption(plan.id);
		await createDialog.getByRole('checkbox', { name: 'Record initial payment' }).click();
		await createDialog.locator('#sub-amt').fill('15');
		await createDialog.getByRole('button', { name: 'Create', exact: true }).click();
		await expect(createDialog).toBeHidden({ timeout: 15_000 });

		// The drawer auto-opens on the fresh subscription; if that handoff is
		// missed under load, open the row ourselves. The row's accessible name
		// differs per layout: the desktop table row is aria-labelled "Open
		// subscription details", the mobile card exposes its content text.
		const drawer = admin.getByRole('dialog').filter({ hasText: 'E2E SubLife' });
		try {
			await expect(drawer).toBeVisible({ timeout: 10_000 });
		} catch {
			await admin
				.getByRole('button', { name: 'Open subscription details' })
				.or(admin.getByRole('button', { name: /E2E SubLife/ }))
				.filter({ visible: true })
				.first()
				.click({ timeout: 5_000 });
			await expect(drawer).toBeVisible({ timeout: 10_000 });
		}

		// Succeeded initial payment → ACTIVE, and the payment row is recorded.
		await expect(drawer.getByTestId('status-badge').filter({ hasText: 'Active' })).toBeVisible({
			timeout: 15_000
		});
		await expect(drawer.getByText('Payments')).toBeVisible();
		// Currency-formatted since b163f3eb ("€15.00", not the raw "15.00 EUR" the
		// cell rendered before the platform-fee work reused `formatMoney` here).
		await expect(drawer.getByText('€15.00').first()).toBeVisible();

		// BE #774 follow-up, OFFLINE side: nothing here is Stripe-backed, so the
		// "Manage/View on Stripe" affordances must be absent — and the refund flow
		// must be untouched (the ONLINE-only gating must not bleed into offline).
		await expect(drawer.getByText('Manage on Stripe')).toBeHidden();
		await expect(drawer.getByText('View on Stripe')).toBeHidden();
		await expect(drawer.getByRole('button', { name: 'Refund', exact: true })).toBeVisible();

		// Member: the subscription card renders under /account/memberships.
		const memberContext = await browser.newContext();
		await authenticateContext(memberContext, member);
		const memberPage = await memberContext.newPage();
		await gotoHydrated(memberPage, '/account/memberships');
		await waitForClientAuth(memberPage);
		// The shared helper scopes to the Memberships region: the page's
		// Applications section renders its own <article aria-label="{org name}">
		// for the (now completed) application this test's arrange created, so an
		// unscoped article lookup is ambiguous.
		const card = membershipCard(memberPage, org.name);
		await expect(card).toBeVisible({ timeout: 15_000 });
		await expect(card.getByText(plan.name)).toBeVisible();
		await expect(card.getByText('€15.00 / month')).toBeVisible();
		await expect(
			card.getByTestId('membership-subscription-status').filter({ hasText: 'Active' })
		).toBeVisible();

		// An OFFLINE row is organization-managed, and the backend now says so
		// itself: `me_subscriptions.change_plan` refuses one with a 400 (an offline
		// swap is immediate and fee-free, so a self-service Monthly→Annual switch
		// would turn one staff-recorded monthly payment into a year of membership),
		// and there is no Stripe portal to send an offline member to. So the card
		// explains who to talk to INSTEAD of offering buttons that could only fail.
		// The three assertions above are the positive anchors — an unloaded card
		// would have failed on them, not here.
		await expect(card.getByText(`Managed by ${org.name} — contact them to make changes.`)) //
			.toBeVisible();
		await expect(card.getByRole('button', { name: 'Change plan' })).toHaveCount(0);
		await expect(card.getByRole('button', { name: 'Manage billing' })).toHaveCount(0);
		await expect(card.getByRole('button', { name: 'Cancel membership' })).toHaveCount(0);

		// Admin pauses → the member-facing badge follows. Pause is confirmation-gated
		// (it also cuts members-only access, not just billing), so the drawer button
		// only opens the dialog.
		await drawer.getByRole('button', { name: 'Pause', exact: true }).click();
		const pauseDialog = admin.getByRole('dialog', { name: 'Pause this subscription?' });
		await expect(pauseDialog).toBeVisible({ timeout: 10_000 });
		await expect(
			pauseDialog.getByText(/loses members-only access until you resume/i)
		).toBeVisible();
		await pauseDialog.getByRole('button', { name: 'Pause subscription' }).click();
		await expect(pauseDialog).toBeHidden({ timeout: 15_000 });
		await expect(drawer.getByTestId('status-badge').filter({ hasText: 'Paused' })).toBeVisible({
			timeout: 15_000
		});
		await gotoHydrated(memberPage, '/account/memberships');
		await waitForClientAuth(memberPage);
		await expect(
			card.getByTestId('membership-subscription-status').filter({ hasText: 'Paused' })
		).toBeVisible({ timeout: 15_000 });
		await memberContext.close();

		// Resume → ACTIVE again.
		await drawer.getByRole('button', { name: 'Resume', exact: true }).click();
		await expect(drawer.getByTestId('status-badge').filter({ hasText: 'Active' })).toBeVisible({
			timeout: 15_000
		});

		// Immediate cancel needs the explicit acknowledgement.
		await drawer.getByRole('button', { name: 'Cancel', exact: true }).click();
		const cancelDialog = admin.getByRole('dialog', { name: 'Cancel subscription' });
		await cancelDialog.getByRole('radio', { name: 'Immediately' }).click();
		const confirmButton = cancelDialog.getByRole('button', { name: 'Confirm cancellation' });
		await expect(confirmButton).toBeDisabled();
		await cancelDialog
			.getByRole('checkbox', { name: 'I understand access is revoked immediately.' })
			.click();
		await confirmButton.click();
		await expect(cancelDialog).toBeHidden({ timeout: 15_000 });
		await expect(drawer.getByTestId('status-badge').filter({ hasText: 'Cancelled' })).toBeVisible({
			timeout: 15_000
		});
		// Terminal state: no lifecycle actions remain.
		await expect(drawer.getByRole('button', { name: 'Pause', exact: true })).toBeHidden();

		await adminContext.close();
	});
});
