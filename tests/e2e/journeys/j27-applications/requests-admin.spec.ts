import type { Locator, Page } from '@playwright/test';
import { test, expect } from '../../support/fixtures';
import { ApiClient } from '../../support/api';
import {
	applyViaApi,
	cancelApplicationViaApi,
	createMembershipQuestionnaire,
	createMembershipTier,
	createOrganization,
	createVerifiedUser,
	rejectApplication,
	setOrgMembershipPolicy,
	MEMBERSHIP_QUESTION,
	type CreatedOrg,
	type ThrowawayUser
} from '../../support/factories';
import { pageAs } from '../../support/session';
import { requestCard, requestStatusRow } from '../../support/membership-locators';
import { gotoHydrated, waitForClientAuth } from '../../support/navigation';
import { pickSelectOption } from '../../support/ui';

// J27.5 (USER_JOURNEYS.md) — the org-admin side of membership applications:
// the Members-area REQUESTS tab, which PR④ turned from a pending-only queue
// into the whole application board (six status filters, tier-aware approval, a
// link to the questionnaire submission that unlocked the application), plus the
// permanent redirect off the retired standalone requests page.
//
// Isolation: every test arranges its OWN org (throwaway owner) and its own
// applicants, so parallel projects/workers and a `retries: 1` re-run never
// share a board — three of these tests approve rows, which is not undoable.
//
// Backend behaviours these specs are built on, verified live against this
// branch (contradicting them means the backend moved, not the spec):
//   * a TIER-BEARING apply parks as PENDING only while approval is required —
//     on an ungated org it completes on the spot, so the board arrange flips
//     the org's approval policy on BETWEEN the two applies;
//   * admin approval of a free (plan-less) application goes straight to
//     COMPLETED — "Approved" is the paid path's waiting room (Phase 2), so no
//     row on a free board ever reaches it and the Approved filter is arranged
//     to be legitimately empty;
//   * a MANUAL-mode membership questionnaire queues no evaluation at all
//     (`evaluation_status` stays null); HYBRID is the mode that files one as
//     "pending review", which is what the card's review hint keys on.

/** The requester's card, by display name ("E2E <label>" for throwaway users).
 *  Since #696 the card is an <article> carrying that name, so both the card and
 *  its status row scope per card instead of relying on one card per view. */
function card(page: Page, name: string): Locator {
	return requestCard(page, name);
}

/** A named card's date+status row. */
function statusRow(page: Page, name: string): Locator {
	return requestStatusRow(requestCard(page, name));
}

/** The active filter button appends a count badge to its label ("Pending 2"),
 *  so the name has to tolerate the suffix — and must NOT be a bare substring
 *  match, which would make "Approved" ambiguous with nothing today but with
 *  any future "Approved (paid)" filter tomorrow. */
function filterButton(page: Page, label: string): Locator {
	return page.getByRole('button', { name: new RegExp(`^${label}(\\s+\\d+)?$`) });
}

/** Open the Members area straight on the Requests tab (the URL PR④'s redirect
 *  now points at) and confirm the tab really is the selected one. */
async function openRequestsTab(page: Page, orgSlug: string): Promise<void> {
	await gotoHydrated(page, `/org/${orgSlug}/admin/members?tab=requests`);
	await waitForClientAuth(page);
	await expect(page.getByRole('tab', { name: 'Requests' })).toHaveAttribute(
		'aria-selected',
		'true'
	);
}

/** Switch the board to one status filter and confirm the pressed state moved
 *  (the filters are toggle BUTTONS with aria-pressed, not tabs). */
async function selectFilter(page: Page, label: string): Promise<void> {
	await filterButton(page, label).click();
	await expect(filterButton(page, label)).toHaveAttribute('aria-pressed', 'true');
}

/** The applicant's submission, as the ORG sees it. Grading is asynchronous, so
 *  this polls until the evaluation is on file — arranging the "Review pending"
 *  hint means arranging the evaluation that renders it, not just a submission. */
async function submissionPendingReview(
	owner: ThrowawayUser,
	wrapperId: string,
	email: string
): Promise<string> {
	const api = await ApiClient.login(owner.email, owner.password);
	let submissionId = '';
	await expect
		.poll(
			async () => {
				const list = await api.get<{
					results: Array<{
						id: string;
						user: { email: string };
						evaluation_status?: string | null;
					}>;
				}>(`/api/questionnaires/${wrapperId}/submissions`);
				const mine = list.results.find((s) => s.user.email === email);
				submissionId = mine?.id ?? '';
				return mine?.evaluation_status ?? null;
			},
			{ timeout: 45_000, message: 'submission never reached "pending review"' }
		)
		.toBe('pending review');
	return submissionId;
}

/** One org whose board carries five applications in five different states. */
interface Board {
	org: CreatedOrg;
	/** Display names, by the status their row sits in. */
	names: Record<'tieredPending' | 'plainPending' | 'completed' | 'rejected' | 'cancelled', string>;
}

async function arrangeBoard(): Promise<Board> {
	const [org, completed, tiered, plain, rejected, cancelled] = await Promise.all([
		createOrganization({ acceptMembershipRequests: true }),
		createVerifiedUser('Completed'),
		createVerifiedUser('Tiered'),
		createVerifiedUser('Plain'),
		createVerifiedUser('Rejected'),
		createVerifiedUser('Cancelled')
	]);

	// While nothing gates the org, a tier-bearing apply completes outright —
	// that is the COMPLETED row, and it has to be taken before approval is
	// switched on.
	const done = await applyViaApi(completed, org.slug, { tierId: org.defaultTierId });
	expect(done.status).toBe('completed');

	// From here on staff decide, so the two PENDING rows survive: one carrying
	// the tier it applied for, one tier-less (what the UI's ApplyDialog sends).
	await setOrgMembershipPolicy(org.owner, org.slug, { requiresApproval: true });
	const tieredApplication = await applyViaApi(tiered, org.slug, { tierId: org.defaultTierId });
	expect(tieredApplication.status).toBe('pending');
	const plainApplication = await applyViaApi(plain, org.slug, { notes: 'E2E: tier-less' });
	expect(plainApplication.status).toBe('pending');

	// The two terminal rows, one decided by staff and one withdrawn by the member.
	const toReject = await applyViaApi(rejected, org.slug);
	await rejectApplication(org.owner, org.slug, toReject.applicationId);
	const toCancel = await applyViaApi(cancelled, org.slug);
	await cancelApplicationViaApi(cancelled, toCancel.applicationId);

	const displayName = (user: ThrowawayUser) => `${user.firstName} ${user.lastName}`;
	return {
		org,
		names: {
			tieredPending: displayName(tiered),
			plainPending: displayName(plain),
			completed: displayName(completed),
			rejected: displayName(rejected),
			cancelled: displayName(cancelled)
		}
	};
}

test.describe('j27 requests admin @p2', () => {
	test('the six status filters slice the application board', async ({ browser }) => {
		test.setTimeout(180_000);
		const { org, names } = await arrangeBoard();

		const page = await pageAs(browser, org.owner);
		await openRequestsTab(page, org.slug);

		// PENDING is the tab's landing filter — no click needed, and both pending
		// rows are there while the three settled ones are not.
		await expect(filterButton(page, 'Pending')).toHaveAttribute('aria-pressed', 'true');
		await expect(card(page, names.tieredPending)).toBeVisible({ timeout: 15_000 });
		await expect(card(page, names.plainPending)).toBeVisible();
		await expect(card(page, names.completed)).toBeHidden();
		await expect(card(page, names.rejected)).toBeHidden();
		await expect(card(page, names.cancelled)).toBeHidden();

		// Each remaining status filter shows ITS row and drops the others — a
		// filter that merely widened the list would pass a "visible" assert.
		await selectFilter(page, 'Completed');
		await expect(card(page, names.completed)).toBeVisible({ timeout: 15_000 });
		await expect(statusRow(page, names.completed)).toContainText('Completed');
		await expect(card(page, names.tieredPending)).toBeHidden();
		await expect(card(page, names.plainPending)).toBeHidden();

		await selectFilter(page, 'Rejected');
		await expect(card(page, names.rejected)).toBeVisible({ timeout: 15_000 });
		await expect(statusRow(page, names.rejected)).toContainText('Rejected');
		await expect(card(page, names.completed)).toBeHidden();
		await expect(card(page, names.cancelled)).toBeHidden();

		await selectFilter(page, 'Cancelled');
		await expect(card(page, names.cancelled)).toBeVisible({ timeout: 15_000 });
		await expect(statusRow(page, names.cancelled)).toContainText('Cancelled');
		await expect(card(page, names.rejected)).toBeHidden();
		await expect(card(page, names.plainPending)).toBeHidden();

		// APPROVED is the paid path's waiting room: a free board never reaches it,
		// so the filter is expected to come back empty — the state exists in the
		// UI ahead of the Phase-2 flow that fills it.
		await selectFilter(page, 'Approved');
		await expect(page.getByRole('heading', { name: 'No pending requests' })).toBeVisible({
			timeout: 15_000
		});
		for (const name of Object.values(names)) {
			await expect(card(page, name)).toBeHidden();
		}

		// ALL is the escape hatch: every row, whatever its state.
		await selectFilter(page, 'All');
		for (const name of Object.values(names)) {
			await expect(card(page, name)).toBeVisible({ timeout: 15_000 });
		}
		await expect(page.getByRole('heading', { name: 'No pending requests' })).toBeHidden();

		await page.context().close();
	});

	test('approving a tier-bearing application skips the tier picker and sends no tier_id', async ({
		browser
	}) => {
		test.setTimeout(180_000);
		const [org, applicant] = await Promise.all([
			createOrganization({ acceptMembershipRequests: true }),
			createVerifiedUser('Tiered')
		]);
		// A SECOND tier is what makes this test discriminate: with one tier the UI
		// auto-picks it and no modal would open for any request. Approval is
		// required so the tier-bearing apply parks as pending instead of
		// completing on the spot.
		await createMembershipTier(org.owner, org.slug, 'Premium');
		await setOrgMembershipPolicy(org.owner, org.slug, { requiresApproval: true });
		const application = await applyViaApi(applicant, org.slug, { tierId: org.defaultTierId });
		expect(application.status).toBe('pending');
		const name = `${applicant.firstName} ${applicant.lastName}`;

		const page = await pageAs(browser, org.owner);
		await openRequestsTab(page, org.slug);

		// The card advertises the tier the member applied for (the chip's screen
		// reader prefix is what turns a bare word into a labelled fact).
		await expect(card(page, name)).toBeVisible({ timeout: 15_000 });
		await expect(page.getByText('Tier: General membership')).toBeVisible();

		const approveModal = page.getByRole('dialog', { name: 'Approve Membership Request' });
		const approveCall = page.waitForRequest(
			(request) => request.url().includes('/approve') && request.method() === 'POST'
		);
		await page.getByRole('button', { name: `Approve request from ${name}` }).click();

		// The contract: an EMPTY body. The application already carries its tier and
		// the backend resolves it — sending a tier_id here would let the UI
		// overrule the member's choice with tiers[0].
		const request = await approveCall;
		expect(request.postDataJSON()).toEqual({});

		// No picker, at any point: not while the mutation was in flight, and not
		// after it settled. (Two tiers exist — a tier-less row here WOULD open one.)
		await expect(approveModal).toHaveCount(0);
		await expect(card(page, name)).toBeHidden({ timeout: 15_000 });
		await expect(approveModal).toHaveCount(0);

		// The row moved to COMPLETED — and lost its action buttons with it.
		await selectFilter(page, 'Completed');
		await expect(card(page, name)).toBeVisible({ timeout: 15_000 });
		await expect(statusRow(page, name)).toContainText('Completed');
		await expect(page.getByRole('button', { name: `Approve request from ${name}` })).toHaveCount(0);

		await page.context().close();
	});

	test('approving a tier-less application goes through the tier picker', async ({ browser }) => {
		test.setTimeout(180_000);
		const [org, applicant] = await Promise.all([
			createOrganization({ acceptMembershipRequests: true }),
			createVerifiedUser('Plain')
		]);
		await createMembershipTier(org.owner, org.slug, 'Premium');
		// Tier-less applications park as pending whatever the approval policy —
		// the backend never resolves a default tier on the member's behalf.
		const application = await applyViaApi(applicant, org.slug, { notes: 'E2E: pick a tier' });
		expect(application.status).toBe('pending');
		const name = `${applicant.firstName} ${applicant.lastName}`;

		const page = await pageAs(browser, org.owner);
		await openRequestsTab(page, org.slug);

		await expect(card(page, name)).toBeVisible({ timeout: 15_000 });
		// Nothing to advertise: no tier was applied for.
		await expect(page.getByText('Tier: General membership')).toHaveCount(0);

		await page.getByRole('button', { name: `Approve request from ${name}` }).click();
		const approveModal = page.getByRole('dialog', { name: 'Approve Membership Request' });
		await expect(approveModal).toBeVisible();
		await expect(
			approveModal.getByText(`Select a membership tier to assign to ${name}.`)
		).toBeVisible();

		// Staff pick, and their pick is what lands on the row.
		await pickSelectOption(page, approveModal.getByLabel('Membership Tier'), 'Premium');
		await approveModal.getByRole('button', { name: 'Approve Request' }).click();
		await expect(approveModal).toBeHidden({ timeout: 15_000 });

		await selectFilter(page, 'Completed');
		await expect(card(page, name)).toBeVisible({ timeout: 15_000 });
		await expect(statusRow(page, name)).toContainText('Completed');
		await expect(page.getByText('Tier: Premium')).toBeVisible();

		await page.context().close();
	});

	test('an application carrying a questionnaire submission links to it and flags the review', async ({
		browser
	}) => {
		test.setTimeout(180_000);
		const [org, applicant] = await Promise.all([
			createOrganization({ acceptMembershipRequests: true }),
			createVerifiedUser('Filler')
		]);
		// HYBRID: auto-gradable multiple choice, filed for a human to confirm. It
		// is the only mode that produces `evaluation_status: 'pending review'`,
		// which is exactly what the card's hint renders off.
		const wrapper = await createMembershipQuestionnaire(org.owner, org.slug, {
			evaluationMode: 'hybrid'
		});
		await setOrgMembershipPolicy(org.owner, org.slug, { defaultQuestionnaireId: wrapper.id });
		const name = `${applicant.firstName} ${applicant.lastName}`;

		// The member fills the gate through the UI (the fill route's own coverage
		// is questionnaire-flow.spec.ts; here it is the arrange that produces a
		// real submission), then applies with it attached — the pointer the admin
		// card turns into a link.
		const memberPage = await pageAs(browser, applicant);
		await gotoHydrated(memberPage, `/org/${org.slug}`);
		await waitForClientAuth(memberPage);
		await memberPage.getByRole('link', { name: 'Fill in the membership questionnaire' }).click();
		await memberPage.waitForURL('**/questionnaire/**');
		await memberPage
			.getByRole('radio', { name: MEMBERSHIP_QUESTION.automatic.correct, exact: true })
			.click();
		await memberPage.getByRole('button', { name: 'Submit Questionnaire' }).click();
		await memberPage.waitForURL(`**/org/${org.slug}`, { timeout: 20_000 });
		await memberPage.context().close();

		const submissionId = await submissionPendingReview(org.owner, wrapper.id, applicant.email);
		const application = await applyViaApi(applicant, org.slug, { submissionId });
		expect(application.status).toBe('pending');

		const page = await pageAs(browser, org.owner);
		await openRequestsTab(page, org.slug);
		await expect(card(page, name)).toBeVisible({ timeout: 15_000 });

		// The link points at the org-admin submission viewer — keyed by the
		// WRAPPER questionnaire id, not the inner one the fill route takes.
		const link = page.getByRole('link', { name: 'View questionnaire submission' });
		await expect(link).toBeVisible();
		await expect(link).toHaveAttribute(
			'href',
			`/org/${org.slug}/admin/questionnaires/${wrapper.id}/submissions/${submissionId}`
		);
		// …and it carries the reason it is worth clicking, as its accessible
		// description (the hint is a sibling <span>, tied on by aria-describedby).
		await expect(link).toHaveAccessibleDescription(/review pending/i);

		await page.context().close();
	});

	test('the retired standalone requests page permanently redirects into the tab', async ({
		browser
	}) => {
		test.setTimeout(120_000);
		const org = await createOrganization({ acceptMembershipRequests: true });

		const page = await pageAs(browser, org.owner);
		const response = await page.goto(`/org/${org.slug}/admin/members/requests`);

		// The redirect must be PERMANENT — a 302 would leave every old bookmark
		// and notification link paying for the hop forever.
		const redirected = response?.request().redirectedFrom() ?? null;
		expect(redirected, 'no redirect happened at all').not.toBeNull();
		expect((await redirected?.response())?.status()).toBe(301);

		// …and it lands on the Requests tab, selected.
		expect(new URL(page.url()).pathname + new URL(page.url()).search).toBe(
			`/org/${org.slug}/admin/members?tab=requests`
		);
		await page.locator('body[data-hydrated="true"]').waitFor({ state: 'attached' });
		await waitForClientAuth(page);
		await expect(page.getByRole('tab', { name: 'Requests' })).toHaveAttribute(
			'aria-selected',
			'true'
		);
		await expect(page.getByRole('heading', { name: 'No pending requests' })).toBeVisible({
			timeout: 15_000
		});

		await page.context().close();
	});
});
