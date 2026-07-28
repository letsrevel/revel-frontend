import type { Locator, Page } from '@playwright/test';
import { test, expect } from '../../support/fixtures';
import {
	approveMembershipRequest,
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

// J23 (USER_JOURNEYS.md) — the ORG-WIDE membership payment ledger
// (/org/{slug}/admin/members?tab=payments) and the in-place refund it offers.
//
// The refund control is deliberately narrower than the tab: it is rendered only
// where `POST …/payments/{id}/refund` would actually succeed, i.e. on rows that
// are SUCCEEDED *and* OFFLINE. The backend refuses an ONLINE row with a 400
// ("ONLINE payments must be refunded from the Stripe Dashboard…") because this
// endpoint never moves money — accepting it would flip the ledger to REFUNDED
// and auto-cancel the subscription while the member's charge stays captured on
// Stripe. Both halves of that gate are covered here, from opposite directions.
//
// Every row is rendered TWICE (a desktop table row and a mobile card, one of
// which is always `display: none`), so every row-level lookup filters to
// VISIBLE nodes — an unfiltered one is layout-dependent and counts 2 per row.

/**
 * The Refund control for one member's ledger row.
 *
 * The accessible name carries the member's own name — "Refund" alone would be
 * ambiguous across the 20 rows a ledger page can hold — so a bare
 * `getByRole('button', { name: 'Refund' })` matches NOTHING here, exact or not.
 */
function refundButton(page: Page, displayName: string): Locator {
	return page
		.getByRole('button', { name: `Refund payment from ${displayName}` })
		.filter({ visible: true });
}

test.describe('J23 membership payment ledger @p2', () => {
	test('an offline succeeded payment is refunded in place and the row flips to Refunded', async ({
		browser
	}) => {
		test.setTimeout(150_000);

		// A throwaway org so the ledger holds exactly the one row this test wrote:
		// "no Refund button anywhere" is then a claim about THIS payment rather
		// than about whichever row a shared org happened to paginate first.
		const [org, member] = await Promise.all([
			createOrganization({ acceptMembershipRequests: true }),
			createVerifiedUser('LedgerRefund')
		]);
		const request = await requestMembership(member, org.slug);
		await approveMembershipRequest(org.owner, org.slug, request.id, org.defaultTierId);
		const plan = await createSubscriptionPlan(org.owner, org.slug, org.defaultTierId, {
			name: uniqueName('Ledger Plan'),
			price: '15.00',
			currency: 'EUR',
			payment_method: 'offline'
		});
		// The recorded initial payment IS the ledger row under test (and what
		// flips the subscription PENDING → ACTIVE).
		await staffCreateOfflineSubscription(org.owner, org.slug, {
			planId: plan.id,
			userId: await getUserId(member),
			amount: '15.00'
		});

		const context = await browser.newContext();
		await authenticateContext(context, org.owner);
		const page = await context.newPage();
		// Deep link straight to the tab: `?tab=payments` is permission-validated
		// on load, so this also asserts the org owner is allowed onto it.
		await gotoHydrated(page, `/org/${org.slug}/admin/members?tab=payments`);
		await waitForClientAuth(page);

		const displayName = `${member.firstName} ${member.lastName}`;

		// POSITIVE ANCHORS FIRST. The ledger loaded, it holds exactly our row, and
		// the row reads as a succeeded €15.00 offline payment on our plan.
		// Singular: the count message is a hand-selected one/other pair, so a lone
		// row reads "1 payment". Asserting the singular also pins that selection.
		await expect(page.getByText('1 payment', { exact: true })).toBeVisible({ timeout: 20_000 });
		await expect(page.getByText(member.email).filter({ visible: true })).toHaveCount(1);
		await expect(page.getByText('Succeeded').filter({ visible: true })).toHaveCount(1);
		await expect(page.getByText('€15.00').filter({ visible: true }).first()).toBeVisible();
		await expect(page.getByText(plan.name).filter({ visible: true }).first()).toBeVisible();
		// A purely offline ledger never trips the ONLINE rule, so the explanatory
		// note stays away — its presence here would mean the row was misclassified.
		await expect(
			page.getByText('Refunds for online payments are issued from the Stripe Dashboard')
		).toBeHidden();

		// --- Refund, through the UI ---------------------------------------------
		await refundButton(page, displayName).click();

		const dialog = page.getByRole('dialog', { name: 'Mark payment as refunded' });
		await expect(dialog).toBeVisible({ timeout: 10_000 });
		// The dialog restates the amount it is about to write off, and is explicit
		// that this is bookkeeping — no money moves from here.
		await expect(dialog.getByText('15.00 EUR')).toBeVisible();
		await expect(dialog.getByText(/This records the refund for bookkeeping/)).toBeVisible();
		await dialog.getByLabel('Notes').fill('E2E ledger refund');
		await dialog.getByRole('button', { name: 'Mark refunded' }).click();
		await expect(dialog).toBeHidden({ timeout: 20_000 });

		// The refetch can drop a refunded row out of a status-filtered view, so the
		// toast is the only guaranteed feedback — it is part of the contract.
		await expect(page.getByText('Payment marked as refunded.')).toBeVisible({ timeout: 15_000 });

		// The row updated IN PLACE (the tab invalidates by key prefix, so the page
		// on screen refetches): same single row, now REFUNDED.
		await expect(page.getByText('Refunded').filter({ visible: true })).toHaveCount(1, {
			timeout: 15_000
		});
		await expect(page.getByText('Succeeded').filter({ visible: true })).toHaveCount(0);
		// …and the control is withdrawn, because the row is no longer SUCCEEDED.
		// Preceded by the positive above, so this cannot pass on an unloaded page.
		await expect(refundButton(page, displayName)).toHaveCount(0);

		await context.close();
	});

	test('an online succeeded payment offers no in-app refund, only the Stripe note', async ({
		asOwner
	}) => {
		// Arranged from a BACKEND FIXTURE rather than by this spec: an ONLINE
		// SUCCEEDED payment can only be produced by a real hosted Stripe Checkout
		// (staff-create refuses ONLINE plans outright), and building that dance
		// just to assert an ABSENT button would be slow and flaky. `bootstrap_test_events`
		// already seeds one — the last paid period of the revival fixture
		// (BE #802: test.revival.in@example.com on Org Alpha's €10 ONLINE "E2E
		// Revival Plan") — and it survives the revival spec's mutating leg, which
		// reverts that subscription rather than deleting its payment history.
		//
		// Shared state, so this test is strictly READ-ONLY: it never clicks a
		// control that would write to Org Alpha's ledger.
		const FIXTURE_EMAIL = 'test.revival.in@example.com';
		const FIXTURE_NAME = 'Revival InWindow';

		await gotoHydrated(asOwner, '/org/revel-events-collective/admin/members?tab=payments');
		await waitForClientAuth(asOwner);

		// Org Alpha's ledger is shared and paginated, so narrow to the fixture by
		// email (the search covers member email and the Stripe id columns).
		await asOwner.getByLabel('Search membership payments').fill(FIXTURE_EMAIL);

		// POSITIVE ANCHORS FIRST — and the note is the strongest one available:
		// `showOnlineRefundNote` renders only when the page actually holds a row
		// that is SUCCEEDED *and* ONLINE, so it proves the app classified this row
		// exactly as the refund gate's negative branch. Without it, "no Refund
		// button" could just mean "nothing rendered yet".
		await expect(asOwner.getByText(FIXTURE_EMAIL).filter({ visible: true })).toHaveCount(1, {
			timeout: 20_000
		});
		await expect(asOwner.getByText('Succeeded').filter({ visible: true })).toHaveCount(1);
		await expect(
			asOwner.getByText(
				'Refunds for online payments are issued from the Stripe Dashboard — they are recorded here automatically.'
			)
		).toBeVisible();

		// THE NEGATIVE: no in-app refund on an ONLINE row — the backend would 400.
		await expect(refundButton(asOwner, FIXTURE_NAME)).toHaveCount(0);
		// Nor under any other name: the filtered page holds this row only.
		await expect(asOwner.getByRole('button', { name: /^Refund payment from / })).toHaveCount(0);
	});
});
