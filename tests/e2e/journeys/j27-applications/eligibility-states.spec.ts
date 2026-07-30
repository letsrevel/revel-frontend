import { test, expect } from '../../support/fixtures';
import {
	applyViaApi,
	createMembershipTier,
	createOrganization,
	createVerifiedUser,
	patchTierPolicy,
	setOrgMembershipPolicy
} from '../../support/factories';
import { pageAs } from '../../support/session';
import { applicationRow, membershipCard, membershipPath } from '../../support/membership-locators';
import { gotoHydrated, waitForClientAuth } from '../../support/navigation';

// J27 eligibility states — the verdicts that are NOT an application in flight:
// an org that has closed its doors, a user who is already in, and the tier
// policy that outranks the org default.
//
// Live-verified behaviours these specs are built on:
//   * `accept_membership_requests: false` renders NO membership CTA at all on
//     the org LANDING page — it gates the whole <MembershipCta> block on that
//     flag (src/routes/(public)/org/[slug]/+page.svelte), so the eligibility
//     verdict's own copy ("not accepting new members" / "by invitation") never
//     reaches the DOM there. Test 1 asserts the absence, not the copy. The tier
//     grid at /org/[slug]/membership (#720) does NOT read the flag — it asks
//     the backend per tier — so test 1 checks that surface separately.
//   * `requires_membership_approval` is TRI-STATE on a tier: `true`/`false`
//     override the org default, `null` inherits it. Test 3 pins all three
//     against both org defaults.

test.describe('j27 membership eligibility states @p2', () => {
	test('an org that is not accepting members offers no way in', async ({ browser }) => {
		test.setTimeout(180_000);
		// Public so an outsider can read the page at all, but closed to new
		// members — the two flags are independent.
		const [org, visitor] = await Promise.all([
			createOrganization({ acceptMembershipRequests: false, publicVisibility: true }),
			createVerifiedUser('Visitor')
		]);

		const page = await pageAs(browser, visitor);
		await gotoHydrated(page, `/org/${org.slug}`);
		await waitForClientAuth(page);

		// Positive control: the page itself rendered, so the absences below are
		// the policy talking and not a broken/404 page.
		await expect(page.getByRole('heading', { name: org.name, level: 1 })).toBeVisible({
			timeout: 15_000
		});
		await expect(page.getByRole('button', { name: 'Follow' })).toBeVisible();

		await expect(page.getByRole('button', { name: `Join ${org.name}` })).toBeHidden();
		// The whole CTA block is gated away, so neither the reason copy nor the
		// invite-only copy the verdict would map to is rendered.
		await expect(
			page.getByText("This organization isn't accepting new members right now.")
		).toBeHidden();
		await expect(
			page.getByText('Joining is by invitation — ask the organization for an invite link.')
		).toBeHidden();

		// The tier grid is a SECOND public way in since #720, and it is not gated
		// on `accept_membership_requests` the way the landing hero is — it asks the
		// backend per tier instead. So the closed door has to hold there too.
		await gotoHydrated(page, membershipPath(org.slug));
		await waitForClientAuth(page);
		await expect(page.getByRole('heading', { name: 'Membership', level: 1 })).toBeVisible({
			timeout: 15_000
		});

		// Each tier's CTA is a client query, so a bare absence check would pass
		// while the verdicts were still in flight (the slot is an empty skeleton
		// until they land). The settled refusal is a `role="note"` explanation —
		// MembershipCta's `info` branch — so waiting for one is the settle signal.
		// The `.or()` covers the org publishing no tiers at all, where there is no
		// verdict to wait for and nothing to press either way.
		await expect(
			page
				.getByRole('note')
				.first()
				.or(page.getByText(`${org.name} hasn't published any membership tiers yet.`))
		).toBeVisible({ timeout: 20_000 });
		await expect(page.getByRole('button', { name: /^Join / })).toHaveCount(0);

		await page.context().close();
	});

	test('an existing member sees their status and tier instead of a join CTA', async ({
		asMember: page
	}) => {
		// Seed, read-only: charlie is a General-tier member of Org Alpha.
		await gotoHydrated(page, '/org/revel-events-collective');
		await waitForClientAuth(page);

		// Both pills are labelled, so neither status nor tier is conveyed by
		// colour alone.
		await expect(page.getByLabel('Membership status: Active')).toBeVisible({ timeout: 15_000 });
		await expect(page.getByLabel('Membership tier: General membership')).toBeVisible();
		// A member has nothing to apply for — whatever the org's join policy is.
		await expect(page.getByRole('button', { name: /^Join / })).toBeHidden();
		await expect(page.getByRole('button', { name: 'Application pending' })).toBeHidden();
		await expect(
			page.getByRole('link', { name: 'Fill in the membership questionnaire' })
		).toBeHidden();
	});

	test('a tier can override the org approval default in both directions', async ({ browser }) => {
		test.setTimeout(240_000);
		// Two orgs so both org defaults are represented; each gets one tier that
		// INHERITS (the auto-created "General membership", left untouched) and one
		// that OVERRIDES.
		const [lax, strict, laxInherit, laxOverride, strictInherit, strictOverride] = await Promise.all(
			[
				createOrganization({ acceptMembershipRequests: true }),
				createOrganization({ acceptMembershipRequests: true }),
				createVerifiedUser('LaxInherit'),
				createVerifiedUser('LaxOverride'),
				createVerifiedUser('StrictInherit'),
				createVerifiedUser('StrictOverride')
			]
		);

		await Promise.all([
			setOrgMembershipPolicy(lax.owner, lax.slug, { requiresApproval: false }),
			setOrgMembershipPolicy(strict.owner, strict.slug, { requiresApproval: true })
		]);
		const [laxGatedTier, strictOpenTier] = await Promise.all([
			createMembershipTier(lax.owner, lax.slug, 'Approval-gated tier'),
			createMembershipTier(strict.owner, strict.slug, 'Open tier')
		]);
		await Promise.all([
			// `true` on an org that asks for no approval…
			patchTierPolicy(lax.owner, lax.slug, laxGatedTier.id, {
				requires_membership_approval: true
			}),
			// …and `false` on an org that does.
			patchTierPolicy(strict.owner, strict.slug, strictOpenTier.id, {
				requires_membership_approval: false
			})
		]);

		// Tier-bearing applies, so nothing but the resolved approval policy is
		// left to gate on: `completed` means the tier said "no approval needed",
		// `pending` means it said the opposite. Were the backend to ignore
		// `requires_membership_approval` on the tier, both pairs would collapse
		// onto their org's default and all four expectations below would flip.
		const [inheritLax, overrideLax, inheritStrict, overrideStrict] = await Promise.all([
			applyViaApi(laxInherit, lax.slug, { tierId: lax.defaultTierId }),
			applyViaApi(laxOverride, lax.slug, { tierId: laxGatedTier.id }),
			applyViaApi(strictInherit, strict.slug, { tierId: strict.defaultTierId }),
			applyViaApi(strictOverride, strict.slug, { tierId: strictOpenTier.id })
		]);

		// null → inherit "no approval" → straight in.
		expect(inheritLax.status).toBe('completed');
		expect(inheritLax.nextStep).toBeNull();
		// true → override "no approval" → held for staff.
		expect(overrideLax.status).toBe('pending');
		expect(overrideLax.nextStep).toBe('wait_for_approval');
		// null → inherit "approval required" → held for staff.
		expect(inheritStrict.status).toBe('pending');
		expect(inheritStrict.nextStep).toBe('wait_for_approval');
		// false → override "approval required" → straight in.
		expect(overrideStrict.status).toBe('completed');
		expect(overrideStrict.nextStep).toBeNull();

		// The two halves of the lax org, as the members themselves see them: same
		// org, same policy, different tier — one is in, the other is waiting.
		const gatedPage = await pageAs(browser, laxOverride);
		await gotoHydrated(gatedPage, '/account/memberships');
		await waitForClientAuth(gatedPage);
		await expect(
			applicationRow(gatedPage, 'In progress', lax.name).getByLabel('Application status: Pending')
		).toBeVisible({ timeout: 15_000 });
		await expect(membershipCard(gatedPage, lax.name)).toBeHidden();
		await gatedPage.context().close();

		const openPage = await pageAs(browser, laxInherit);
		await gotoHydrated(openPage, '/account/memberships');
		await waitForClientAuth(openPage);
		const card = membershipCard(openPage, lax.name);
		await expect(card).toBeVisible({ timeout: 15_000 });
		await expect(card.getByText('active', { exact: true })).toBeVisible();
		await expect(
			applicationRow(openPage, 'Closed', lax.name).getByLabel('Application status: Completed')
		).toBeVisible();
		await openPage.context().close();
	});
});
