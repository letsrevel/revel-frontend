import type { Page } from '@playwright/test';
import { test, expect } from '../../support/fixtures';
import {
	addStaff,
	approveMembershipRequest,
	createMembershipTier,
	createOrganization,
	createSubscriptionPlan,
	createVerifiedUser,
	requestMembership
} from '../../support/factories';
import { authenticateContext } from '../../support/session';
import { gotoHydrated, waitForClientAuth } from '../../support/navigation';

// Reflow guard (WCAG 1.4.10) for the org admin Members page tabs. Each tab lays
// its cards out in a CSS grid whose mobile column had no template: the implicit
// `auto` track, combined with the grid items' default `min-width: auto`, let
// ONE card's nowrap content (a `truncate`d plan name, a long member name) size
// the column, so a single long name pushed every card — and the whole page —
// past the viewport. Measured on a crowded Org Alpha at 393px: the document was
// 534px wide, the Tiers grid track 502px inside a 329px container, driven by a
// 35-character plan name (374px); plan-row actions (Archive/Delete) sat
// off-screen and clicks on the rest were intercepted. Fixed by `grid-cols-1`
// (minmax(0, 1fr)) on the Tiers/Members/Staff/Requests grids.
//
// Deterministic arrange: a throwaway org whose tier, plan, member/staff and
// pending requester all carry long, realistic names. The assertion is the page
// itself not scrolling horizontally.
//
// Proven to bite on the Tiers tab only: with this arrange on mobile-chrome,
// stripping `grid-cols-1` from the grid in-page reproduces 318px of overflow
// (0px with it). The Members/Staff/Requests cards did NOT overflow with the
// class stripped, even for a 41-character unbreakable surname, so those three
// checks are cheap regression controls rather than proven guards. On desktop
// the columns are constrained by `md:grid-cols-*` anyway (0px either way).

const LONG_TIER = 'Friends of the Collective – Patron & Founding Supporters Circle';
const LONG_PLAN = 'Annual Supporter Membership – Early Bird Founding Circle Rate';

/** Horizontal overflow of the document, in CSS px (0 = the page reflows). */
async function horizontalOverflow(page: Page): Promise<number> {
	return page.evaluate(
		() => document.documentElement.scrollWidth - document.documentElement.clientWidth
	);
}

async function openTab(page: Page, name: RegExp): Promise<void> {
	await page.getByRole('tab', { name }).click();
	await expect(page.getByRole('tab', { name })).toHaveAttribute('aria-selected', 'true');
}

test.describe('Org admin members page reflows on narrow screens @p2', () => {
	test('long tier, plan and member names never widen the page', async ({ browser }) => {
		test.setTimeout(150_000);

		const org = await createOrganization({ acceptMembershipRequests: true });
		const [member, requester] = await Promise.all([
			createVerifiedUser('Wolkenstein-Rodenegg-Hohenberg-Liechtenstein'),
			createVerifiedUser('Oberhollenzer-Pfeifhofer-Unterkircher-Mitterer')
		]);
		const tier = await createMembershipTier(org.owner, org.slug, LONG_TIER);
		await createSubscriptionPlan(org.owner, org.slug, tier.id, { name: LONG_PLAN });
		const request = await requestMembership(member, org.slug);
		await approveMembershipRequest(org.owner, org.slug, request.id, org.defaultTierId);
		await addStaff(org.owner, org.slug, member.email);
		await requestMembership(requester, org.slug);

		const memberName = `${member.firstName} ${member.lastName}`;
		const requesterName = `${requester.firstName} ${requester.lastName}`;

		const context = await browser.newContext();
		await authenticateContext(context, org.owner);
		const page = await context.newPage();
		try {
			await gotoHydrated(page, `/org/${org.slug}/admin/members`);
			await waitForClientAuth(page);

			// Tiers: the long tier + plan names are rendered, and the page fits.
			await openTab(page, /Tiers/);
			await expect(page.getByText(LONG_PLAN, { exact: true })).toBeVisible({ timeout: 15_000 });
			await expect(page.getByText(LONG_TIER).first()).toBeVisible();
			await expect.poll(() => horizontalOverflow(page)).toBe(0);
			// …and every plan-row action is reachable inside the viewport.
			// (Scrolled vertically into view first — the card may sit below the fold;
			// the check that matters is that it is not clipped off to the right.)
			const deletePlan = page.getByRole('button', { name: 'Delete plan' });
			await deletePlan.scrollIntoViewIfNeeded();
			await expect(deletePlan).toBeInViewport({ ratio: 1 });

			// Members: the long-named member card.
			await openTab(page, /^Members/);
			await expect(page.getByText(memberName).filter({ visible: true }).first()).toBeVisible({
				timeout: 15_000
			});
			await expect.poll(() => horizontalOverflow(page)).toBe(0);

			// Staff: the same person, promoted.
			await openTab(page, /^Staff/);
			await expect(page.getByText(memberName).filter({ visible: true }).first()).toBeVisible({
				timeout: 15_000
			});
			await expect.poll(() => horizontalOverflow(page)).toBe(0);

			// Requests: a pending request from another long-named user.
			await openTab(page, /Requests/);
			await expect(page.getByText(requesterName).filter({ visible: true }).first()).toBeVisible({
				timeout: 15_000
			});
			await expect.poll(() => horizontalOverflow(page)).toBe(0);
		} finally {
			await context.close();
		}
	});
});
