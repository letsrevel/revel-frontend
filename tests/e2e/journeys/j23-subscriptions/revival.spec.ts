import type { Locator, Page } from '@playwright/test';
import { test, expect } from '../../support/fixtures';
import { ApiClient } from '../../support/api';
import { authenticateContext, type Credentials } from '../../support/session';
import { gotoHydrated, waitForClientAuth } from '../../support/navigation';
import {
	archiveSubscriptionPlan,
	createSubscriptionPlan,
	getOrganizationId,
	uniqueName
} from '../../support/factories';
import { membershipCard } from '../../support/membership-locators';
import { PERSONAS } from '../../support/personas';

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
// ─── SHARED-STATE CONTRACT ───────────────────────────────────────────────────
// All three fixtures are shared, single-copy backend state with no per-worker
// isolation. The first three tests are strictly READ-ONLY: no click that
// mutates, no "Manage billing", no "Cancel". The LAST test is the exception —
// it drives the Rejoin click end-to-end and restores the fixture itself.
//
// THE REVIVAL STATE MACHINE (PROBED live, 2026-07-27):
//
//   expired ──POST /subscription/revive──► pending  (+ open Checkout Session)
//     ▲                                       │
//     │                                       │ POST /subscribe {plan A}
//     │                                       ├──► same row, SAME session URL
//     │                                       │    (`_maybe_resume_pending_checkout`
//     │                                       │     sees status=open + same plan)
//     │                                       │
//     └───POST /subscribe {plan B ≠ A}────────┘    old session expired on Stripe,
//         (the RESTORE leg)                        row reverted, new plan-B row PENDING
//
// `/revive` does not merely mint a Session: it flips the SAME row
// EXPIRED → PENDING (`create_revival_checkout`), so `revival_deadline` stops
// being reported (the resolver gates on EXPIRED status) while `expired_at`
// itself survives. The account hub therefore stops offering the rejoin and
// renders the pending membership card instead.
//
// Before BE #802 that was a ONE-WAY door: `_clear_stale_pending_checkout`
// DELETED a payment-less PENDING row, so an abandoned revival destroyed the
// fixture and only a reseed brought it back. #802 seeds a SUCCEEDED
// `MembershipPayment` on `test.revival.in@`'s row, and the helper now REVERTS
// payment-bearing rows to EXPIRED (deleting them would cascade the ledger)
// with `expired_at` untouched — which is exactly what makes the leg below
// re-runnable.
//
// THE RESTORE RECIPE (`restoreRevivalFixture`, run in the guard AND the
// `finally`): mint a throwaway ONLINE plan B on the revival tier as alice →
// subscribe the fixture user to it (the DIFFERENT-plan branch above, which
// reverts the plan-A row) → cancel the plan-B row immediately (terminal, so it
// is neither inlined on the membership card nor eligible for a rejoin offer) →
// archive plan B so the public org page stays clean. Verified end-state:
// plan-A row `expired` again, with its ORIGINAL `expired_at`.
//
// CHROMIUM ONLY (`test.skip(isMobile)`). The click leg mutates shared state
// that the three read-only tests above assert on, and the projects run
// concurrently — running the mutation once instead of twice halves the window.
// The window is NOT closed, and pretending otherwise would be dishonest: while
// the click test holds the row in PENDING (a few seconds, two Stripe
// round-trips), a mobile-project read of "inside the revival window …" would
// see the pending card and fail. Three things keep that rare:
//   * `mode: 'default'` below opts this file out of the global
//     `fullyParallel` — without it Playwright spreads a file's tests across
//     workers and "the mutator runs last" would be a fiction even WITHIN a
//     project. With it, the three reads finish before the click starts;
//   * the mutator is LAST in declaration order, so the only exposed reads are
//     the OTHER project's;
//   * `retries: 1` (2 on CI) re-runs a loser, by which time the `finally` has
//     restored the row.
// If it ever becomes a real nuisance, the fix is a dedicated fourth fixture
// account for the click leg — a backend change, not a locator one.

const ORG_NAME = 'Revel Events Collective';
const ORG_SLUG = 'revel-events-collective';
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
	return membershipCard(page, ORG_NAME);
}

/** Open the account hub with a settled client session. */
async function openMemberships(page: Page): Promise<void> {
	await gotoHydrated(page, '/account/memberships');
	await waitForClientAuth(page);
}

/** The fixture user's row for the seeded revival plan, straight from the API. */
interface RevivalRow {
	status: string;
	expired_at: string | null;
	revival_deadline: string | null;
}

async function readRevivalRow(): Promise<RevivalRow> {
	const api = await ApiClient.login(REVIVAL_IN.email, REVIVAL_IN.password);
	const page = await api.get<{ results: Array<RevivalRow & { plan: { name: string } }> }>(
		'/api/me/membership-subscriptions?page_size=50'
	);
	const row = page.results.find((s) => s.plan.name === PLAN_NAME);
	if (!row) {
		throw new Error(
			`No "${PLAN_NAME}" subscription for ${REVIVAL_IN.email} — re-run the backend bootstrap`
		);
	}
	return { status: row.status, expired_at: row.expired_at, revival_deadline: row.revival_deadline };
}

/**
 * Put the plan-A row back to EXPIRED after a revival, via the DIFFERENT-plan
 * branch of `_maybe_resume_pending_checkout` (see the state machine up top).
 *
 * Idempotent by construction — a no-op PENDING row simply is not there to
 * revert — so it is safe both as the pre-test guard (healing an aborted run)
 * and as the post-test `finally`.
 *
 * Plan B is archived rather than deleted: DELETE is refused once a
 * subscription references the plan, and by then the cancelled plan-B row does.
 * The residue is one terminal subscription row per run, invisible in the UI
 * (terminal subs are neither inlined on the membership card nor eligible for a
 * rejoin offer — PROBED) plus one archived, unlisted plan.
 */
async function restoreRevivalFixture(): Promise<void> {
	const alice = await ApiClient.login(PERSONAS.owner.email, PERSONAS.owner.password);
	// Plain array, not paginated.
	const tiers = await alice.get<Array<{ id: string; name: string }>>(
		`/api/organization-admin/${ORG_SLUG}/membership-tiers`
	);
	const tier = tiers.find((t) => t.name === TIER_NAME);
	if (!tier) {
		throw new Error(`Org Alpha is missing the "${TIER_NAME}" fixture tier — re-run the bootstrap`);
	}

	const planB = await createSubscriptionPlan('owner', ORG_SLUG, tier.id, {
		name: uniqueName('Revival Restore Plan'),
		payment_method: 'online',
		price: '10.00',
		currency: 'EUR'
	});
	try {
		const orgId = await getOrganizationId(ORG_SLUG);
		const fixture = await ApiClient.login(REVIVAL_IN.email, REVIVAL_IN.password);
		// Reverts the stale plan-A PENDING row and opens a plan-B one…
		await fixture.post(`/api/me/organizations/${orgId}/subscribe`, { plan_id: planB.id });
		// …which is terminalized straight away; it never sees a payment.
		await fixture.post(`/api/me/organizations/${orgId}/subscription/cancel`, { immediate: true });
	} finally {
		await archiveSubscriptionPlan('owner', ORG_SLUG, planB.id);
	}
}

/** The `cs_test_…` / `cs_live_…` segment identifying one hosted Checkout Session. */
function checkoutSessionId(url: string): string {
	const match = /cs_(?:test|live)_[A-Za-z0-9]+/.exec(url);
	if (!match) {
		throw new Error(`No Stripe Checkout session id in ${url}`);
	}
	return match[0];
}

test.describe('J23 revival window + past due @p2', () => {
	// Opt this file out of the global `fullyParallel`: the last test mutates the
	// state the first three read, so "the mutator runs last" has to be true.
	test.describe.configure({ mode: 'default' });

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

	// ─── THE ONE MUTATING TEST — keep it LAST in this file ─────────────────────
	test('Rejoin reaches hosted Checkout, and the pending row resumes the same session', async ({
		browser,
		isMobile
	}) => {
		test.skip(
			isMobile === true,
			'Mutates the shared revival fixture — run it once (chromium), not once per project.'
		);
		// Two hosted-Checkout redirects plus the restore leg's Stripe round-trips.
		test.setTimeout(240_000);

		// GUARD. A previous run that died between the Rejoin click and its
		// `finally` leaves the row PENDING; heal it rather than failing on
		// yesterday's crash. Anything other than expired/pending is a real
		// fixture problem the assertion below reports honestly.
		if ((await readRevivalRow()).status === 'pending') {
			await restoreRevivalFixture();
		}
		const before = await readRevivalRow();
		expect(before.status).toBe('expired');
		// Captured for the restore proof: #802's revert must not move it.
		const originalExpiredAt = before.expired_at;
		expect(originalExpiredAt).not.toBeNull();

		const context = await browser.newContext();
		await authenticateContext(context, REVIVAL_IN);
		const page = await context.newPage();

		try {
			await openMemberships(page);
			const card = orgCard(page);
			const rejoin = card.getByRole('button', { name: 'Rejoin' });
			await expect(rejoin).toBeEnabled({ timeout: 20_000 });

			// LEG 1 — the click the read-only tests above can only assert as a
			// shape: a real POST /subscription/revive, a real Session, and the
			// full-page hand-off RejoinCard performs with `window.location.href`.
			await rejoin.click();
			await page.waitForURL(/checkout\.stripe\.com/, { timeout: 60_000 });
			const revivalCheckoutUrl = page.url();
			const revivalSessionId = checkoutSessionId(revivalCheckoutUrl);

			// DO NOT PAY. Abandoning is the point: it is the state #694's button
			// exists for, and paying would activate the fixture's membership —
			// unrestorable without a reseed.
			await openMemberships(page);

			// LEG 2 — what the abandoned revival leaves behind. PROBED: the member
			// row is `cancelled` (the expiry signal set it, and reviving does not
			// unset it) but now carries an INLINED pending subscription, so the hub
			// renders a full membership card, not the bare terminal one of the
			// out-of-window test. The rejoin offer is gone with it: the offer is
			// gated on an EXPIRED row, and the row is PENDING now.
			await expect(card).toBeVisible({ timeout: 20_000 });
			await expect(card.getByLabel('Pending')).toBeVisible();
			await expect(card.getByText(`${PLAN_NAME} · ${PLAN_PRICE}`)).toBeVisible();
			await expect(card.getByText('Awaiting first payment')).toBeVisible();
			await expect(page.getByRole('button', { name: 'Rejoin' })).toBeHidden();
			await expect(page.getByText(`Your membership at ${ORG_NAME} has expired`)).toBeHidden();

			// The #694 action set for `pending`: a way back to Stripe and nothing
			// else. Billing/cancel/change-plan all need a Stripe Subscription that
			// an unpaid row does not have yet.
			const resume = card.getByRole('button', { name: 'Resume payment' });
			await expect(resume).toBeEnabled();
			await expect(card.getByRole('button', { name: 'Manage billing' })).toBeHidden();
			await expect(card.getByRole('button', { name: 'Change plan' })).toBeHidden();
			await expect(card.getByRole('button', { name: 'Cancel membership' })).toBeHidden();

			// LEG 3 — resume must RE-OPEN the abandoned session, not mint a second
			// one. A fresh session would mean two live Checkouts for one row and,
			// after #802, a member who can be charged twice for the same revival.
			// The session id is the only observable that tells them apart.
			await resume.click();
			await page.waitForURL(/checkout\.stripe\.com/, { timeout: 60_000 });
			expect(checkoutSessionId(page.url())).toBe(revivalSessionId);
		} finally {
			// RESTORE runs even on failure: a half-consumed fixture would fail every
			// later run of the three read-only tests, in both projects.
			await restoreRevivalFixture();
			await context.close();
		}

		// The restore proof, and with it the re-runnability proof. #802 reverts
		// the row instead of deleting it precisely so `expired_at` survives —
		// assert the exact original stamp, since a revert that merely re-stamped
		// "now" would slide the revival deadline forward on every run until the
		// out-of-window fixture and this one drift apart.
		const after = await readRevivalRow();
		expect(after.status).toBe('expired');
		expect(after.expired_at).toBe(originalExpiredAt);
		expect(after.revival_deadline).toBe(before.revival_deadline);

		// …and the same proof through the UI the next run will actually use.
		const verifyContext = await browser.newContext();
		await authenticateContext(verifyContext, REVIVAL_IN);
		const verifyPage = await verifyContext.newPage();
		await openMemberships(verifyPage);
		await expect(orgCard(verifyPage).getByRole('button', { name: 'Rejoin' })).toBeEnabled({
			timeout: 20_000
		});
		await verifyContext.close();
	});
});
