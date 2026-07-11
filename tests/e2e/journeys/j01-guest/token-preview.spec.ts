import { test, expect } from '../../support/fixtures';
import {
	createEventToken,
	createOrganization,
	createOrgToken,
	createTicketedEvent,
	createVerifiedUser
} from '../../support/factories';
import { authenticateContext } from '../../support/session';
import { gotoHydrated, waitForClientAuth } from '../../support/navigation';

// J1.8 (USER_JOURNEYS.md) — public token preview on /join/org/[token]: shows
// WHO is inviting and WHAT the token grants, with a sign-in CTA for guests
// and a working claim for logged-in users. Regression guard for #601 (the
// page SSR-500'd for every token until the backend exposed the org fields —
// revel-backend#675).
//
// The event half runs against the enriched EventTokenSchema
// (revel-backend#679); expired/used-token messaging remains blocked on
// revel-backend#681 (404 for every non-servable token).

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

	test('invalid tokens show a 404, not a crash', async ({ page }) => {
		const orgResponse = await page.goto('/join/org/not-a-real-token');
		expect(orgResponse?.status()).toBe(404);
		const eventResponse = await page.goto('/join/event/not-a-real-token');
		expect(eventResponse?.status()).toBe(404);
	});
});
