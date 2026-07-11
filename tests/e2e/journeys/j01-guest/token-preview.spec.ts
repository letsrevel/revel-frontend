import { test, expect, PERSONAS } from '../../support/fixtures';
import {
	createEventToken,
	createOrganization,
	createOrgToken,
	createTicketedEvent,
	createVerifiedUser
} from '../../support/factories';
import { authenticateContext } from '../../support/session';
import { ApiClient } from '../../support/api';
import { gotoHydrated, waitForClientAuth } from '../../support/navigation';

// J1.8 (USER_JOURNEYS.md) — public token preview on /join/org/[token]: shows
// WHO is inviting and WHAT the token grants, with a sign-in CTA for guests
// and a working claim for logged-in users. Regression guard for #601 (the
// page SSR-500'd for every token until the backend exposed the org fields —
// revel-backend#675).
//
// Non-servable tokens (expired / fully used) answer 410 with a reason
// (revel-backend#681) and render reason-specific guidance instead of a 404.

test.describe('J1 org token preview @p1', () => {
	test('guest sees org name, grants, tier, and a sign-in CTA', async ({ page }) => {
		const org = await createOrganization();
		const token = await createOrgToken(org.owner, org.slug, org.defaultTierId);

		await gotoHydrated(page, `/join/org/${token.id}`);

		await expect(page.getByText("You've been invited!")).toBeVisible();
		await expect(page.getByText(`Join ${org.name}`, { exact: true })).toBeVisible();
		await expect(page.getByText('Member Access', { exact: true })).toBeVisible();
		// The granted tier is named (revel-backend#677).
		await expect(page.getByText('Membership tier: General membership')).toBeVisible();
		await expect(page.getByText("What you'll get:")).toBeVisible();
		await expect(page.getByRole('button', { name: 'Sign In to Claim' })).toBeVisible();
	});

	test('guest sees event name, date, and a sign-in CTA on an event token', async ({ page }) => {
		const event = await createTicketedEvent();
		const token = await createEventToken(event.id);

		await gotoHydrated(page, `/join/event/${token.id}`);

		await expect(page.getByText("You've been invited!")).toBeVisible();
		await expect(page.getByText(event.name).first()).toBeVisible();
		await expect(page.getByText('When')).toBeVisible();
		await expect(page.getByText("What you'll get:")).toBeVisible();
		await expect(page.getByRole('button', { name: 'Sign In to Claim' })).toBeVisible();
	});

	test('logged-in user claims and becomes a member', async ({ browser }) => {
		const [org, claimer] = await Promise.all([
			createOrganization(),
			createVerifiedUser('JoinClaimer')
		]);
		const token = await createOrgToken(org.owner, org.slug, org.defaultTierId);

		const context = await browser.newContext();
		await authenticateContext(context, claimer);
		const page = await context.newPage();
		await gotoHydrated(page, `/join/org/${token.id}`);
		await waitForClientAuth(page);

		await expect(page.getByText(`Join ${org.name}`, { exact: true })).toBeVisible();
		await page.getByRole('button', { name: 'Claim Member Access' }).click();
		await expect(page.getByText(`You're now a member of ${org.name}!`)).toBeVisible({
			timeout: 15_000
		});
		// Success lands on the public org page.
		await page.waitForURL(new RegExp(`/org/${org.slug}`), { timeout: 15_000 });

		await context.close();
	});

	test('used-up org token shows fully-used guidance, not a 404', async ({ page }) => {
		const [org, claimer] = await Promise.all([
			createOrganization(),
			createVerifiedUser('UsedUpClaimer')
		]);
		const token = await createOrgToken(org.owner, org.slug, org.defaultTierId, { maxUses: 1 });
		// Exhaust the single use via the API.
		const claimerApi = await ApiClient.login(claimer.email, claimer.password);
		await claimerApi.post(`/api/organizations/claim-invitation/${token.id}`);

		await gotoHydrated(page, `/join/org/${token.id}`);
		await expect(page.getByText('This invitation is no longer valid')).toBeVisible();
		await expect(
			page.getByText(`This invitation link to ${org.name} has already been fully used.`)
		).toBeVisible();
		await expect(page.getByRole('button', { name: 'Sign In to Claim' })).toHaveCount(0);
	});

	test('expired event token shows expired guidance, not a 404', async ({ page }) => {
		const event = await createTicketedEvent();
		const token = await createEventToken(event.id);
		// Push the expiry into the past via the admin API.
		const ownerApi = await ApiClient.login(PERSONAS.owner.email, PERSONAS.owner.password);
		await ownerApi.put(`/api/event-admin/${event.id}/tokens/${token.id}`, {
			expires_at: new Date(Date.now() - 60 * 60 * 1000).toISOString()
		});

		await gotoHydrated(page, `/join/event/${token.id}`);
		await expect(page.getByText('This invitation is no longer valid')).toBeVisible();
		await expect(page.getByText(`Your invitation to ${event.name} has expired.`)).toBeVisible();
		await expect(page.getByRole('button', { name: 'Sign In to Claim' })).toHaveCount(0);
	});

	test('invalid tokens show a 404, not a crash', async ({ page }) => {
		const orgResponse = await page.goto('/join/org/not-a-real-token');
		expect(orgResponse?.status()).toBe(404);
		const eventResponse = await page.goto('/join/event/not-a-real-token');
		expect(eventResponse?.status()).toBe(404);
	});
});
