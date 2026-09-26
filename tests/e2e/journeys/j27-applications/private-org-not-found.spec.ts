import { test, expect } from '../../support/fixtures';
import { createOrganization, createVerifiedUser } from '../../support/factories';
import { ApiClient, ApiError } from '../../support/api';
import { authenticateContext } from '../../support/session';
import { gotoHydrated } from '../../support/navigation';
import { membershipPath } from '../../support/membership-locators';

// J27.6 (USER_JOURNEYS.md) — private orgs are not enumerable. For an org the
// caller cannot see, both GET /join-eligibility and POST /apply answer 404
// (never a 200/403 that would confirm the slug exists), and the membership /
// apply page renders the plain not-found page — for an anonymous visitor and a
// logged-in outsider alike.
//
// The org is PRIVATE yet accepts membership requests, so a 404 is provably
// about visibility and not "applications are closed". The owner reaching the
// same URL is the control that the slug is real.
//
// Throwaway org + throwaway outsider; nothing is mutated.

test.describe('J27 private org is not enumerable @p2', () => {
	test('a guessed private-org slug 404s on the membership page and the apply API', async ({
		browser,
		page
	}) => {
		test.setTimeout(120_000);

		const [org, outsider] = await Promise.all([
			createOrganization(),
			createVerifiedUser('Outsider')
		]);
		// Private (the default for a new org), but open to applications.
		const ownerApi = await ApiClient.login(org.owner.email, org.owner.password);
		await ownerApi.put(`/api/organization-admin/${org.slug}`, {
			visibility: 'private',
			accept_membership_requests: true
		});

		const path = membershipPath(org.slug);

		// Control: the owner sees the org's membership page.
		const ownerContext = await browser.newContext();
		await authenticateContext(ownerContext, org.owner);
		const ownerPage = await ownerContext.newPage();
		try {
			const ownerResponse = await ownerPage.goto(path);
			expect(ownerResponse?.status()).toBe(200);
			await expect(ownerPage.getByText(org.name).first()).toBeVisible();
		} finally {
			await ownerContext.close();
		}

		// Anonymous visitor: the not-found page, with no trace of the org.
		const anonResponse = await page.goto(path);
		expect(anonResponse?.status()).toBe(404);
		await gotoHydrated(page, path);
		await expect(page.getByRole('heading', { name: 'Page Not Found', level: 1 })).toBeVisible();
		await expect(page.getByText(org.name)).toHaveCount(0);

		// Logged-in outsider: same 404, same not-found page.
		const outsiderContext = await browser.newContext();
		await authenticateContext(outsiderContext, outsider);
		const outsiderPage = await outsiderContext.newPage();
		try {
			const outsiderResponse = await outsiderPage.goto(path);
			expect(outsiderResponse?.status()).toBe(404);
			await expect(
				outsiderPage.getByRole('heading', { name: 'Page Not Found', level: 1 })
			).toBeVisible();
			await expect(outsiderPage.getByText(org.name)).toHaveCount(0);
			await expect(outsiderPage.getByRole('button', { name: /Apply|Join/ })).toHaveCount(0);
		} finally {
			await outsiderContext.close();
		}

		// The API the page would call answers 404 too — both the eligibility
		// probe and the apply POST, so neither confirms the slug exists.
		const outsiderApi = await ApiClient.login(outsider.email, outsider.password);
		const statusOf = async (call: Promise<unknown>): Promise<number> => {
			try {
				await call;
				return 200;
			} catch (error) {
				if (error instanceof ApiError) return error.status;
				throw error;
			}
		};
		const base = `/api/me/organizations/${org.slug}`;
		expect(
			await statusOf(outsiderApi.get(`${base}/join-eligibility?tier_id=${org.defaultTierId}`))
		).toBe(404);
		expect(await statusOf(outsiderApi.post(`${base}/apply`, { tier_id: org.defaultTierId }))).toBe(
			404
		);
		// Control: the owner's eligibility probe on the same slug is a 200.
		expect(
			await statusOf(ownerApi.get(`${base}/join-eligibility?tier_id=${org.defaultTierId}`))
		).toBe(200);
	});
});
