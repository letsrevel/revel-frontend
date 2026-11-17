import type { Page } from '@playwright/test';
import { test, expect } from '../../support/fixtures';
import {
	createMembershipQuestionnaire,
	createMembershipTier,
	createOrganization,
	createSubscriptionPlan,
	createVerifiedUser,
	myApplicationFor,
	patchTierPolicy,
	setOrgMembershipPolicy,
	uniqueName,
	MEMBERSHIP_QUESTION,
	type CreatedOrg
} from '../../support/factories';
import { pageAs } from '../../support/session';
import {
	applicationRow,
	membershipCard,
	membershipPath,
	planCard,
	tierCard
} from '../../support/membership-locators';
import { gotoHydrated, waitForClientAuth } from '../../support/navigation';

// J27 (offline-paid memberships) — the whole path from an org that sells
// OFFLINE plans to a paid-up member, walked from both sides.
//
//   A. approval OFF (tier 2):  questionnaire → Join → "awaiting payment" +
//      the plan's instructions → staff see it (dashboard item → pending subscription) →
//      staff record the payment → the card is active.
//   B. approval ON (tier 3 override): questionnaire → Apply → staff approve →
//      the applicant is "awaiting payment" with the ORG-level instructions
//      (the plan carries none) → staff record the payment → active, and the
//      application reads "Completed".
//
// Each test arranges its OWN org (throwaway owner) with three offline tiers, an
// auto-graded org-default membership questionnaire and org-wide payment
// instructions, so the specs are re-runnable and share nothing across projects.
// Nothing here touches Stripe: OFFLINE plans never leave the platform.

const PLAN_INSTRUCTIONS = 'Pay by bank transfer to E2E-PLAN-IBAN-0001 and quote your name.';
const ORG_INSTRUCTIONS = 'Hand the cash to the E2E front desk (organization-wide note).';

interface Scenario {
	org: CreatedOrg;
	tier2: { name: string; planName: string; planId: string };
	tier3: { name: string; planName: string; planId: string };
}

async function arrangeScenario(): Promise<Scenario> {
	const org = await createOrganization({ acceptMembershipRequests: true });
	const questionnaire = await createMembershipQuestionnaire(org.owner, org.slug, {
		evaluationMode: 'automatic'
	});
	// Org-wide: auto-graded questionnaire, NO approval by default, and the
	// fallback payment instructions.
	await setOrgMembershipPolicy(org.owner, org.slug, {
		requiresApproval: false,
		defaultQuestionnaireId: questionnaire.id,
		paymentInstructions: ORG_INSTRUCTIONS
	});

	const names = {
		t1: uniqueName('Offline Tier One'),
		t2: uniqueName('Offline Tier Two'),
		t3: uniqueName('Offline Tier Three')
	};
	const [t1, t2, t3] = await Promise.all([
		createMembershipTier(org.owner, org.slug, names.t1),
		createMembershipTier(org.owner, org.slug, names.t2),
		createMembershipTier(org.owner, org.slug, names.t3)
	]);
	// Tier 3 alone overrides the org default and wants staff approval.
	await patchTierPolicy(org.owner, org.slug, t3.id, { requires_membership_approval: true });

	const offline = { payment_method: 'offline', period_unit: 'month', price: '12.00' } as const;
	const planNames = {
		p1: uniqueName('Offline Plan One'),
		p2: uniqueName('Offline Plan Two'),
		p3: uniqueName('Offline Plan Three')
	};
	const [, p2, p3] = await Promise.all([
		createSubscriptionPlan(org.owner, org.slug, t1.id, { name: planNames.p1, ...offline }),
		// Tier 2 carries its own instructions; tier 3 falls back to the org's.
		createSubscriptionPlan(org.owner, org.slug, t2.id, {
			name: planNames.p2,
			payment_instructions: PLAN_INSTRUCTIONS,
			...offline
		}),
		createSubscriptionPlan(org.owner, org.slug, t3.id, { name: planNames.p3, ...offline })
	]);

	return {
		org,
		tier2: { name: names.t2, planName: planNames.p2, planId: p2.id },
		tier3: { name: names.t3, planName: planNames.p3, planId: p3.id }
	};
}

/** Fill in the org-default membership questionnaire from the tier's own link. */
async function passQuestionnaire(page: Page, orgSlug: string, tierName: string): Promise<void> {
	await gotoHydrated(page, membershipPath(orgSlug));
	await waitForClientAuth(page);
	const link = tierCard(page, tierName).getByRole('link', {
		name: `Open the membership questionnaire for ${tierName}`
	});
	await expect(link).toBeVisible({ timeout: 15_000 });
	await link.click();
	await page.waitForURL('**/questionnaire/**');
	await page
		.getByRole('radio', { name: MEMBERSHIP_QUESTION.automatic.correct, exact: true })
		.click();
	await page.getByRole('button', { name: 'Submit Questionnaire' }).click();
	// Lands back on the tiers (with the tier anchor), not the org landing page.
	await page.waitForURL(`**/org/${orgSlug}/membership**`, { timeout: 15_000 });
}

/** Staff: open the (single) pending subscription's drawer and record its payment. */
async function staffRecordFirstPayment(page: Page, orgSlug: string): Promise<void> {
	await gotoHydrated(page, `/org/${orgSlug}/admin/members?tab=subscriptions`);
	await waitForClientAuth(page);
	// Desktop table row vs mobile card expose different accessible names.
	await page
		.getByRole('button', { name: 'Open subscription details' })
		.or(page.getByRole('button', { name: /E2E/ }))
		.filter({ visible: true })
		.first()
		.click({ timeout: 20_000 });
	const drawer = page.getByRole('dialog').filter({ hasText: 'Record payment' });
	await expect(drawer).toBeVisible({ timeout: 15_000 });
	await drawer.getByRole('button', { name: 'Record payment' }).click();
	const modal = page.getByRole('dialog', { name: 'Record payment' });
	await expect(modal).toBeVisible();
	// Amount and currency come pre-filled from the plan; submit as is.
	await modal.getByRole('button', { name: 'Record payment' }).click();
	await expect(modal).toBeHidden({ timeout: 15_000 });
	await expect(drawer.getByTestId('status-badge').filter({ hasText: 'Active' })).toBeVisible({
		timeout: 15_000
	});
}

/** The member's awaiting-payment card, with the instructions it must carry. */
async function expectAwaitingCard(
	page: Page,
	org: CreatedOrg,
	instructions: string
): Promise<void> {
	await gotoHydrated(page, '/account/memberships');
	await waitForClientAuth(page);
	const card = membershipCard(page, org.name);
	await expect(card).toBeVisible({ timeout: 15_000 });
	await expect(card.getByTestId('membership-subscription-status')).toContainText(
		/awaiting payment/i
	);
	const awaiting = card.getByTestId('membership-awaiting-payment');
	await expect(awaiting).toBeVisible();
	await expect(
		awaiting.getByText(`Your membership starts once ${org.name} confirms your payment.`)
	).toBeVisible();
	await expect(awaiting.getByText(instructions)).toBeVisible();
}

async function expectActiveCard(page: Page, org: CreatedOrg, planName: string): Promise<void> {
	await expect(async () => {
		await gotoHydrated(page, '/account/memberships');
		await waitForClientAuth(page);
		const card = membershipCard(page, org.name);
		await expect(card.getByText(planName)).toBeVisible({ timeout: 10_000 });
		await expect(
			card.getByTestId('membership-subscription-status').filter({ hasText: /active/i })
		).toBeVisible({ timeout: 10_000 });
	}).toPass({ timeout: 45_000 });
	await expect(
		membershipCard(page, org.name).getByTestId('membership-awaiting-payment')
	).toHaveCount(0);
}

test.describe('j32 offline membership @p1', () => {
	test('join without approval: awaiting payment, staff record it, membership is active', async ({
		browser
	}) => {
		test.setTimeout(300_000);
		const [scenario, applicant] = await Promise.all([
			arrangeScenario(),
			createVerifiedUser('OfflineJoin')
		]);
		const { org, tier2 } = scenario;

		const page = await pageAs(browser, applicant);
		await passQuestionnaire(page, org.slug, tier2.name);

		// Back on the tiers: grading is asynchronous, so poll until Join appears.
		let join = planCard(page, tier2.planName).getByRole('button', { name: 'Join', exact: true });
		await expect(async () => {
			await gotoHydrated(page, membershipPath(org.slug));
			await waitForClientAuth(page);
			join = planCard(page, tier2.planName).getByRole('button', { name: 'Join', exact: true });
			await expect(join).toBeVisible({ timeout: 10_000 });
		}).toPass({ timeout: 60_000 });

		// Join: the dialog holds the member as awaiting payment and shows the
		// plan's instructions.
		await join.click();
		const dialog = page.getByRole('dialog', { name: `Join ${tier2.planName}` });
		await expect(dialog).toBeVisible();
		await dialog.getByRole('button', { name: 'Join', exact: true }).click();
		await expect(dialog.getByRole('heading', { name: "You're in, almost." })).toBeVisible({
			timeout: 20_000
		});
		await expect(dialog.getByText(PLAN_INSTRUCTIONS)).toBeVisible();
		await expect(dialog.getByRole('link', { name: /See payment details/ })).toBeVisible();
		await dialog.getByRole('button', { name: 'Close', exact: true }).first().click();

		// The member's account says the same, with the instructions.
		await expectAwaitingCard(page, org, PLAN_INSTRUCTIONS);

		// Staff: the dashboard flags it and links to the pending subscription.
		const staff = await pageAs(browser, org.owner);
		await gotoHydrated(staff, `/org/${org.slug}/admin`);
		await waitForClientAuth(staff);
		await expect(staff.getByText('1 awaiting first payment')).toBeVisible({ timeout: 20_000 });

		// The item's Review link lands on the pending subscriptions (the awaiting
		// member is deliberately NOT a People register entry until the first payment).
		await staff
			.getByRole('listitem')
			.filter({ hasText: '1 awaiting first payment' })
			.getByRole('link', { name: 'Review' })
			.click();
		await staff.waitForURL('**/admin/members?tab=subscriptions&status=pending');
		await expect(
			staff
				.getByRole('button', { name: 'Open subscription details' })
				.or(staff.getByRole('button', { name: /E2E/ }))
				.filter({ visible: true })
				.first()
		).toBeVisible({ timeout: 20_000 });

		// Staff record the first payment → the member is active on tier 2.
		await staffRecordFirstPayment(staff, org.slug);
		await expectActiveCard(page, org, tier2.planName);

		await gotoHydrated(page, `/org/${org.slug}`);
		await waitForClientAuth(page);
		await expect(
			page.getByTestId('status-badge').filter({ hasText: `Membership tier: ${tier2.name}` })
		).toBeVisible({ timeout: 20_000 });

		await staff.context().close();
		await page.context().close();
	});

	test('approval tier: apply, staff approve, awaiting payment, record payment, active', async ({
		browser
	}) => {
		test.setTimeout(300_000);
		const [scenario, applicant] = await Promise.all([
			arrangeScenario(),
			createVerifiedUser('OfflineApply')
		]);
		const { org, tier3 } = scenario;
		const name = `${applicant.firstName} ${applicant.lastName}`;

		const page = await pageAs(browser, applicant);
		await passQuestionnaire(page, org.slug, tier3.name);

		// Apply from the plan card once the questionnaire verdict has cleared.
		const apply = planCard(page, tier3.planName).getByRole('button', {
			name: `Apply to join with ${tier3.planName}`
		});
		await expect(async () => {
			await gotoHydrated(page, membershipPath(org.slug));
			await waitForClientAuth(page);
			await expect(apply).toBeVisible({ timeout: 10_000 });
		}).toPass({ timeout: 60_000 });
		await apply.click();
		const applyDialog = page.getByRole('dialog');
		await applyDialog.getByRole('button', { name: 'Send application' }).click();
		await expect(applyDialog.getByText('Application received')).toBeVisible({ timeout: 20_000 });
		const application = await myApplicationFor(applicant, org.slug);
		expect(application?.status).toBe('pending');
		expect(application?.plan_id).toBe(tier3.planId);

		// Staff see the plan on the card and approve.
		const staff = await pageAs(browser, org.owner);
		await gotoHydrated(staff, `/org/${org.slug}/admin/members?tab=applications`);
		await waitForClientAuth(staff);
		const requestCardEl = staff.getByRole('article', { name, exact: true });
		await expect(requestCardEl).toBeVisible({ timeout: 20_000 });
		await expect(requestCardEl.getByText(tier3.planName)).toBeVisible();
		await requestCardEl.getByRole('button', { name: `Approve request from ${name}` }).click();
		await expect(staff.getByRole('article', { name, exact: true })).toBeHidden({
			timeout: 20_000
		});

		// The applicant is now awaiting payment, with the ORG-level instructions
		// because the plan carries none; the application says so too.
		await expectAwaitingCard(page, org, ORG_INSTRUCTIONS);
		await expect(
			applicationRow(page, 'In progress', org.name).getByText('Accepted, awaiting payment', {
				exact: true
			})
		).toBeVisible();

		// Staff record the payment → active; the application reads Completed.
		await staffRecordFirstPayment(staff, org.slug);
		await expectActiveCard(page, org, tier3.planName);
		await expect(
			applicationRow(page, 'Closed', org.name).getByText('Completed', { exact: true })
		).toBeVisible({ timeout: 20_000 });

		await staff.context().close();
		await page.context().close();
	});
});
