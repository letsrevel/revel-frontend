import { test, expect } from '../../support/fixtures';
import {
	createMembershipQuestionnaire,
	createMembershipTier,
	createOrganization,
	createSubscriptionPlan,
	createVerifiedUser,
	patchTierPolicy,
	uniqueName,
	MEMBERSHIP_QUESTION
} from '../../support/factories';
import { pageAs } from '../../support/session';
import { membershipPath, planCard, tierCard } from '../../support/membership-locators';
import { gotoHydrated, waitForClientAuth } from '../../support/navigation';

// J27 — the combination this whole cluster exists to enable: a tier that is
// BOTH eligibility-gated AND monetized (it carries an active plan).
//
// Until letsrevel/revel-backend#831 the backend refused that pairing outright,
// so nothing on either side had ever seen it. #733/#734 then taught `PlanCard`
// to WITHDRAW its subscribe CTA while the tier's gates are unsatisfied for the
// viewer, because `POST /me/organizations/{org_id}/subscribe` runs the same
// gate stack and would refuse with a 400 *after* the member committed to a
// charge. Nothing covered either half of that until this file.
//
// The two directions, and why the second is the one that matters:
//
//   1. gated + priced ⇒ the CTA is withheld and the price is still on the card.
//      Catches a regression that hands out a button whose only outcome is a 400
//      at the end of a checkout.
//   2. gate cleared ⇒ the CTA comes back, and works. Catches the WORSE bug:
//      withholding a plan from somebody who is actually eligible makes the tier
//      unjoinable with no error anywhere. `isBlockedByMembershipGate` is an
//      allow-list of reason codes precisely so it fails OPEN, and this is what
//      holds that property down — a widened list, or a gate check that keys off
//      the tier's static `questionnaire_id` instead of the viewer's verdict,
//      fails here and nowhere else.
//
// Why a FREE plan rather than an ONLINE one. `PlanCard`'s CTA precedence stops
// at `payment_method === 'offline'` two lines ABOVE the gate branch, so an
// offline plan could never exercise this. FREE is the only other non-online
// kind, and it reaches the exact same `gateBlocked ? 'gated' : 'subscribe'`
// line an online plan would — the gate blocks long before Stripe is consulted,
// so an ONLINE plan adds no code path, while forcing the test onto the one
// Stripe-connected seeded org (Org Alpha) whose shared state other j23 workers
// depend on. A free plan keeps the whole test on a throwaway org.
//
// What "priced" means here is the backend's own definition and it is the one
// that matters to the gates: `is_free` is "the tier has no ACTIVE plan", so a
// tier carrying a free plan is monetized — `TierAvailabilityGate` (#6) refuses
// the plan-less free `/apply` path on it with `tier_requires_subscription`, and
// that is exactly why `TierCard` has to name a plan in its eligibility question
// at all. The price line itself reads "Free" (`formatPlanPrice` never renders
// "€0.00 / lifetime"), which is still the assertion direction 1 wants: whatever
// the plan costs, the cost stays visible while the CTA does not.
//
// Live-verified verdicts this spec is built on (both round-tripped against a
// running backend before it was written):
//   * tier_id + plan_id, questionnaire unfilled → `allowed: false`,
//     `membership_questionnaire_missing`, `submit_questionnaire`. That code is
//     in `GATE_BLOCKING_REASON_CODES`, so `PlanCard` renders the gated note.
//   * the same pair after a passing auto-graded submission → `allowed: true`,
//     `proceed_to_payment` → the CTA returns.
//   * tier_id ALONE (which is what `MembershipCta` asks) → blocked at gate #6
//     with `tier_requires_subscription`, whatever the questionnaire says. So on
//     a gated+paid tier the tier CTA is never the questionnaire affordance —
//     the requirements list's own "Open the questionnaire" link is, and that is
//     what this test clicks.
//
// Isolation, the j27 house rule: the test arranges its OWN org, questionnaire,
// tiers and applicant, so parallel projects/workers and a `retries: 1` re-run
// never share a questionnaire submission (one-shot per user) or a membership.

/** `PlanCard`'s free-plan CTA label — the thing being withheld and restored. */
const JOIN_FREE = 'Join for free';
/** What replaces it while the gates are unsatisfied. */
const GATED_NOTE = "You can join once this tier's requirements are met.";
/** The free-plan helper that rides along with the CTA, and only with it. */
const FREE_HELPER = 'No payment needed — you can join right away.';

test.describe('j27 gated + paid tier @p2', () => {
	test('a gated priced tier withholds its plan CTA, and hands it back once the gate clears', async ({
		browser
	}) => {
		test.setTimeout(240_000);
		const [org, applicant] = await Promise.all([
			createOrganization({ acceptMembershipRequests: true }),
			createVerifiedUser('GatedPaid')
		]);

		const gatedTierName = uniqueName('Gated Paid Tier');
		const openTierName = uniqueName('Open Paid Tier');
		const [gatedTier, openTier, questionnaire] = await Promise.all([
			createMembershipTier(org.owner, org.slug, gatedTierName),
			createMembershipTier(org.owner, org.slug, openTierName),
			// Multiple choice, one correct option, `min_score: 0` — the house
			// pattern for deterministic inline grading (no LLM in an E2E run).
			createMembershipQuestionnaire(org.owner, org.slug, { evaluationMode: 'automatic' })
		]);

		// The gate is a TIER OVERRIDE, deliberately not the org default: the
		// neighbour below has to stay ungated on the same page, and an org default
		// would gate both. (questionnaire-flow.spec.ts owns the org-default path.)
		await patchTierPolicy(org.owner, org.slug, gatedTier.id, {
			membership_questionnaire: questionnaire.id
		});

		// Two plans of the SAME shape, one on each tier. Identical by
		// construction so the only difference between the two cards on screen is
		// the gate — which is what makes the withheld CTA below mean something
		// rather than "free plans never offer one".
		const freePlan = { payment_method: 'free', period_unit: 'lifetime', price: '0.00' } as const;
		const [gatedPlan, openPlan] = await Promise.all([
			createSubscriptionPlan(org.owner, org.slug, gatedTier.id, {
				name: uniqueName('Gated Plan'),
				...freePlan
			}),
			createSubscriptionPlan(org.owner, org.slug, openTier.id, {
				name: uniqueName('Open Plan'),
				...freePlan
			})
		]);

		const page = await pageAs(browser, applicant);
		await gotoHydrated(page, membershipPath(org.slug));
		await waitForClientAuth(page);

		const gatedCard = tierCard(page, gatedTierName);
		await expect(gatedCard).toBeVisible({ timeout: 15_000 });

		// Server-rendered off the tier listing, before any verdict is asked for:
		// the requirement is stated, and — since the tier CTA is stuck on
		// `tier_requires_subscription` for a monetized tier — this list's link is
		// the ONLY way into the questionnaire from here.
		await expect(gatedCard.getByText('A membership questionnaire is required.')).toBeVisible();
		const questionnaireLink = gatedCard.getByRole('link', {
			name: `Open the membership questionnaire for ${gatedTierName}`
		});
		await expect(questionnaireLink).toBeVisible();

		// ── Direction 1: gated + priced ⇒ no CTA, but the price survives ────────
		const gatedPlanCard = planCard(page, gatedPlan.name);
		await expect(gatedPlanCard.getByText(GATED_NOTE)).toBeVisible({ timeout: 15_000 });
		// The member can still see what they are working toward. A gate that took
		// the whole plan card away would pass every absence assertion below while
		// being a worse UI than the dead button #733 removed.
		await expect(
			gatedPlanCard.getByRole('heading', { level: 4, name: gatedPlan.name })
		).toBeVisible();
		await expect(gatedPlanCard.getByText('Free', { exact: true })).toBeVisible();

		// Absence asserted on TEXT, not on `getByRole('button', …)`: several
		// membership CTAs are links rather than buttons, so a role-scoped absence
		// can pass simply because the element changed role. Both strings below are
		// rendered by `PlanCard`'s `subscribe` branch and by nothing else.
		await expect(gatedPlanCard.getByText(JOIN_FREE)).toHaveCount(0);
		await expect(gatedPlanCard.getByText(FREE_HELPER)).toHaveCount(0);

		// The control, on the same page load: same org, same plan shape, no gate.
		// If this one loses its CTA too, the withholding above is not the gate
		// talking and direction 1 proves nothing.
		const openPlanCard = planCard(page, openPlan.name);
		await expect(openPlanCard.getByText(JOIN_FREE)).toBeVisible({ timeout: 15_000 });
		await expect(openPlanCard.getByText(GATED_NOTE)).toHaveCount(0);

		// ── Clear the gate ─────────────────────────────────────────────────────
		// An auto-graded questionnaire rather than a manual-approval gate, because
		// approval cannot be cleared on a monetized tier from the member side: the
		// free `/apply` path is refused by gate #6 (`tier_requires_subscription`),
		// so there would be no application for staff to approve. The questionnaire
		// gate (#8) needs nothing but the submission, and a passing auto-graded one
		// takes the viewer straight to `proceed_to_payment`.
		await questionnaireLink.click();
		await page.waitForURL('**/questionnaire/**');
		await expect(page.getByRole('heading', { name: 'Membership questionnaire' })).toBeVisible();

		const submit = page.getByRole('button', { name: 'Submit Questionnaire' });
		// Disabled until the mandatory question is answered — an empty submission
		// would score 0 and burn the attempt (#596).
		await expect(submit).toBeDisabled();
		await page
			.getByRole('radio', { name: MEMBERSHIP_QUESTION.automatic.correct, exact: true })
			.click();
		await expect(submit).toBeEnabled();
		await submit.click();

		// Even a passing auto-graded submission takes the PENDING exit: the grader
		// is queued on commit, so the 200 carries no verdict. The toast plus the
		// return trip is the whole confirmation.
		await expect(
			page.getByText("Questionnaire submitted — we'll let you know once it's been evaluated.")
		).toBeVisible({ timeout: 15_000 });
		await page.waitForURL(`**/org/${org.slug}`, { timeout: 15_000 });

		// ── Direction 2: gate cleared ⇒ the CTA comes back ─────────────────────
		// Grading is asynchronous and the verdict is a cached client query, so the
		// poll re-reads the page rather than waiting in place.
		await expect(async () => {
			await gotoHydrated(page, membershipPath(org.slug));
			await waitForClientAuth(page);
			await expect(planCard(page, gatedPlan.name).getByText(JOIN_FREE)).toBeVisible({
				timeout: 10_000
			});
		}).toPass({ timeout: 60_000 });

		const clearedPlanCard = planCard(page, gatedPlan.name);
		await expect(clearedPlanCard.getByText(GATED_NOTE)).toHaveCount(0);
		await expect(clearedPlanCard.getByText(FREE_HELPER)).toBeVisible();

		// …and the CTA is live, not merely present. Withholding a plan from an
		// eligible member and handing back a button that 400s are the same bug
		// wearing different clothes, so the round trip is finished here: the
		// backend answers a FREE subscribe with a null `checkout_url` and an
		// already-ACTIVE subscription, which the dialog reports itself.
		await clearedPlanCard.getByRole('button', { name: JOIN_FREE }).click();
		const dialog = page.getByRole('dialog', { name: `Join ${gatedPlan.name}` });
		await expect(dialog).toBeVisible();
		await expect(
			dialog.getByText("There's nothing to pay. Your membership starts as soon as you confirm.")
		).toBeVisible();
		await dialog.getByRole('button', { name: 'Join now' }).click();
		await expect(dialog.getByText('Welcome, member!')).toBeVisible({ timeout: 20_000 });

		// The membership landed on the GATED tier — the one whose gate was cleared
		// — and not on the ungated neighbour or the org's default tier.
		await gotoHydrated(page, `/org/${org.slug}`);
		await waitForClientAuth(page);
		await expect(page.getByLabel(`Membership tier: ${gatedTierName}`)).toBeVisible({
			timeout: 20_000
		});

		await page.context().close();
	});
});
