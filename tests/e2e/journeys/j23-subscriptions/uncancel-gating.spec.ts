import type { Locator, Page } from '@playwright/test';
import { test, expect } from '../../support/fixtures';
import {
	approveMembershipRequest,
	createOrganization,
	createSubscriptionPlan,
	createVerifiedUser,
	getUserId,
	requestMembership,
	setMemberStatus,
	staffCancelSubscription,
	staffCreateOfflineSubscription,
	uniqueName,
	type CreatedOrg,
	type ThrowawayUser
} from '../../support/factories';
import { authenticateContext } from '../../support/session';
import { gotoHydrated, waitForClientAuth } from '../../support/navigation';

// J23 (USER_JOURNEYS.md) — the admin subscription drawer's "Undo cancellation"
// button, and the one case where it is WITHHELD.
//
// `subscription_uncancel._assert_membership_allows_renewal` answers 403 when the
// MEMBER row is PAUSED or BANNED: a suspended member must not be put back on the
// renewal clock, because that bills them for access they do not currently have.
// The drawer pre-gates on `SubscriptionSchema.member_status` so the button is
// never offered where it could only fail.
//
// The state is reachable at all only because of an asymmetry worth naming:
// `organization_service.membership._mirror_status_to_subscriptions` deliberately
// SKIPS a subscription that is already scheduled to cancel (it stops billing at
// the period boundary anyway), so a staff PAUSE leaves the member row PAUSED
// while the subscription itself stays ACTIVE with the cancellation booked. That
// ORDER is load-bearing in the arrange below: pause first and the subscription
// would be paused too, and the test would prove nothing about `member_status`.
//
// Both members live in ONE throwaway org on ONE offline plan, differing only in
// the member row's status — so the presence and the absence of the button are a
// controlled comparison rather than two unrelated setups.

const MONTH = 'Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec';

/** Narrow the Subs tab to one member and open that row's drawer. */
async function openDrawerFor(page: Page, user: ThrowawayUser): Promise<Locator> {
	await page.getByPlaceholder('Search by name or email…').fill(user.email);
	// Each subscription renders twice (desktop row + mobile card, one always
	// display:none), so filter to the visible one. The desktop table row is
	// aria-labelled "Open subscription details"; the mobile card exposes its
	// content text instead.
	const panel = page.getByRole('tabpanel');
	const row = panel
		.getByRole('button', { name: 'Open subscription details' })
		.or(panel.getByRole('button', { name: user.email }))
		// OBSERVED, not defensive: the search is debounced 300ms and the list keeps
		// no placeholder data, so for a moment after `fill` the PREVIOUS member's
		// row is still the only one on screen — a row count alone settles instantly
		// on the wrong row, and the resulting click opens the wrong drawer while
		// Playwright reports a perfectly successful click. Identify the row by the
		// email it carries, not by how many rows there are.
		.filter({ hasText: user.email })
		.filter({ visible: true });
	await expect(row).toHaveCount(1, { timeout: 20_000 });
	await row.click({ timeout: 20_000 });
	const drawer = page.getByRole('dialog').filter({ hasText: user.email });
	await expect(drawer).toBeVisible({ timeout: 15_000 });
	return drawer;
}

/**
 * An org member holding an ACTIVE offline subscription with a cancellation
 * already scheduled at period end. The recorded initial payment is what gives
 * the row both ACTIVE status and a period boundary — without one the backend
 * upgrades the scheduled cancel to an immediate (terminal) one.
 */
async function arrangeScheduledCancellation(
	org: CreatedOrg,
	planId: string,
	label: string
): Promise<ThrowawayUser> {
	const user = await createVerifiedUser(label);
	const request = await requestMembership(user, org.slug);
	await approveMembershipRequest(org.owner, org.slug, request.id, org.defaultTierId);
	const sub = await staffCreateOfflineSubscription(org.owner, org.slug, {
		planId,
		userId: await getUserId(user),
		amount: '15.00'
	});
	await staffCancelSubscription(org.owner, org.slug, sub.id);
	return user;
}

test.describe('J23 uncancel gating @p2', () => {
	test('Undo cancellation is withheld on a suspended member and offered on an active one', async ({
		browser
	}) => {
		test.setTimeout(180_000);

		const org = await createOrganization({ acceptMembershipRequests: true });
		const plan = await createSubscriptionPlan(org.owner, org.slug, org.defaultTierId, {
			name: uniqueName('Uncancel Plan'),
			price: '15.00',
			currency: 'EUR',
			payment_method: 'offline'
		});
		// Sequential, not parallel: both legs run `requestMembership` +
		// `approveMembershipRequest` against the same org, and the approve path
		// writes the org's member roster.
		const activeMember = await arrangeScheduledCancellation(org, plan.id, 'UncancelOk');
		const pausedMember = await arrangeScheduledCancellation(org, plan.id, 'UncancelPaused');
		// AFTER the cancellation is scheduled — see the file header.
		await setMemberStatus(org.owner, org.slug, pausedMember.email, 'paused');

		const context = await browser.newContext();
		await authenticateContext(context, org.owner);
		const page = await context.newPage();
		await gotoHydrated(page, `/org/${org.slug}/admin/members`);
		await waitForClientAuth(page);
		await page.getByRole('tab', { name: /Subs/ }).click();

		// --- CONTROL: member row ACTIVE → the button is there --------------------
		const okDrawer = await openDrawerFor(page, activeMember);
		await expect(okDrawer.getByLabel('Active')).toBeVisible({ timeout: 15_000 });
		await expect(okDrawer.getByText(new RegExp(`^Cancels on .*(${MONTH})`))).toBeVisible();
		await expect(okDrawer.getByRole('button', { name: 'Undo cancellation' })).toBeVisible();
		// Corroborates that the row really is scheduled to cancel: Pause is refused
		// on such a row (it would strand it where the grace sweep can never retire
		// it), so the two controls are never both offered.
		await expect(okDrawer.getByRole('button', { name: 'Pause', exact: true })).toBeHidden();
		await page.keyboard.press('Escape');
		await expect(okDrawer).toBeHidden({ timeout: 10_000 });

		// --- SUSPENDED: same row shape, member PAUSED → the button is gone -------
		const gatedDrawer = await openDrawerFor(page, pausedMember);
		// POSITIVE ANCHORS FIRST, and they are the whole point of the comparison:
		// the drawer is loaded, the SUBSCRIPTION is still ACTIVE (the member pause
		// was not mirrored onto it), and the cancellation is still booked — so the
		// only thing that differs from the control above is `member_status`.
		// Without these, the absence below could just be an unloaded drawer.
		await expect(gatedDrawer.getByLabel('Active')).toBeVisible({ timeout: 15_000 });
		await expect(gatedDrawer.getByText(new RegExp(`^Cancels on .*(${MONTH})`))).toBeVisible();

		// THE NEGATIVE: the backend would answer 403, so the drawer never offers it.
		await expect(gatedDrawer.getByRole('button', { name: 'Undo cancellation' })).toHaveCount(0);
		// The rest of the action bar is untouched — this is a targeted withdrawal,
		// not a drawer that failed to render its buttons.
		await expect(gatedDrawer.getByRole('button', { name: 'Cancel', exact: true })).toBeVisible();

		await context.close();
	});
});
