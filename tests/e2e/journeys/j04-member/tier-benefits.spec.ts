import { test, expect } from '../../support/fixtures';
import { waitForClientAuth } from '../../support/navigation';

// J4 (USER_JOURNEYS.md) — members-only ticket tiers: the seeded FutureStack
// conference carries a "Member Discount" tier with visibility=members-only +
// purchasable_by=members, so the tier list itself differs per viewer.
//
// Personas: karen (multiOrg) is an Org Beta member WITHOUT a FutureStack
// ticket — the tier list only renders for users who hold no ticket, which
// rules out frank (his seeded ticket IS on the Member Discount tier and
// replaces the list with his ticket card). Hannah has no Beta membership.
// All assertions are read-only.

const FUTURESTACK = '/events/tech-innovators-network/futurestack-2025';
const MEMBER_TIER = 'Member Discount';
const PUBLIC_TIER = 'Standard - Full Access';

test.describe('J4 member tier benefits @p2', () => {
	test('a Beta member sees the members-only tier in the ticket options', async ({ asMultiOrg }) => {
		await asMultiOrg.goto(FUTURESTACK);
		// Tier visibility is resolved against the authenticated user — wait for
		// the client auth bootstrap before trusting the rendered list.
		await waitForClientAuth(asMultiOrg);

		await expect(asMultiOrg.getByRole('heading', { name: 'Ticket Options' })).toBeVisible();
		await expect(asMultiOrg.getByRole('heading', { name: MEMBER_TIER, level: 3 })).toBeVisible();
		await expect(asMultiOrg.getByRole('heading', { name: PUBLIC_TIER, level: 3 })).toBeVisible();
	});

	test('a non-member sees the public tiers but not the members-only one', async ({ asUser }) => {
		await asUser.goto(FUTURESTACK);
		await waitForClientAuth(asUser);

		// The list rendered (public tier present) — and the member tier is
		// filtered out server-side, not just de-emphasized.
		await expect(asUser.getByRole('heading', { name: PUBLIC_TIER, level: 3 })).toBeVisible();
		await expect(asUser.getByRole('heading', { name: MEMBER_TIER, level: 3 })).toBeHidden();
	});

	test('an anonymous visitor does not see the members-only tier either', async ({ browser }) => {
		const context = await browser.newContext();
		const page = await context.newPage();
		await page.goto(FUTURESTACK);

		await expect(page.getByRole('heading', { name: PUBLIC_TIER, level: 3 })).toBeVisible();
		await expect(page.getByRole('heading', { name: MEMBER_TIER, level: 3 })).toBeHidden();

		await context.close();
	});
});
