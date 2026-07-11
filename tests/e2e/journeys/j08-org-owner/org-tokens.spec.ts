import { test, expect } from '../../support/fixtures';
import { createOrganization } from '../../support/factories';
import { authenticateContext, uiLogin } from '../../support/session';
import { gotoHydrated, waitForClientAuth } from '../../support/navigation';
import { closeDialog } from '../../support/ui';

// J8.4 (USER_JOURNEYS.md) — org invitation tokens, fully through the UI:
// owner creates a membership-granting link, and a fresh visitor follows the
// ACTUAL share link (`/org/<slug>?ot=<code>`): the hook captures the token
// into a cookie, the login that follows auto-claims it (claimPendingTokens),
// and the visitor lands as an active member.
//
// The claimer is the SEEDED persona ivan (`user2`) because the share-link
// journey requires a UI login — throwaway users can't use the demo-mode
// account dropdown. The dedicated logged-in claim page (/join/org/<code>)
// is 500-broken (renders token.organization.name but the API field is a
// UUID) — tracked in #601, and j01 token-preview (group g) is blocked on it.
//
// Isolation: throwaway-owned org; parallel projects claim DIFFERENT orgs, so
// sharing ivan is race-free.

test.describe('J8 org tokens @p1', () => {
	test('create membership link → claim via share link + login → member', async ({ browser }) => {
		const org = await createOrganization();
		const claimerName = 'Ivan Attendee';

		// Owner creates the invitation link through the UI.
		const ownerContext = await browser.newContext();
		await authenticateContext(ownerContext, org.owner);
		const ownerPage = await ownerContext.newPage();
		await gotoHydrated(ownerPage, `/org/${org.slug}/admin/tokens`);
		await waitForClientAuth(ownerPage);

		await ownerPage.getByRole('button', { name: 'Create Link' }).click();
		const createModal = ownerPage.getByRole('dialog', { name: 'Create Invitation Token' });
		await expect(createModal).toBeVisible();
		await createModal.getByLabel('Name (optional)').fill('E2E membership link');
		await createModal.getByLabel('Grant membership access').check();
		await createModal.getByLabel('Membership Tier').selectOption({ label: 'General membership' });
		await createModal.getByRole('button', { name: 'Create Token' }).click();
		await expect(ownerPage.getByText(/Invitation link created successfully/)).toBeVisible({
			timeout: 15_000
		});

		// Grab the shareable URL from the token card's share dialog: the public
		// org page with `?ot=<code>`, which the server hook captures into a
		// cookie that the next login claims.
		await ownerPage.getByRole('button', { name: 'Share token' }).click();
		const shareDialog = ownerPage.getByRole('dialog', { name: 'Share Invitation Link' });
		const shareUrl = await shareDialog.getByLabel('Shareable URL').inputValue();
		const shareTarget = new URL(shareUrl);
		expect(
			shareTarget.searchParams.get('ot'),
			`share URL carries the token code: ${shareUrl}`
		).toBeTruthy();
		await closeDialog(ownerPage, shareDialog);

		// A logged-OUT visitor follows the share link: the ?ot= hook stores the
		// token, and logging in claims it and flashes a confirmation toast.
		const claimerContext = await browser.newContext();
		const claimerPage = await claimerContext.newPage();
		await gotoHydrated(claimerPage, shareTarget.pathname + shareTarget.search);
		await expect(claimerPage.getByRole('heading', { name: org.name }).first()).toBeVisible();

		await uiLogin(claimerPage, 'user2');
		await expect(claimerPage.getByText(`You've been added to ${org.name}!`)).toBeVisible({
			timeout: 15_000
		});

		// The owner sees the claimer as a member.
		await gotoHydrated(ownerPage, `/org/${org.slug}/admin/members`);
		const memberCard = ownerPage
			.locator('article, li, div')
			.filter({ hasText: claimerName })
			.filter({ hasText: /Active/ })
			.first();
		await expect(async () => {
			await gotoHydrated(ownerPage, `/org/${org.slug}/admin/members`);
			await expect(memberCard).toBeVisible({ timeout: 5_000 });
		}).toPass({ timeout: 45_000 });

		await claimerContext.close();
		await ownerContext.close();
	});
});
