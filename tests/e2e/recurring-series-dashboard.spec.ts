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

// Captured by the "creates a weekly series" test below and reused by the
// Phase 3 mutating-flow tests. Module-level persists across tests in the
// same worker (`workers: 1` for the local smoke), so the phase-3 tests can
// pin to a known-healthy series without iterating through seed data (which
// includes a degraded series "Seasonal Community Gatherings" with no
// recurrence_rule — actions are disabled on that one).
let freshSeriesPath: string | null = null;

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

		// Capture the freshly-created series URL for the Phase 3 mutating-flow
		// tests below. Each of those needs a known-healthy series (the seed
		// data contains a degraded one that disables all actions); pinning to
		// the wizard's output keeps them deterministic without having to
		// iterate through seed rows.
		const capturedMatch = page
			.url()
			.match(new RegExp(`/org/${ORG_SLUG}/admin/event-series/${UUID}/?`));
		if (capturedMatch) {
			freshSeriesPath = capturedMatch[0].replace(/\/?$/, '/');
		}

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

/**
 * Phase 3 mutating-dialog smoke.
 *
 * Each scenario independently navigates to the first admin series on Alice's
 * org and exercises one mutating flow end-to-end. All scenarios skip when no
 * series exists, matching the pattern the settings-dialog test uses — the
 * create-and-render test in the block above seeds the org with at least one
 * series, but the order isn't enforced so the skip is the honest guard.
 *
 * Each test's assertion strategy: trigger → dialog opens → interact →
 * dialog closes → authoritative post-mutation state reads back from the
 * dashboard (not from a toast, since `svelte-sonner` toasts auto-dismiss and
 * the timing is flaky under Playwright's auto-waiting).
 */

/**
 * Navigate to the freshly-created series the wizard test captured. Returns
 * true on success, false when `freshSeriesPath` was never set (wizard test
 * skipped / failed). Pinning to the wizard's output keeps each Phase 3
 * test deterministic — the demo seed data includes a degraded series
 * ("Seasonal Community Gatherings" with no recurrence_rule / template_event)
 * that disables every header action, so iterating "first series on the list"
 * lands on it and every subsequent click fails on a disabled button.
 */
async function openFreshWizardSeries(page: Page): Promise<boolean> {
	if (!freshSeriesPath) return false;
	await page.goto(freshSeriesPath);
	await page.waitForLoadState('networkidle');
	// Dev-server hydration + auth store settle. Matches the timing used by
	// the wizard test; clicks issued too early race the `canEdit` derivation
	// on initial render.
	await page.waitForTimeout(2500);

	// Confirm the header action row hydrated, so subsequent clicks land on
	// enabled buttons. Race a desktop-row testid against the action sheet
	// trigger so the helper works on every viewport.
	await Promise.race([
		page
			.getByTestId('action-cancel-occurrence')
			.first()
			.waitFor({ state: 'visible', timeout: 15_000 }),
		page.getByTestId('action-sheet-trigger').waitFor({ state: 'visible', timeout: 15_000 })
	]);
	return true;
}

test.describe('Recurring series dashboard — Phase 3 mutating flows', () => {
	test.skip(
		({ browserName }) => browserName === 'firefox',
		'Firefox cold-load against the dev server exceeds Playwright timeouts.'
	);

	test('cancels an occurrence via the row quick-action', async ({ page }) => {
		test.setTimeout(180_000);
		await loginAsAliceOwner(page);
		if (!(await openFreshWizardSeries(page))) {
			test.skip(true, 'Wizard test did not capture a series; skipping row-cancel smoke.');
			return;
		}

		// Need at least one cancellable occurrence row (draft/open). Row-cancel
		// buttons only render when `canEdit && isCancellable`, so waiting for
		// the button itself is the right signal.
		const rowCancel = page.getByTestId('row-cancel-occurrence').first();
		if (!(await rowCancel.isVisible().catch(() => false))) {
			test.skip(true, 'No cancellable upcoming occurrences on the first series.');
			return;
		}

		const initialRowCount = await page.getByTestId('occurrence-row').count();

		await rowCancel.click();

		// Dialog opens in row mode — the selected-date testid appears only
		// when `initialDate` was provided (the component's isRowMode branch).
		await expect(page.getByTestId('cancel-occurrence-dialog')).toBeVisible({ timeout: 10_000 });
		await expect(page.getByTestId('cancel-occurrence-selected-date')).toBeVisible();

		await page.getByTestId('cancel-occurrence-confirm').click();

		// Dialog closes on mutation success (onClose fires in onSuccess).
		await expect(page.getByTestId('cancel-occurrence-dialog')).toBeHidden({ timeout: 15_000 });

		// Authoritative signal that the dashboard refetched: either the
		// occurrence-row count dropped by one (the cancelled row was
		// materialised and now has status=CANCELLED, which the `driftedIds`
		// list keeps visible but `upcomingOccurrences` may still include —
		// we don't rely on that) *or* the exdates chip list now renders a
		// chip (backend always appends to `exdates` on cancel). The exdates
		// check is the deterministic one per UX §5.
		await expect(page.getByTestId('exdates-list')).toBeVisible({ timeout: 15_000 });
		// Sanity check the count hasn't gone *up* — a race between the old
		// and new query data should never inflate the list.
		const afterRowCount = await page.getByTestId('occurrence-row').count();
		expect(afterRowCount).toBeLessThanOrEqual(initialRowCount);
	});

	test('cancels an occurrence via the header picker', async ({ page }) => {
		test.setTimeout(180_000);
		await loginAsAliceOwner(page);
		if (!(await openFreshWizardSeries(page))) {
			test.skip(true, 'Wizard test did not capture a series; skipping header-cancel smoke.');
			return;
		}

		await clickHeaderAction(page, 'action-cancel-occurrence');
		await expect(page.getByTestId('cancel-occurrence-dialog')).toBeVisible({ timeout: 10_000 });

		// Header mode: the select should render (unless there are no
		// cancellable upcoming occurrences, in which case the picker-empty
		// state shows and we skip).
		const picker = page.getByTestId('cancel-occurrence-picker');
		const pickerEmpty = page.getByTestId('cancel-occurrence-picker-empty');
		if (await pickerEmpty.isVisible().catch(() => false)) {
			test.skip(true, 'No cancellable upcoming occurrences in the header picker.');
			return;
		}
		await expect(picker).toBeVisible();

		// Pick the first real option. The placeholder is disabled so
		// `selectOption({ index: 1 })` lands on the first occurrence.
		await picker.selectOption({ index: 1 });

		await page.getByTestId('cancel-occurrence-confirm').click();
		await expect(page.getByTestId('cancel-occurrence-dialog')).toBeHidden({ timeout: 15_000 });

		// Same authoritative read-back as the row test.
		await expect(page.getByTestId('exdates-list')).toBeVisible({ timeout: 15_000 });
	});

	test('opens and submits the generate-now dialog', async ({ page }) => {
		test.setTimeout(180_000);
		await loginAsAliceOwner(page);
		if (!(await openFreshWizardSeries(page))) {
			test.skip(true, 'Wizard test did not capture a series; skipping generate-now smoke.');
			return;
		}

		await clickHeaderAction(page, 'action-generate-now');
		await expect(page.getByTestId('generate-now-dialog')).toBeVisible({ timeout: 10_000 });

		// Empty `until` — uses the default generation window. The backend
		// may return zero events (series already at horizon) or N events;
		// either way the dialog closes and we get a toast. We assert the
		// dialog closed, not the toast content (toast timing is flaky).
		await page.getByTestId('generate-now-submit').click();

		await expect(page.getByTestId('generate-now-dialog')).toBeHidden({ timeout: 20_000 });
	});

	test('pauses the series then resumes it', async ({ page }) => {
		test.setTimeout(180_000);
		await loginAsAliceOwner(page);
		if (!(await openFreshWizardSeries(page))) {
			test.skip(true, 'Wizard test did not capture a series; skipping pause/resume smoke.');
			return;
		}

		// Skip if the series is already paused — resume-then-pause needs the
		// same copy flip in the header chip and would make the serial story
		// confusing. Rather than branch, skip gracefully.
		const pausedChip = page.getByLabel('Paused').first();
		if (await pausedChip.isVisible().catch(() => false)) {
			test.skip(true, 'Series is already paused; skipping pause/resume smoke.');
			return;
		}

		// --- Pause: dialog opens, user confirms, status flips to paused ---
		await clickHeaderAction(page, 'action-pause-resume');
		await expect(page.getByTestId('pause-resume-dialog')).toBeVisible({ timeout: 10_000 });

		// Let the bits-ui Dialog's open animation fully settle and any leftover
		// action-sheet backdrop unmount. On Mobile Safari the dialog is
		// visually present within ~100ms of the action click, but pointer
		// events don't reliably hit the confirm button until the sheet's
		// backdrop has been torn down. 500ms covers the observed race.
		await page.waitForTimeout(500);

		const confirmBtn = page.getByTestId('pause-resume-confirm');
		await confirmBtn.waitFor({ state: 'visible' });
		await confirmBtn.scrollIntoViewIfNeeded();
		const pausePromise = page.waitForResponse(
			(resp) => resp.url().includes('/pause') && resp.request().method() === 'POST',
			{ timeout: 15_000 }
		);
		await confirmBtn.click();
		const pauseResp = await pausePromise;
		expect(pauseResp.ok()).toBe(true);

		// Dialog closes on success.
		await expect(page.getByTestId('pause-resume-dialog')).toBeHidden({ timeout: 15_000 });

		// Status chip flips to "Paused" once `invalidateSeries` refetches and
		// the dashboard's reactive derivation picks up `series.is_active=false`.
		await expect(page.getByLabel('Paused').first()).toBeVisible({ timeout: 15_000 });

		// --- Resume: single-click, no dialog. Status flips back to active ---
		// Let the pause-success side effects fully settle before clicking the
		// now-Resume button. In particular: PauseResumeButton's open-effect
		// snapshot is driven by `decisionMadeForOpen` which resets when
		// `open` flips to false; we want to make sure that reset has actually
		// propagated before re-toggling open.
		await page.waitForTimeout(500);

		// Same authoritative pattern — wait for the backend POST to complete
		// rather than polling the chip, since the resume path has no dialog
		// UI to serve as a visual checkpoint.
		const resumePromise = page.waitForResponse(
			(resp) => resp.url().includes('/resume') && resp.request().method() === 'POST',
			{ timeout: 15_000 }
		);
		await clickHeaderAction(page, 'action-pause-resume');
		const resumeResp = await resumePromise;
		expect(resumeResp.ok()).toBe(true);

		// Chip flips back to Active once the query invalidation settles.
		await expect(page.getByLabel('Active').first()).toBeVisible({ timeout: 15_000 });
	});

	test('cancels drifted occurrences in bulk', async ({ page }) => {
		test.setTimeout(180_000);
		await loginAsAliceOwner(page);
		if (!(await openFreshWizardSeries(page))) {
			test.skip(true, 'Wizard test did not capture a series; skipping bulk-cancel smoke.');
			return;
		}

		// The drift banner is data-driven — only renders when the backend
		// reports `stale_occurrences.length > 0`. Fresh seed data has no
		// drift, so skip gracefully when the banner isn't present. Drift is
		// produced by editing the recurrence rule of an existing series;
		// that's covered by the RecurrenceEditDialog's own flow which we
		// don't exercise here to keep the smoke focused.
		const driftBanner = page.getByTestId('drift-banner');
		if (!(await driftBanner.isVisible().catch(() => false))) {
			test.skip(true, 'No drifted occurrences on the first series; skipping bulk-cancel smoke.');
			return;
		}

		await page.getByTestId('drift-bulk-cancel').click();
		await expect(page.getByTestId('drift-bulk-dialog')).toBeVisible({ timeout: 10_000 });

		// Arm the destructive confirm by ticking the "I understand" checkbox.
		await page.getByTestId('drift-bulk-arm').check();
		await page.getByTestId('drift-bulk-confirm').click();

		// Rows transition pending → inFlight → done. We wait for the dialog
		// to close (which only happens on full success) rather than polling
		// individual rows.
		await expect(page.getByTestId('drift-bulk-dialog')).toBeHidden({ timeout: 60_000 });

		// Drift banner disappears once `stale_occurrences` is empty.
		await expect(driftBanner).toBeHidden({ timeout: 15_000 });
	});
});
