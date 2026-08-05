import { test, expect } from '../../support/fixtures';
import {
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
import { membershipPath, tierCard } from '../../support/membership-locators';
import { gotoHydrated, waitForClientAuth } from '../../support/navigation';
import { closeDialog } from '../../support/ui';

// J27 (USER_JOURNEYS.md) — choosing a TIER, through the UI, on
// /org/[slug]/membership. Filed as #723: the suite was green over a feature
// that had no user interface, and said so in a comment.
//
// Until #720/#727 every tier-bearing apply in this suite was arranged with
// `applyViaApi`, because `ApplyDialog` posted no tier and `MembershipCta`
// asked for eligibility without one. Two things follow from that, and both are
// what these tests exist to hold down:
//
//   * an application created through the UI could not carry a tier, so staff
//     had to guess one at approval time;
//   * a tier's own questionnaire/approval OVERRIDES were dead configuration —
//     with no `tier_id` on the eligibility request the backend resolved the org
//     default, so a gated tier looked exactly like an ungated one. j23
//     tier-policy.spec.ts round-trips those overrides through the admin form,
//     and j27 questionnaire-flow.spec.ts exercises the gate via the ORG
//     default; neither could fail when the tier half was missing. Test 2 is
//     that missing half, and it is the case that broke in production.
//
// The ARRANGE steps stay on the API (orgs, tiers, questionnaires, plans) —
// what has to go through the UI is the ACT.
//
// Isolation, the j27 house rule: every test arranges its OWN throwaway org and
// its own applicant, so parallel projects/workers and a `retries: 1` re-run
// never share an application (one per user per org).
//
// Backend behaviours these tests are built on, all of them already relied on
// elsewhere in j27: a new org requires no approval and sets no questionnaire,
// so a TIER-BEARING apply has nothing left to gate on and completes on the
// spot — which is why every act below ends in "You're in!" rather than
// "Application received".

/** The tier a post-save signal gives every new org. */
const DEFAULT_TIER = 'General membership';
/** ApplyDialog's completed-outcome title. */
const JOINED = "You're in!";

test.describe('j27 tier selection @p2', () => {
	test('applying from a named tier puts THAT tier on the application', async ({ browser }) => {
		test.setTimeout(180_000);
		const [org, applicant] = await Promise.all([
			createOrganization({ acceptMembershipRequests: true }),
			createVerifiedUser('TierApplicant')
		]);
		// A second, NAMED tier beside the auto-created default. Picking the one
		// that is NOT the fallback is what gives the assertion teeth: a dropped
		// `tier_id` does not fail loudly, it silently resolves to something else.
		const goldName = uniqueName('Gold Tier');
		const gold = await createMembershipTier(org.owner, org.slug, goldName);

		const page = await pageAs(browser, applicant);
		await gotoHydrated(page, membershipPath(org.slug));
		await waitForClientAuth(page);

		// Both tiers are on offer; the applicant chooses.
		const goldCard = tierCard(page, goldName);
		await expect(goldCard).toBeVisible({ timeout: 15_000 });
		await expect(tierCard(page, DEFAULT_TIER)).toBeVisible();
		// The CTA names its tier — N cards must not all read "Join".
		await goldCard.getByRole('button', { name: `Join ${goldName}` }).click();

		// …and so does the dialog it opens.
		const dialog = page.getByRole('dialog', { name: `Join ${goldName}` });
		await expect(dialog).toBeVisible();
		await dialog.getByLabel('Message (optional)').fill('E2E: gold, please');
		await dialog.getByRole('button', { name: 'Send application' }).click();

		const outcome = page.getByRole('dialog', { name: JOINED });
		await expect(outcome).toBeVisible({ timeout: 15_000 });
		await expect(outcome.getByText(`You're now a member of ${org.name}.`)).toBeVisible();
		await closeDialog(page, outcome);

		// THE assertion (#723): read back from the MEMBER's own applications list,
		// not from the apply response the dialog just consumed. Fails the moment
		// ApplyDialog stops sending `tier_id`.
		const application = await myApplicationFor(applicant, org.slug);
		expect(application?.status).toBe('completed');
		expect(application?.tier_id).toBe(gold.id);
		expect(application?.tier_name).toBe(goldName);

		// …and the membership it produced sits at that tier, not at the default the
		// backend would have fallen back to.
		await gotoHydrated(page, `/org/${org.slug}`);
		await waitForClientAuth(page);
		await expect(
			page.getByTestId('status-badge').filter({ hasText: `Membership tier: ${goldName}` })
		).toBeVisible({ timeout: 15_000 });
		await expect(
			page.getByTestId('status-badge').filter({ hasText: `Membership tier: ${DEFAULT_TIER}` })
		).toHaveCount(0);

		await page.context().close();
	});

	test('a tier-level questionnaire override gates that tier and leaves its neighbour open', async ({
		browser
	}) => {
		test.setTimeout(240_000);
		const [org, applicant] = await Promise.all([
			createOrganization({ acceptMembershipRequests: true }),
			createVerifiedUser('TierGate')
		]);
		// Deliberately NO org-level default questionnaire: whatever gates below is
		// the TIER's own override and nothing else. (questionnaire-flow.spec.ts
		// owns the org-default path, and passes whether or not overrides work.)
		const gatedName = uniqueName('Gated Tier');
		const openName = uniqueName('Open Tier');
		const [gated, questionnaire] = await Promise.all([
			createMembershipTier(org.owner, org.slug, gatedName),
			createMembershipQuestionnaire(org.owner, org.slug, { evaluationMode: 'manual' }),
			// The ungated control. Its id is never needed — the grid addresses it
			// by name — so it is created and left unnamed here.
			createMembershipTier(org.owner, org.slug, openName)
		]);
		await patchTierPolicy(org.owner, org.slug, gated.id, {
			membership_questionnaire: questionnaire.id
		});

		const page = await pageAs(browser, applicant);
		await gotoHydrated(page, membershipPath(org.slug));
		await waitForClientAuth(page);

		const gatedCard = tierCard(page, gatedName);
		const openCard = tierCard(page, openName);

		// Server-rendered, straight off the tier listing: the requirement is stated
		// on the card before any verdict is asked for, and only on the card that
		// carries the override.
		await expect(gatedCard.getByText('A membership questionnaire is required.')).toBeVisible({
			timeout: 15_000
		});
		await expect(openCard.getByText('A membership questionnaire is required.')).toHaveCount(0);

		// …and the per-tier VERDICT agrees. This is the assertion #723 is about:
		// the eligibility request carries `tier_id`, so one tier's Join button is
		// replaced by the gate while its neighbour's is untouched. Drop the
		// `tier_id` and both cards resolve the org default — no questionnaire —
		// and both offer Join, which is exactly what shipped to production.
		const gateCta = gatedCard.getByRole('link', {
			name: 'Fill in the membership questionnaire'
		});
		await expect(gateCta).toBeVisible({ timeout: 15_000 });
		await expect(gatedCard.getByRole('button', { name: `Join ${gatedName}` })).toHaveCount(0);
		await expect(openCard.getByRole('button', { name: `Join ${openName}` })).toBeVisible({
			timeout: 15_000
		});
		await expect(
			openCard.getByRole('link', { name: 'Fill in the membership questionnaire' })
		).toHaveCount(0);

		// The gated tier's CTA routes to the questionnaire the override names.
		await gateCta.click();
		await page.waitForURL('**/questionnaire/**');
		await expect(page.getByRole('heading', { name: 'Membership questionnaire' })).toBeVisible();
		await expect(page.getByLabel(MEMBERSHIP_QUESTION.manual.question)).toBeVisible();
		// The route takes the INNER Questionnaire id, never the
		// OrganizationQuestionnaire wrapper id the override stores — linking the
		// wrapper would 404 the fill page.
		const routeId = new URL(page.url()).pathname.split('/').pop();
		expect(routeId).toBeTruthy();
		expect(routeId).not.toBe(questionnaire.id);

		// The neighbour stays joinable with that questionnaire still unfilled: the
		// override is a fact about one tier, not about the organization.
		await gotoHydrated(page, membershipPath(org.slug));
		await waitForClientAuth(page);
		await openCard.getByRole('button', { name: `Join ${openName}` }).click();
		const dialog = page.getByRole('dialog', { name: `Join ${openName}` });
		await expect(dialog).toBeVisible();
		await dialog.getByRole('button', { name: 'Send application' }).click();
		await expect(page.getByRole('dialog', { name: JOINED })).toBeVisible({ timeout: 15_000 });

		const application = await myApplicationFor(applicant, org.slug);
		expect(application?.status).toBe('completed');
		expect(application?.tier_name).toBe(openName);

		await page.context().close();
	});

	test('a free, plan-less tier is offered on the grid and can be joined', async ({ browser }) => {
		test.setTimeout(180_000);
		const [org, applicant] = await Promise.all([
			createOrganization({ acceptMembershipRequests: true }),
			createVerifiedUser('FreeTier')
		]);
		const freeName = uniqueName('Free Tier');
		// Its id is never needed — the grid addresses it by name.
		await createMembershipTier(org.owner, org.slug, freeName);
		// A PRICED neighbour, so "the free tier is on the page" means more than
		// "every tier is on the page". The grid is built from the TIER listing
		// rather than the PLAN listing precisely so a tier with nothing to sell is
		// not filtered out of existence (#720, letsrevel/revel-backend#830) — with
		// only free tiers around, a plan-grouped grid would render nothing at all
		// and the difference would be invisible.
		//
		// The plan is OFFLINE (the factory default): an ONLINE one needs Stripe
		// Connect, which a throwaway org does not have.
		const paidName = uniqueName('Paid Tier');
		const paid = await createMembershipTier(org.owner, org.slug, paidName);
		const plan = await createSubscriptionPlan(org.owner, org.slug, paid.id, {
			name: uniqueName('Paid Plan')
		});

		const page = await pageAs(browser, applicant);
		await gotoHydrated(page, membershipPath(org.slug));
		await waitForClientAuth(page);

		const freeCard = tierCard(page, freeName);
		await expect(freeCard).toBeVisible({ timeout: 15_000 });
		// `is_free` is "this tier has no active plan", said in words beside an icon
		// — never by colour alone.
		await expect(freeCard.getByText('Free', { exact: true })).toBeVisible();
		// The priced neighbour is on the same page, is not free, and shows what it
		// costs — the discriminator that makes the badge above mean something.
		const paidCard = tierCard(page, paidName);
		await expect(paidCard.getByText('Free', { exact: true })).toHaveCount(0);
		await expect(paidCard.getByRole('heading', { level: 4, name: plan.name })).toBeVisible();

		// A plan-less tier is joined outright: there is no plan, so there is no
		// checkout to send anybody to.
		await freeCard.getByRole('button', { name: `Join ${freeName}` }).click();
		const dialog = page.getByRole('dialog', { name: `Join ${freeName}` });
		await expect(dialog).toBeVisible();
		await dialog.getByRole('button', { name: 'Send application' }).click();
		await expect(page.getByRole('dialog', { name: JOINED })).toBeVisible({ timeout: 15_000 });

		const application = await myApplicationFor(applicant, org.slug);
		expect(application?.status).toBe('completed');
		expect(application?.tier_name).toBe(freeName);

		await page.context().close();
	});
});
