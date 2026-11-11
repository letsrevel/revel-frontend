import { test, expect } from '../../support/fixtures';
import {
	approveMembershipRequest,
	createMembershipTier,
	createOrganization,
	createSubscriptionPlan,
	createVerifiedUser,
	getUserId,
	requestMembership,
	staffCreateOfflineSubscription,
	uniqueName
} from '../../support/factories';
import { authenticateContext } from '../../support/session';
import { gotoHydrated, waitForClientAuth } from '../../support/navigation';
import { openPersonSheet, registerPath } from '../../support/member-register';

// J23 — "the tier follows the plan" (BE #1367) from the person sheet.
//
// A member with a live OFFLINE subscription cannot have their tier edited by
// hand: Manage membership shows the select locked and points at the
// subscription. Manage subscription (in the sheet, and from that lock note)
// opens the same drawer the Subs tab uses; Change plan there moves the member
// to another offline plan of a DIFFERENT tier at once — no payment, and the
// membership tier follows, which the sheet reflects after the refresh.

test.describe('J23 manage a subscription from the person sheet @p1', () => {
	test('the tier is locked; changing the plan moves the tier', async ({ browser }) => {
		test.setTimeout(240_000);

		const org = await createOrganization({ acceptMembershipRequests: true });
		const goldName = uniqueName('Gold Tier');
		const gold = await createMembershipTier(org.owner, org.slug, goldName);
		const basicPlan = await createSubscriptionPlan(org.owner, org.slug, org.defaultTierId, {
			name: uniqueName('Basic Plan'),
			price: '10.00',
			currency: 'EUR',
			payment_method: 'offline'
		});
		const goldPlan = await createSubscriptionPlan(org.owner, org.slug, gold.id, {
			name: uniqueName('Gold Plan'),
			price: '20.00',
			currency: 'EUR',
			payment_method: 'offline'
		});

		const member = await createVerifiedUser('SheetSub');
		const memberName = `${member.firstName} ${member.lastName}`;
		const request = await requestMembership(member, org.slug);
		await approveMembershipRequest(org.owner, org.slug, request.id, org.defaultTierId);
		await staffCreateOfflineSubscription(org.owner, org.slug, {
			planId: basicPlan.id,
			userId: await getUserId(member),
			amount: '10.00'
		});

		const context = await browser.newContext();
		await authenticateContext(context, org.owner);
		const page = await context.newPage();
		try {
			await gotoHydrated(page, registerPath(org.slug));
			await waitForClientAuth(page);
			const sheet = await openPersonSheet(page, memberName);
			await expect(sheet.getByTestId('person-membership')).toContainText('General membership');

			// "Manage subscription" (not "Add"): the member has a live subscription.
			const manageSubscription = sheet.getByTestId('person-manage-subscription');
			await expect(manageSubscription).toHaveText(/Manage subscription/, { timeout: 15_000 });
			await expect(sheet.getByTestId('person-manage-membership')).toBeEnabled({
				timeout: 15_000
			});

			// Manage membership: the tier follows the plan, so the select is locked and says why.
			await sheet.getByTestId('person-manage-membership').click();
			const manageDialog = page
				.getByRole('dialog')
				.filter({ has: page.getByLabel('Membership Tier') });
			await expect(manageDialog.getByLabel('Membership Tier')).toBeDisabled();
			await expect(manageDialog.getByTestId('member-tier-lock')).toContainText(
				"This member's tier follows their subscription plan."
			);
			// The status stays editable.
			await expect(manageDialog.getByLabel('Membership Status')).toBeEnabled();

			// From the lock note straight into the subscription drawer.
			await manageDialog.getByTestId('member-tier-lock-manage-subscription').click();
			await expect(manageDialog).toBeHidden({ timeout: 10_000 });
			const drawer = page
				.getByRole('dialog')
				.filter({ has: page.getByTestId('subscription-change-plan') });
			await expect(drawer).toBeVisible({ timeout: 15_000 });

			// Change plan to the offline plan of the other tier.
			await drawer.getByTestId('subscription-change-plan').click();
			const changeDialog = page.getByRole('dialog', { name: 'Change plan' });
			await changeDialog.getByLabel('New plan').selectOption({ value: goldPlan.id });
			await expect(changeDialog.getByTestId('change-plan-confirm-text')).toContainText(
				`The member moves to ${goldPlan.name} (${goldName}) now.`
			);
			await changeDialog.getByRole('button', { name: 'Change plan' }).click();
			await expect(changeDialog).toBeHidden({ timeout: 15_000 });
			await expect(drawer.getByText(goldPlan.name)).toBeVisible({ timeout: 15_000 });

			// Close the drawer: focus returns to the sheet's button, and the sheet's
			// tier is the new plan's tier.
			await page.keyboard.press('Escape');
			await expect(drawer).toBeHidden({ timeout: 10_000 });
			await expect(manageSubscription).toBeFocused();
			await expect(sheet.getByTestId('person-membership')).toContainText(goldName, {
				timeout: 15_000
			});
		} finally {
			await context.close();
		}
	});
});
