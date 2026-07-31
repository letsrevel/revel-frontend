import { test, expect } from '../../support/fixtures';
import {
	approveApplication,
	createMembershipQuestionnaire,
	createMembershipTier,
	createOrganization,
	createSubscriptionPlan,
	createVerifiedUser,
	myApplicationFor,
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
// kind, and it reaches the exact same `gateAction` branch an online plan would
// — the gate blocks long before Stripe is consulted,
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
//   * tier_id ALONE → blocked at gate #6 with `tier_requires_subscription`,
//     whatever the questionnaire says. This is why `TierCard` names a plan in
//     the question it asks on behalf of BOTH the plan cards and the tier CTA
//     (#735); before that the CTA asked tier-only and rendered a dead end.
//
// The SECOND test is the approval half, and #735 is what made it possible to
// write. A manual-approval gate needs an application for staff to approve, and
// on a monetized tier the backend only accepts an application that names a plan
// ("a `plan_id` makes this a paid application", BE #831) — which the UI never
// sent, so the whole gate was unreachable through the UI and this file's first
// test had to clear its gate with a questionnaire instead. Live-verified
// verdicts it is built on:
//   * approval-gated tier + free plan, nothing on file, tier_id ONLY →
//     `tier_requires_subscription`, next_step `null`. A dead end.
//   * the same pair asked WITH the plan → `requires_approval`,
//     next_step `submit_application`. Actionable — and the plan card offers it.
//   * after staff approve → `ManualApprovalGate` falls through and
//     `PaymentReadyGate` allows, so Subscribe returns with no frontend code of
//     its own. That is asserted here, not assumed.
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
/** `TierCard`'s requirement line while the viewer has submitted nothing. */
const QUESTIONNAIRE_POLICY = 'A membership questionnaire is required.';
/** …and what it says once their submission is with the organization. */
const QUESTIONNAIRE_PENDING =
	"Your questionnaire is being reviewed — we'll let you know once it's evaluated.";
/** `PlanCard`'s offline branch — correct in every state, and left alone. */
const OFFLINE_MANAGED = 'Managed by the organization — contact them to join this plan.';

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
		// An auto-graded questionnaire, which is the gate this test is about; the
		// manual-approval one has its own test below (it needs the paid-application
		// path #735 added, and before that could not be cleared from the member
		// side at all). The questionnaire gate (#8) needs nothing but the
		// submission, and a passing auto-graded one takes the viewer straight to
		// `proceed_to_payment`.
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

	// #735. The journey the platform always intended for a gated + paid tier and
	// the UI could not walk: APPLY (with the plan) → staff APPROVE → PAY.
	//
	// Every step of it was blocked by one two-line gap. `ApplyDialog` posted
	// `{tier_id, notes}`, so the only application it could create was a FREE one —
	// which `TierAvailabilityGate` (#6) refuses on a tier carrying an active plan,
	// before `ManualApprovalGate` (#9) ever runs. No application, nothing for
	// staff to approve, and the tier CTA (asking tier-only) rendered the org's
	// approval POLICY next to nothing to press. Hence the first test above having
	// to reach for a questionnaire.
	//
	// A FREE plan again, for the reason given at the top of this file: it takes
	// the identical `gateAction` path an ONLINE plan would — every gate here runs
	// long before Stripe is consulted — while keeping the whole test on a
	// throwaway org.
	test('an approval-gated priced tier can be applied for, approved and then paid', async ({
		browser
	}) => {
		test.setTimeout(240_000);
		const [org, applicant] = await Promise.all([
			createOrganization({ acceptMembershipRequests: true }),
			createVerifiedUser('ApprovalPaid')
		]);

		const tierName = uniqueName('Vetted Paid Tier');
		const tier = await createMembershipTier(org.owner, org.slug, tierName);
		// A TIER override, not the org default: the org's own default tier stays
		// ungated, so anything asserted below is this tier's gate talking.
		await patchTierPolicy(org.owner, org.slug, tier.id, { requires_membership_approval: true });
		const plan = await createSubscriptionPlan(org.owner, org.slug, tier.id, {
			name: uniqueName('Vetted Plan'),
			payment_method: 'free',
			period_unit: 'lifetime',
			price: '0.00'
		});

		const page = await pageAs(browser, applicant);
		await gotoHydrated(page, membershipPath(org.slug));
		await waitForClientAuth(page);

		const card = tierCard(page, tierName);
		await expect(card).toBeVisible({ timeout: 15_000 });
		// Server-rendered from the tier listing: the requirement is stated, and —
		// unlike a questionnaire — it comes with no link, which is exactly why the
		// plan card has to carry the affordance.
		await expect(
			card.getByText('The organization reviews and approves each application.')
		).toBeVisible();

		// ── Apply, from the plan card ──────────────────────────────────────────
		const vettedPlanCard = planCard(page, plan.name);
		// Named with the PLAN: the accessible name is what a screen-reader user
		// hears out of context, and the plan is what the application will carry.
		const applyCta = vettedPlanCard.getByRole('button', {
			name: `Apply to join with ${plan.name}`
		});
		await expect(applyCta).toBeVisible({ timeout: 15_000 });
		// The order is stated, because it is not the obvious one: approval comes
		// BEFORE the charge (`PaymentReadyGate` is the last gate, not the first).
		await expect(
			vettedPlanCard.getByText("The organization reviews applications — you'll join once you're")
		).toBeVisible();
		// The dead Subscribe stays gone — `/subscribe` runs the same gate stack.
		await expect(vettedPlanCard.getByText(JOIN_FREE)).toHaveCount(0);
		// …and the tier CTA points at the plans rather than offering a second,
		// plan-less application the backend would refuse with a 403.
		await expect(
			card.getByText(
				'Choose a plan to apply — the organization reviews applications before payment.'
			)
		).toBeVisible();

		await applyCta.click();
		// Located by role alone, not by name: the dialog RENAMES itself to its
		// outcome ("Application received") once the application lands, so a
		// name-scoped locator would silently stop matching mid-test.
		const applyDialog = page.getByRole('dialog');
		await expect(applyDialog.getByRole('heading', { name: `Join ${tierName}` })).toBeVisible();
		// The dialog says which plan the application will be for.
		await expect(
			applyDialog.getByText(`${org.name} — applying with the ${plan.name} plan.`)
		).toBeVisible();
		await applyDialog.getByRole('button', { name: 'Send application' }).click();
		await expect(applyDialog.getByText('Application received')).toBeVisible({ timeout: 20_000 });

		// The crux, read from the member's OWN account rather than from the
		// response the UI just consumed: the row the UI created is a PAID
		// application. A row with `plan_id: null` here is the #735 bug exactly —
		// it would still be pending, staff could still approve it, and the member
		// would still be refused at gate #6 afterwards.
		const application = await myApplicationFor(applicant, org.slug);
		expect(application?.status).toBe('pending');
		expect(application?.tier_id).toBe(tier.id);
		expect(application?.plan_id).toBe(plan.id);

		// While staff decide there is nothing to press, and the state is said in
		// words rather than left to a greyed-out control.
		await gotoHydrated(page, membershipPath(org.slug));
		await waitForClientAuth(page);
		await expect(
			planCard(page, plan.name).getByText('Your application is with the organization for review.', {
				exact: false
			})
		).toBeVisible({ timeout: 15_000 });
		await expect(planCard(page, plan.name).getByText(`Apply to join`)).toHaveCount(0);
		await expect(card.getByRole('button', { name: 'Application pending' })).toBeDisabled();

		// ── Staff approve ──────────────────────────────────────────────────────
		// No `tier_id`: the application carries its own, so staff are not asked to
		// guess one — which is the whole reason ApplyDialog posts the tier.
		await approveApplication(org.owner, org.slug, application?.id as string);

		// ── …and Subscribe comes back, with no frontend code of its own ─────────
		// `ManualApprovalGate` falls through on an APPROVED row and
		// `PaymentReadyGate` allows: the verdict flips to `proceed_to_payment` and
		// `isBlockedByMembershipGate` stops matching. Polled by re-reading the page
		// because the verdict is a cached client query.
		await expect(async () => {
			await gotoHydrated(page, membershipPath(org.slug));
			await waitForClientAuth(page);
			await expect(planCard(page, plan.name).getByText(JOIN_FREE)).toBeVisible({
				timeout: 10_000
			});
		}).toPass({ timeout: 60_000 });

		const payableCard = planCard(page, plan.name);
		await expect(payableCard.getByText(FREE_HELPER)).toBeVisible();
		await expect(payableCard.getByText(`Apply to join`)).toHaveCount(0);

		// Live, not merely present: finish the round trip the same way the
		// questionnaire journey above does.
		await payableCard.getByRole('button', { name: JOIN_FREE }).click();
		const subscribeDialog = page.getByRole('dialog', { name: `Join ${plan.name}` });
		await expect(subscribeDialog).toBeVisible();
		await subscribeDialog.getByRole('button', { name: 'Join now' }).click();
		await expect(subscribeDialog.getByText('Welcome, member!')).toBeVisible({ timeout: 20_000 });

		// The membership landed on the approval-gated tier, not on the org's
		// ungated default one.
		await gotoHydrated(page, `/org/${org.slug}`);
		await waitForClientAuth(page);
		await expect(page.getByLabel(`Membership tier: ${tierName}`)).toBeVisible({ timeout: 20_000 });

		await page.context().close();
	});

	// The state the two tests above never reach, and the one a real user reported:
	// a gated tier whose ONLY plan is OFFLINE. Both halves of the bug live here.
	//
	// 1. No verdict was fetched at all. `TierCard` picked the plan to ask about
	//    from the SUBSCRIBABLE ones — right for its original job (#733/#734 only
	//    needed to withdraw a Subscribe button, which an offline plan never shows)
	//    but it also suppressed the verdict used to REPORT state. With no plan,
	//    gate #6 answers `tier_requires_subscription` for any monetized tier —
	//    identical before and after the submission, which is precisely why the
	//    member's own state was invisible.
	// 2. The requirement line read the TIER (`questionnaire_id`), never the
	//    viewer, so it said "required" whether they had never started, were
	//    awaiting review, or had passed.
	//
	// An OFFLINE plan, not a free or online one, because that is the shape that
	// fetched nothing — and the shape whose plan card can carry no state of its
	// own either ("Managed by the organization" is all it ever says), leaving the
	// tier's requirement line as the ONLY place the member's standing can appear.
	//
	// A MANUAL questionnaire because it parks: manual mode enqueues no evaluation
	// at all, so the submission sits READY with no evaluation row forever — the
	// backend's `membership_questionnaire_pending` /
	// `wait_for_questionnaire_evaluation` verdict, with no grader race to poll.
	test('a gated tier selling only an offline plan reports the viewer’s questionnaire state', async ({
		browser
	}) => {
		test.setTimeout(240_000);
		const [org, applicant] = await Promise.all([
			createOrganization({ acceptMembershipRequests: true }),
			createVerifiedUser('OfflineGated')
		]);

		const tierName = uniqueName('Offline Gated Tier');
		const [tier, questionnaire] = await Promise.all([
			createMembershipTier(org.owner, org.slug, tierName),
			createMembershipQuestionnaire(org.owner, org.slug, { evaluationMode: 'manual' })
		]);
		// A TIER override, so the org's default tier stays ungated on the same page.
		await patchTierPolicy(org.owner, org.slug, tier.id, {
			membership_questionnaire: questionnaire.id
		});
		const plan = await createSubscriptionPlan(org.owner, org.slug, tier.id, {
			name: uniqueName('Offline Plan'),
			payment_method: 'offline',
			price: '10.00',
			currency: 'EUR',
			period_unit: 'month'
		});

		const page = await pageAs(browser, applicant);
		await gotoHydrated(page, membershipPath(org.slug));
		await waitForClientAuth(page);

		const card = tierCard(page, tierName);
		await expect(card).toBeVisible({ timeout: 15_000 });
		const offlinePlanCard = planCard(page, plan.name);
		await expect(offlinePlanCard.getByText(OFFLINE_MANAGED)).toBeVisible();

		// ── Nothing submitted: the tier's standing rule, and the way in ────────
		await expect(card.getByText(QUESTIONNAIRE_POLICY)).toBeVisible();
		const questionnaireLink = card.getByRole('link', {
			name: `Open the membership questionnaire for ${tierName}`
		});
		await expect(questionnaireLink).toBeVisible();
		// The verdict now names the move instead of dead-ending on gate #6's
		// "This tier requires a paid subscription. Subscribe to a plan to join." —
		// which was doubly wrong here: the only plan cannot be subscribed to.
		await expect(
			card.getByRole('link', { name: 'Fill in the membership questionnaire' })
		).toBeVisible({ timeout: 15_000 });
		await expect(card.getByText('This tier requires a paid subscription')).toHaveCount(0);

		// ── Submit, and leave it with the organization ─────────────────────────
		await questionnaireLink.click();
		await page.waitForURL('**/questionnaire/**');
		await expect(page.getByRole('heading', { name: 'Membership questionnaire' })).toBeVisible();
		await page.getByLabel(MEMBERSHIP_QUESTION.manual.question).fill('E2E: I like this org.');
		await page.getByRole('button', { name: 'Submit Questionnaire' }).click();
		await expect(
			page.getByText("Questionnaire submitted — we'll let you know once it's been evaluated.")
		).toBeVisible({ timeout: 15_000 });
		await page.waitForURL(`**/org/${org.slug}`, { timeout: 15_000 });

		// ── …and the card says so, in the place that used to deny it ───────────
		await gotoHydrated(page, membershipPath(org.slug));
		await waitForClientAuth(page);
		const pendingCard = tierCard(page, tierName);
		await expect(pendingCard.getByText(QUESTIONNAIRE_PENDING)).toBeVisible({ timeout: 15_000 });
		// The bug, asserted as an absence: the "you have not started" copy and its
		// link are what the reporter saw on top of a submission under review.
		await expect(pendingCard.getByText(QUESTIONNAIRE_POLICY)).toHaveCount(0);
		await expect(
			pendingCard.getByRole('link', {
				name: `Open the membership questionnaire for ${tierName}`
			})
		).toHaveCount(0);
		await expect(pendingCard.getByRole('button', { name: 'Application pending' })).toBeDisabled();
		// The offline plan's own copy is correct in every state and stays put.
		await expect(planCard(page, plan.name).getByText(OFFLINE_MANAGED)).toBeVisible();

		await page.context().close();
	});
});
