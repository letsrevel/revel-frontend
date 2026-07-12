import { test, expect } from '../../support/fixtures';
import { ApiClient } from '../../support/api';
import {
	createEventToken,
	createOrganization,
	createOrgToken,
	createTicketedEvent,
	createVerifiedUser
} from '../../support/factories';
import { gotoHydrated } from '../../support/navigation';

// J12.2 (USER_JOURNEYS.md) — expired vs used-up invitation tokens render
// distinct 410 guidance (revel-backend#681). The existing j01 token-preview
// spec already covers used-up ORG + expired EVENT; this fills the other two
// quadrants: expired ORG and used-up EVENT. Both must show the reason and
// offer NO "Sign In to Claim".

test.describe('J12 token expiry guidance @p2', () => {
	test('an expired org token explains expiry, not a claim CTA', async ({ page }) => {
		const org = await createOrganization();
		const token = await createOrgToken(org.owner, org.slug, org.defaultTierId);
		// Backdate the expiry through the admin API (the factory has no expiry arg).
		const ownerApi = await ApiClient.login(org.owner.email, org.owner.password);
		await ownerApi.put(`/api/organization-admin/${org.slug}/tokens/${token.id}`, {
			expires_at: new Date(Date.now() - 60_000).toISOString()
		});

		await gotoHydrated(page, `/join/org/${token.id}`);

		await expect(page.getByText('This invitation is no longer valid')).toBeVisible();
		await expect(page.getByText(`Your invitation to ${org.name} has expired.`)).toBeVisible();
		await expect(page.getByRole('button', { name: 'Sign In to Claim' })).toHaveCount(0);
	});

	test('a fully-used event token explains it is used up, not a claim CTA', async ({ page }) => {
		const [event, claimer] = await Promise.all([
			createTicketedEvent({ freeTier: false }),
			createVerifiedUser('TokenExhauster')
		]);
		const token = await createEventToken(event.id, { maxUses: 1 });
		// Exhaust the single use so the next viewer sees the used-up reason.
		const claimerApi = await ApiClient.login(claimer.email, claimer.password);
		await claimerApi.post(`/api/events/claim-invitation/${token.id}`);

		await gotoHydrated(page, `/join/event/${token.id}`);

		await expect(page.getByText('This invitation is no longer valid')).toBeVisible();
		await expect(
			page.getByText(`This invitation link to ${event.name} has already been fully used.`)
		).toBeVisible();
		await expect(page.getByRole('button', { name: 'Sign In to Claim' })).toHaveCount(0);
	});
});
