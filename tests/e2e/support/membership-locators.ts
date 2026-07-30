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
 * The public membership grid: the only surface on which a TIER can be chosen.
 *
 * Since #720 the org landing page (`/org/[slug]`) keeps a compact pointer and
 * nothing else — the plan/tier cards live here. A function rather than a
 * template literal at each call site so the move is expressed in one place.
 */
export function membershipPath(slug: string): string {
	return `/org/${slug}/membership`;
}

/**
 * One membership TIER's card on the public membership page.
 *
 * `TierCard` renders an `<article aria-labelledby>` pointing at its own `<h3>`,
 * so the accessible name is exactly the tier name. `exact: true` is required,
 * not cosmetic: Playwright matches accessible names as SUBSTRINGS, and
 * "General membership" would otherwise also select a spec-created
 * "General membership (gated)".
 *
 * SCOPING CAVEAT, same shape as `requestCard`: the lookup is page-global, which
 * is safe only because `TierCard` is the only `<article>` in the membership
 * page's component tree. Should another article-bearing card land there, scope
 * this to the grid rather than reaching for `.first()`.
 */
export function tierCard(page: Page, tierName: string): Locator {
	return page.getByRole('article', { name: tierName, exact: true });
}

/**
 * A subscription plan's card, inside its tier's card on the membership page.
 *
 * Anchored on the plan's own `<h4>` and walked up to the NEAREST `.bg-card`
 * ancestor, which is the plan's shadcn Card. The older `.bg-card` +
 * `hasText(planName)` form died with #720: plan cards used to be grid siblings,
 * and are now NESTED inside their `TierCard`'s Card — which carries `.bg-card`
 * and contains the plan name too, so the filter matched two elements.
 *
 * Deliberately NO `.first()` — strictness is the feature here: `.first()` would
 * downgrade a would-be strict-mode error (loud, immediate) into a silent
 * first-match, and this helper's consumers include `toHaveCount(0)` assertions,
 * precisely the class that false-PASSES against a wrongly-picked element.
 * `exact: true` on the heading is what keeps it single-valued; plan names come
 * from `uniqueName()`, so nothing but the intended card can answer.
 */
export function planCard(page: Page, planName: string): Locator {
	return page
		.getByRole('heading', { level: 4, name: planName, exact: true })
		.locator(
			'xpath=ancestor::div[contains(concat(" ", normalize-space(@class), " "), " bg-card ")][1]'
		);
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
