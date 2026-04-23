import { test, expect, type Page } from '@playwright/test';

// Recurring-series dashboard smoke.
//
// Prerequisites
// -------------
// 1. A local Revel backend running in demo mode with the default seed data
//    (Alice Owner as owner of "Revel Events Collective"; org has a Vienna city).
//    See `revel-backend/src/events/management/commands/README.md`.
// 2. This Playwright project's webServer config (`npm run build && npm run
//    preview`) pointing at the same backend via `PUBLIC_API_URL`.
//
// What this smoke covers (plan §QA gate, Phase 2.10 / 2.11)
// ---------------------------------------------------------
// Create a weekly recurring series via the Phase-1 wizard, land on the Phase-2
// dashboard, and verify the dashboard renders the header card + the occurrence
// list + the action row. Deliberately shallow — deeper mutation coverage is
// Phase 3.

const ORG_SLUG = 'revel-events-collective';
const ALICE_EMAIL = 'alice.owner@example.com';

/**
 * datetime-local inputs want `YYYY-MM-DDTHH:mm` without seconds or a timezone
 * suffix. Anchor the series a week out to satisfy the wizard's "start must be
 * in the future" validation without fighting DST edge cases.
 */
function nextWeekDatetimeLocal(): string {
	const d = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
	const pad = (n: number) => String(n).padStart(2, '0');
	return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(
		d.getHours()
	)}:${pad(d.getMinutes())}`;
}

async function loginAsAliceOwner(page: Page): Promise<void> {
	// Dev-server paraglide compile (~3700 JS files) is slow on first hit.
	// Firefox is especially sluggish loading many small modules against the
	// dev server; 90s keeps the smoke robust without hiding real regressions.
	await page.goto('/login', { timeout: 90_000 });

	// The demo-account dropdown is only rendered when the backend reports
	// `demo: true`. If it's missing the backend isn't in demo mode and the
	// smoke can't run in its current shape.
	const demoSelect = page.locator('#demo-account');
	await demoSelect.waitFor({ state: 'visible', timeout: 20_000 });

	await demoSelect.selectOption(ALICE_EMAIL);
	await page.getByRole('button', { name: /^sign in as/i }).click();

	// Login redirects to /dashboard (or the returnUrl from the query string).
	// Match either `/dashboard` (post-login default) or any `/org/…` route.
	await page.waitForURL(/\/dashboard(\/|$|\?)|\/org\//, { timeout: 20_000 });
}

/**
 * Click one of SeriesHeaderCard's action buttons. The card renders the full
 * action row twice (desktop flex row + mobile action sheet), both with the
 * same `data-testid`s per PRD §Phase 2 §5; on narrow viewports the desktop
 * row is `hidden` and the sheet must be opened first. This helper picks the
 * right path based on what's visible.
 */
async function clickHeaderAction(page: Page, testId: string): Promise<void> {
	const desktopRow = page.getByTestId(testId).first();
	if (await desktopRow.isVisible().catch(() => false)) {
		await desktopRow.click();
		return;
	}
	// Desktop row is hidden (md:flex breakpoint) — open the action sheet and
	// click the sheet's copy of the action. The sheet's close-on-click helper
	// dismisses the sheet after the handler fires.
	await page.getByTestId('action-sheet-trigger').click();
	await page.getByTestId('series-action-sheet').waitFor({ state: 'visible' });
	// Target the sheet-scoped action explicitly rather than `.nth(1)` — the
	// sheet is the parent, so the locator still works on touch viewports
	// where the desktop row isn't in the DOM at all.
	await page.getByTestId('series-action-sheet').getByTestId(testId).click();
}

test.describe('Recurring series dashboard', () => {
	// Firefox against the SvelteKit dev server is prohibitively slow on cold
	// starts — the per-route paraglide compile (~3700 JS files) regularly
	// exceeds even 90s on first `page.goto` in Firefox. The right fix is to
	// run Firefox against the production preview build, but that requires a
	// relaxed CSP (production CSP locks `connect-src` to `api.letsrevel.io`
	// and blocks the local backend). Skipping here is scoped to this dev-mode
	// smoke — other browsers cover the functional surface.
	test.skip(
		({ browserName }) => browserName === 'firefox',
		'Firefox cold-load against the dev server exceeds Playwright timeouts; covered by chromium + webkit + mobile.'
	);

	test('creates a weekly series via the wizard and renders the dashboard', async ({ page }) => {
		test.setTimeout(180_000);

		await loginAsAliceOwner(page);

		await page.goto(`/org/${ORG_SLUG}/admin/event-series/new-recurring`);
		await expect(page.getByRole('heading', { level: 1, name: /create.*series/i })).toBeVisible({
			timeout: 15_000
		});
		// Let the auth-store init + root layout $effects settle. Dev-mode
		// paraglide compiles (~3700 files) and the initial auth sync are the
		// slow tail; clicks issued too early race reactive hydration and lose
		// state updates. Mirrors the settle time used by the debug probe.
		await page.waitForLoadState('networkidle');
		await page.waitForTimeout(2500);

		// --- Step A: template event ------------------------------------------
		const seriesName = `Smoke Weekly ${Date.now()}`;

		await page.locator('#event-name').fill(seriesName);
		await page.locator('#event-start').fill(nextWeekDatetimeLocal());
		// Give the wizard's reactive state a moment to settle from auth/layout
		// effects + the $effect that auto-derives weekdays from the start date.
		await page.waitForTimeout(500);

		// The wizard's server load pre-fills city_id from orgCity (Vienna for the
		// seeded org), so we don't need to touch the LocationSection typeahead.
		// If the seeded org ever loses its city, this click will land us back on
		// Step A with a city_id validation error — a signal the seed data drifted
		// rather than a component regression.
		// "Continue" is the English copy for `recurringEvents.wizard.next`.
		await page.getByRole('button', { name: /^continue$/i }).click();

		// --- Step B: recurrence + series settings ----------------------------
		// Dev-mode hydration + route paraglide warmup can take several seconds
		// on first mount, so give the Step B heading a generous window.
		await expect(page.getByRole('heading', { level: 2, name: /recurrence/i })).toBeVisible({
			timeout: 15_000
		});

		// seriesName is auto-prefilled from the event name via a $effect on the
		// wizard; no extra input needed. Weekdays are seeded from the start
		// date's weekday, which satisfies the weekly-frequency client-side
		// validation.
		await page.getByRole('button', { name: /^create/i }).click();

		// --- Dashboard ------------------------------------------------------
		// Match a UUID-shaped series ID explicitly so we don't accidentally
		// match the wizard URL itself (`/new-recurring`) — both would satisfy
		// a looser `/event-series/[^/?#]+/?$` regex.
		const UUID = '[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}';
		await page.waitForURL(new RegExp(`/org/${ORG_SLUG}/admin/event-series/${UUID}/?($|\\?)`), {
			timeout: 30_000
		});

		// SeriesHeaderCard renders the series name as an h1. The admin layout
		// also puts the org name in an h1, so match by accessible name instead
		// of level alone.
		await expect(page.getByRole('heading', { level: 1, name: seriesName })).toBeVisible({
			timeout: 10_000
		});

		// At least one occurrence row materialises. The backend schedules
		// occurrences on creation using the recurrence rule; weekly with a
		// future start should produce >= 1 upcoming row.
		await expect(page.getByTestId('occurrence-row').first()).toBeVisible({
			timeout: 15_000
		});

		// Action row resolves. SeriesHeaderCard renders two trees with identical
		// testids (desktop flex row + mobile action sheet item) — per PRD §Phase
		// 2 §5 — so the test has to branch on viewport: on `md+` the desktop row
		// is visible and we can assert the six actions inline; on narrow screens
		// only the sheet trigger is visible and the six actions live inside the
		// sheet (rendered once the trigger is clicked).
		const sheetTrigger = page.getByTestId('action-sheet-trigger');
		const onMobile = await sheetTrigger.isVisible().catch(() => false);
		if (onMobile) {
			await sheetTrigger.click();
			const sheet = page.getByTestId('series-action-sheet');
			await expect(sheet).toBeVisible();
			await expect(sheet.getByTestId('action-series-settings')).toBeVisible();
			await expect(sheet.getByTestId('action-edit-template')).toBeVisible();
			await expect(sheet.getByTestId('action-edit-recurrence')).toBeVisible();
			await expect(sheet.getByTestId('action-cancel-occurrence')).toBeVisible();
			await expect(sheet.getByTestId('action-generate-now')).toBeVisible();
			await expect(sheet.getByTestId('action-pause-resume')).toBeVisible();
		} else {
			// Desktop row — `.first()` picks the outer-row copy (the sheet's
			// copy isn't in the DOM until the trigger is clicked).
			await expect(page.getByTestId('action-series-settings').first()).toBeVisible();
			await expect(page.getByTestId('action-edit-template').first()).toBeVisible();
			await expect(page.getByTestId('action-edit-recurrence').first()).toBeVisible();
			await expect(page.getByTestId('action-cancel-occurrence').first()).toBeVisible();
			await expect(page.getByTestId('action-generate-now').first()).toBeVisible();
			await expect(page.getByTestId('action-pause-resume').first()).toBeVisible();
		}
	});

	test('opens the Series settings dialog from the header card', async ({ page }) => {
		test.setTimeout(120_000);

		await loginAsAliceOwner(page);

		// Reuse the series-list page to reach any existing series. This test is a
		// sibling of the create-and-render test — it runs independently and only
		// needs at least one series to exist on the org. If the create-and-render
		// test ran first it leaves one behind; otherwise, the seed data may (or
		// may not) include a series. Skip gracefully when nothing is present
		// rather than making the two tests order-dependent.
		await page.goto(`/org/${ORG_SLUG}/admin/event-series`);
		await page.waitForLoadState('networkidle');
		await page.waitForTimeout(2500);

		// Edit button text "Edit" is generic — scope to the <main> region to
		// avoid snagging any header/nav edit affordance the layout might add.
		const firstEditLink = page
			.getByRole('main')
			.getByRole('button', { name: /^edit$/i })
			.first();
		if (!(await firstEditLink.isVisible().catch(() => false))) {
			test.skip(true, 'No series present on org; skipping settings-dialog smoke.');
			return;
		}

		const UUID = '[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}';
		await Promise.all([
			page.waitForURL(new RegExp(`/org/${ORG_SLUG}/admin/event-series/${UUID}/?($|\\?)`), {
				timeout: 15_000
			}),
			firstEditLink.click()
		]);

		await clickHeaderAction(page, 'action-series-settings');

		// The dialog's testids light up only when the Vitest component-test
		// harness is fixed (bits-ui harness gap documented in _progress.txt); in
		// Playwright the dialog is a real browser render so they resolve fine.
		await expect(page.getByTestId('series-settings-dialog')).toBeVisible({
			timeout: 10_000
		});
	});
});
