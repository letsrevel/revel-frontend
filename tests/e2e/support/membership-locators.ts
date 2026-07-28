import type { Locator, Page } from '@playwright/test';

/**
 * Shared locators for the membership surfaces (j23 subscriptions, j27
 * applications). Hoisted from seven specs that had grown near-identical copies
 * (#697).
 *
 * House rule for this module: where the copies differed, the STRICTER variant
 * wins, and no locator is loosened to make the hoist tidier — a shared helper
 * silently weakening an assertion would do so across every consumer at once.
 * Hence required `list` scoping on `applicationRow`, `exact: true` on
 * `requestCard`, and no `.first()` on `planCard`.
 */

/**
 * An organization's card in the account hub's Memberships section.
 *
 * The account hub renders org-named `<article>`s in three different places
 * (membership cards, in-progress applications, closed applications), so the
 * lookup is scoped to the Memberships region — an unscoped one trips strict
 * mode the moment a test has both a membership and an application.
 *
 * `orgName` is required. One copy (j23 manage-subscription) took no argument
 * and closed over a module constant; the parameterised signature won because
 * the region scoping is the load-bearing part and a fixed name cannot be reused.
 */
export function membershipCard(page: Page, orgName: string): Locator {
	return page.getByRole('region', { name: 'Memberships' }).getByRole('article', { name: orgName });
}

/**
 * An organization's application row in one of the account hub's two lists.
 *
 * `list` stays REQUIRED (rather than an optional "search both") on purpose: the
 * same org can hold an in-progress and a closed application at once, and the
 * whole point of the scoping is that a test says which one it means.
 */
export function applicationRow(
	page: Page,
	list: 'In progress' | 'Closed',
	orgName: string
): Locator {
	return page.getByRole('list', { name: list }).getByRole('article', { name: orgName });
}

/**
 * A subscription plan's card on the public org page.
 *
 * Plan cards carry no ARIA role, so this matches the shadcn Card surface class
 * and narrows by the (unique, `uniqueName`-generated) plan name. The cards are
 * grid SIBLINGS, never nested inside one another, so exactly one resolves.
 *
 * Deliberately NO `.first()` — neither source copy had one, and strictness is
 * the feature here: `.first()` would downgrade a would-be strict-mode error
 * (loud, immediate) into a silent first-match, and this helper's consumers
 * include `toHaveCount(0)` assertions, precisely the class that false-PASSES
 * against a wrongly-picked element. If the markup ever does nest these cards,
 * the loud failure is what we want.
 */
export function planCard(page: Page, planName: string): Locator {
	return page.locator('.bg-card').filter({ hasText: planName });
}

/**
 * One requester's card on the org admin Members → Requests board.
 *
 * Since #696 the card is an `<article>` labelled with the requester's display
 * name (preferred_name → "first last" → first → email). `exact: true` is
 * required, not cosmetic: Playwright matches accessible names as SUBSTRINGS, so
 * "E2E Applicant" would also select "E2E Applicant Two".
 *
 * SCOPING CAVEAT: the lookup is page-global, which is safe only because
 * `MembershipRequestCard` is currently the ONLY `<article>` in the members-admin
 * component tree (and `TabsContent` renders one panel at a time). Should another
 * article-bearing card ever land on that page, scope this to the tabpanel —
 * `page.getByRole('tabpanel').getByRole('article', …)` — rather than reaching
 * for `.first()`.
 */
export function requestCard(page: Page, requesterName: string): Locator {
	return page.getByRole('article', { name: requesterName, exact: true });
}

/**
 * A request card's date+status row, anchored on its own "Requested …" line.
 *
 * Takes the CARD, not the page: the status badge shares its wording with the
 * board's filter BUTTONS ("Completed", "Rejected", …), and the card's own
 * details dialog renders a second "Requested …" line of its own — so a
 * page-global lookup is ambiguous the moment a view holds more than one card or
 * a dialog is open. Scoping per card removes both hazards and drops the
 * one-card-per-view invariant the old helper silently depended on.
 */
export function requestStatusRow(card: Locator): Locator {
	return card.locator('p', { hasText: /^Requested/ }).locator('xpath=..');
}
