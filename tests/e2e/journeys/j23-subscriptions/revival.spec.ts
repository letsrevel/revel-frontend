import type { Locator, Page } from '@playwright/test';
import { test, expect } from '../../support/fixtures';
import { authenticateContext, type Credentials } from '../../support/session';
import { gotoHydrated, waitForClientAuth } from '../../support/navigation';

// J23.7 / J23.8 (USER_JOURNEYS.md) — the three states of a lapsed ONLINE
// membership, all read from /account/memberships:
//   * EXPIRED inside the revival window → RejoinCard, dated, with a live CTA;
//   * EXPIRED past the deadline         → no offer, just the bare cancelled card;
//   * PAST_DUE inside the grace period  → the `role=alert` payment-failed banner.
//
// These states cannot be arranged through the API: only the backend's billing
// clock (Stripe webhooks + the `expire_subscriptions_past_grace` sweep) moves a
// subscription to EXPIRED or PAST_DUE, and no member OR admin endpoint can
// back-date `expired_at` (the org-admin subscription controller offers create /
// record-payment / cancel / pause / resume / revive — no expire). They
// therefore come from dedicated BACKEND FIXTURES (`bootstrap_test_events`,
// BE #795): three fixed accounts on Org Alpha's "E2E Revival Plan"
// (€10/month, tier "E2E Revival Tier").
//
// The fixtures are NOT personas — they back exactly one spec — so they are used
// with raw credentials, the way the throwaway-user specs do it. Their dates are
// derived from the seed instant, so every date below is asserted as a SHAPE.
//
// ─── SHARED-STATE CONTRACT: this spec is strictly READ-ONLY ──────────────────
// All three fixtures are shared, single-copy backend state with no per-worker
// isolation, and NOTHING here mutates them: no Rejoin click, no "Manage
// billing", no "Cancel". That is what lets the file run on both projects, in
// parallel, on every re-run, without a reseed.
//
// The Rejoin CTA is deliberately asserted but NOT clicked. PROBED on the live
// stack (2026-07-27) — clicking it consumes the fixture permanently:
// `POST …/subscription/revive` does not merely mint a Checkout Session, it
// flips the SAME row EXPIRED → PENDING and clears `expired_at`'s window
// (`create_revival_checkout` in subscription_stripe_service.py), so the account
// hub immediately stops offering the rejoin and shows a "Pending / Awaiting
// first payment" card instead. Abandoning the checkout does NOT restore it:
// recovery runs in `_maybe_resume_pending_checkout`, which is only reached from
// the SUBSCRIBE endpoint, and for a fixture row (no `MembershipPayment` ledger)
// it DELETES the row rather than reverting it to EXPIRED. Repair needs a
// backend reseed. A spec that clicks Rejoin therefore passes exactly once per
// bootstrap and then fails — including for every later full-suite run.
//
// Coverage of the click itself lives where it can be exercised repeatably:
// src/lib/components/account/RejoinCard.test.ts asserts the empty-body revive
// call and the `window.location.href` hand-off against a mocked SDK, and the
// backend owns the endpoint's own tests. The remaining E2E gap — a real
// `/revive` reaching a real Stripe Checkout — needs either a fixture the suite
// can mint itself or a backend that keeps the row EXPIRED until the session
// completes; both are backend changes, tracked in this task's report.

const ORG_NAME = 'Revel Events Collective';
const PLAN_NAME = 'E2E Revival Plan';
const PLAN_PRICE = '€10.00 / month';
const TIER_NAME = 'E2E Revival Tier';

const PASSWORD = 'password123';
/** EXPIRED, revival deadline in the future. */
const REVIVAL_IN: Credentials = { email: 'test.revival.in@example.com', password: PASSWORD };
/** EXPIRED, revival deadline already passed. */
const REVIVAL_OUT: Credentials = { email: 'test.revival.out@example.com', password: PASSWORD };
/** PAST_DUE, grace deadline in the future. */
const PAST_DUE: Credentials = { email: 'test.pastdue@example.com', password: PASSWORD };

/**
 * Dates render through `date.ts`, which always uses a TEXTUAL month (the house
 * rule keeping DD/MM vs MM/DD ambiguity out of the UI); both surfaces here go
 * through `formatDate`, the SHORT form — e.g. "Aug 21, 2026". Matching the
 * shape rather than a literal survives a reseed (the fixture dates are relative
 * to the seed instant) while still proving a real formatted date, and not a raw
 * ISO string or the "—" both components fall back to when the stamp is missing.
 */
const DATE = '(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec) \\d{1,2}, \\d{4}';

/** The org's card in the account hub's Memberships section (either kind). */
function orgCard(page: Page): Locator {
	return page.getByRole('region', { name: 'Memberships' }).getByRole('article', { name: ORG_NAME });
}

/** Open the account hub with a settled client session. */
async function openMemberships(page: Page): Promise<void> {
	await gotoHydrated(page, '/account/memberships');
	await waitForClientAuth(page);
}

test.describe('J23 revival window + past due @p2', () => {
	test('inside the revival window the member is offered a dated Rejoin', async ({ browser }) => {
		const context = await browser.newContext();
		await authenticateContext(context, REVIVAL_IN);
		const page = await context.newPage();

		await openMemberships(page);
		const card = orgCard(page);

		await expect(
			card.getByRole('heading', { name: `Your membership at ${ORG_NAME} has expired` })
		).toBeVisible({ timeout: 20_000 });

		// Both dates in one sentence, and the deadline is the actionable half:
		// without it the member cannot tell whether rejoining is still possible.
		await expect(
			card.getByText(new RegExp(`^It expired on ${DATE}\\. You can rejoin until ${DATE}\\.$`))
		).toBeVisible();

		// What rejoining would cost — the offer is a purchase decision.
		await expect(card.getByText(`${PLAN_NAME} · ${PLAN_PRICE}`)).toBeVisible();
		await expect(
			card.getByText("You'll pay securely with Stripe and return to the organization's page.")
		).toBeVisible();
		// Live, not a decorative badge. (Clicking it would consume the fixture —
		// see the contract at the top of this file.)
		await expect(card.getByRole('button', { name: 'Rejoin' })).toBeEnabled();

		// The offer SUPERSEDES the org's own card. Expiry does not delete the
		// member row (the backend signal maps EXPIRED → member CANCELLED), so
		// `list_my_memberships` still returns this org — as a bare cancelled row.
		// The page filters that row out in favour of the offer, which says
		// strictly more; without the filter the org would render twice, a dead
		// card up top and its rejoin offer far below.
		await expect(
			page.getByRole('region', { name: 'Memberships' }).getByRole('article', { name: ORG_NAME })
		).toHaveCount(1);
		await expect(page.getByText(new RegExp(`^Member since ${DATE}$`))).toBeHidden();

		await context.close();
	});

	test('past the revival deadline there is no offer, only the bare cancelled card', async ({
		browser
	}) => {
		const context = await browser.newContext();
		await authenticateContext(context, REVIVAL_OUT);
		const page = await context.newPage();

		await openMemberships(page);
		const card = orgCard(page);

		// PROBED on the live stack: this user's `/api/me/membership-subscriptions`
		// row is EXPIRED with `revival_deadline` in the PAST, and their membership
		// row is `cancelled` with NO inlined subscription (only non-terminal subs
		// are inlined). With no offer to supersede it, that bare cancelled row is
		// what renders: org name, tier, a `cancelled` badge, "Member since", and
		// no management actions at all.
		await expect(card).toBeVisible({ timeout: 20_000 });
		await expect(card.getByText('cancelled', { exact: true })).toBeVisible();
		await expect(card.getByText(TIER_NAME)).toBeVisible();
		await expect(card.getByText(new RegExp(`^Member since ${DATE}$`))).toBeVisible();

		// The discriminators. Every one of these lights up if the deadline check
		// (`isWithinRevivalWindow`) is dropped or inverted: an out-of-window row
		// would then render a RejoinCard *and* suppress the cancelled card above,
		// so this test fails on both counts rather than silently passing.
		await expect(page.getByRole('button', { name: 'Rejoin' })).toBeHidden();
		await expect(page.getByText(`Your membership at ${ORG_NAME} has expired`)).toBeHidden();
		await expect(page.getByText(/You can rejoin until/)).toBeHidden();

		// An expired subscription is not a live membership either: no plan, no
		// price, no billing controls leak out of the terminal row.
		await expect(card.getByText(PLAN_NAME)).toBeHidden();
		await expect(card.getByText(PLAN_PRICE)).toBeHidden();
		await expect(card.getByRole('button', { name: 'Manage billing' })).toBeHidden();
		await expect(card.getByRole('button', { name: 'Change plan' })).toBeHidden();
		await expect(card.getByRole('button', { name: 'Cancel membership' })).toBeHidden();
		// …but the org stays reachable, which is the only thing left to do here.
		await expect(card.getByRole('link', { name: 'View org' })).toBeVisible();

		await context.close();
	});

	test('a past-due subscription alerts the member and keeps the fix within reach', async ({
		browser
	}) => {
		const context = await browser.newContext();
		await authenticateContext(context, PAST_DUE);
		const page = await context.newPage();

		await openMemberships(page);
		const card = orgCard(page);
		await expect(card).toBeVisible({ timeout: 20_000 });

		// Grace semantics, PROBED: the member row stays ACTIVE and the past-due
		// subscription is still inlined, so this is a full membership card
		// carrying a warning — not a stripped terminal one.
		await expect(card.getByLabel('Past due')).toBeVisible();
		await expect(card.getByText(`${PLAN_NAME} · ${PLAN_PRICE}`)).toBeVisible();

		// The banner is the failure's only announcement, so it must reach a screen
		// reader on render (role=alert) and it must carry the grace deadline —
		// "by when" is its entire actionable content, and the undated fallback
		// (`subscriptions.pastDue.banner`) would be a silent regression here.
		const banner = card.getByRole('alert');
		await expect(banner).toBeVisible();
		await expect(banner).toHaveText(
			new RegExp(
				`^Payment failed — update your payment method by ${DATE} to keep your membership\\.$`
			)
		);

		// PROBED: `getMemberActions` narrows past_due to billing + cancel.
		// "Manage billing" is the banner's remedy — an alert with no way to act on
		// it would be the real failure — while "Change plan" is withheld until the
		// failed payment is settled (deliberately stricter than the backend
		// preflight, which would accept it).
		//
		// Neither button is CLICKED: the fixture is shared and read-only, and a
		// portal hand-off or a cancel would consume it for every later run. The
		// hand-off itself is covered against a throwaway subscriber in
		// manage-subscription.spec.ts.
		await expect(card.getByRole('button', { name: 'Manage billing' })).toBeEnabled();
		await expect(card.getByRole('button', { name: 'Cancel membership' })).toBeVisible();
		await expect(card.getByRole('button', { name: 'Change plan' })).toBeHidden();

		// A past-due row is not an expired one: no rejoin offer anywhere on the page.
		await expect(page.getByRole('button', { name: 'Rejoin' })).toBeHidden();

		await context.close();
	});
});
