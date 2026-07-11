import type { Locator, Page } from '@playwright/test';
import { test, expect } from '../../support/fixtures';
import { gotoHydrated } from '../../support/navigation';

// J3.2 (USER_JOURNEYS.md) — dashboard relationship facets: the "Your Events"
// preset buttons (All / Organizing / Attending / Invited / Bookmarked) scope
// the list to the right relationship per persona.
//
// Read-only on seeded bootstrap data, with personas chosen so their facet
// sets stay stable across full-suite runs:
// - hannah/ivan are avoided for Attending — j05 rsvp-flow toggles their
//   spring-potluck RSVP and deliberately leaves it at "No".
// - Org Beta anchors Organizing — factories only ever create events on Org
//   Alpha, so diana's owned set is exactly the seed.
// - The list renders at most 6 cards (page_size 10, sliced to 6, ordered by
//   start): every asserted facet set is ≤ 6 events, so presence checks can't
//   be pushed off the grid by ordering.
// All assertions scope to the "Your Events" region — the dashboard's public
// discover section can surface the same (public) events regardless of facet.

function yourEvents(page: Page): Locator {
	return page.getByRole('region', { name: /^Your Events/ });
}

test.describe('J3 dashboard facets @p1', () => {
	test('Organizing scopes to events of the org the user runs (diana)', async ({ asBetaOwner }) => {
		await gotoHydrated(asBetaOwner, '/dashboard');
		await asBetaOwner.getByRole('button', { name: 'Organizing' }).click();

		const region = yourEvents(asBetaOwner);
		// Org Beta's seeded events — including its DRAFT, which only admins see.
		await expect(
			region.getByRole('heading', { name: 'FutureStack 2025: AI & Web3 Conference' })
		).toBeVisible();
		await expect(
			region.getByRole('heading', { name: 'Hands-on Workshop: Building with AI APIs' })
		).toBeVisible();
		// Org Alpha events never appear — diana has no relationship with them.
		await expect(
			region.getByRole('heading', { name: 'Summer Sunset Music Festival' })
		).toBeHidden();
	});

	test('Attending shows RSVPs and held tickets, not mere memberships (charlie)', async ({
		asMember
	}) => {
		await gotoHydrated(asMember, '/dashboard');
		await asMember.getByRole('button', { name: 'Attending' }).click();

		const region = yourEvents(asMember);
		// charlie's seeded RSVP-yes events…
		await expect(
			region.getByRole('heading', { name: 'Spring Community Potluck & Garden Party' })
		).toBeVisible();
		await expect(
			region.getByRole('heading', { name: 'Contemporary Art Exhibition Opening' })
		).toBeVisible();
		// …and his ACTIVE ticket.
		await expect(region.getByRole('heading', { name: 'Classical Music Evening' })).toBeVisible();
		// Alpha events he is NOT attending stay out — the preset excludes the
		// `member` relationship even though he could see this event.
		await expect(
			region.getByRole('heading', { name: 'Exclusive Wine Tasting & Pairing Dinner' })
		).toBeHidden();
	});

	test('Invited isolates invitations from RSVPs and memberships (karen)', async ({
		asMultiOrg
	}) => {
		await gotoHydrated(asMultiOrg, '/dashboard');
		await asMultiOrg.getByRole('button', { name: 'Invited' }).click();

		const region = yourEvents(asMultiOrg);
		// karen's one seeded invitation…
		await expect(
			region.getByRole('heading', { name: 'Exclusive Wine Tasting & Pairing Dinner' })
		).toBeVisible();
		// …while her RSVP-yes event is filtered out by the preset.
		await expect(
			region.getByRole('heading', { name: 'Spring Community Potluck & Garden Party' })
		).toBeHidden();
	});

	test('Bookmarked starts empty and is a distinct facet (karen)', async ({ asMultiOrg }) => {
		// karen never bookmarks anywhere in the suite (the bookmarks spec uses
		// hannah/ivan), so her Bookmarked facet is deterministically empty.
		await gotoHydrated(asMultiOrg, '/dashboard');
		await asMultiOrg.getByRole('button', { name: 'Bookmarked' }).click();
		await expect(
			yourEvents(asMultiOrg).getByRole('heading', { name: 'No events found' })
		).toBeVisible();
	});

	test('Organizing preset is hidden from users who run no org (hannah)', async ({ asUser }) => {
		await gotoHydrated(asUser, '/dashboard');
		// The filter bar is rendered (hannah has events via tickets/RSVPs)…
		await expect(asUser.getByRole('button', { name: 'Attending' })).toBeVisible();
		// …but the owner/staff-only preset is not offered.
		await expect(asUser.getByRole('button', { name: 'Organizing' })).toBeHidden();
	});
});
