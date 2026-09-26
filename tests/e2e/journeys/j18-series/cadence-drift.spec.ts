import type { Page } from '@playwright/test';
import { test, expect } from '../../support/fixtures';
import { createOrganization, uniqueName, type CreatedOrg } from '../../support/factories';
import { ApiClient } from '../../support/api';
import { authenticateContext } from '../../support/session';
import { gotoHydrated, waitForClientAuth } from '../../support/navigation';

// J18.5 (USER_JOURNEYS.md) — cadence-drift detection. Changing a series'
// recurrence rule leaves the already-materialized future occurrences on their
// old dates; GET …/event-series/{id}/drift reports them and the series admin
// dashboard renders CadenceDriftBanner ("N occurrences off the current
// schedule") with a bulk-cancel CTA, and flags each stale row.
//
// Arrange via API: a weekly series whose occurrences all fall on the anchor's
// weekday. Journey via UI: Edit recurrence → move the weekday to the next day
// → Review changes → confirm. Every future occurrence then sits on a weekday
// the rule no longer produces, so ALL of them drift — an exact count.
//
// Throwaway org: series accumulate on the org profile with no cleanup.

const DAY_MS = 24 * 60 * 60 * 1000;

/** Backend weekday index (0 = Monday … 6 = Sunday) of a UTC instant. */
function backendWeekday(date: Date): number {
	return (date.getUTCDay() + 6) % 7;
}

const WEEKDAY_NAMES = [
	'Monday',
	'Tuesday',
	'Wednesday',
	'Thursday',
	'Friday',
	'Saturday',
	'Sunday'
];

async function createWeeklySeries(
	org: CreatedOrg,
	start: Date
): Promise<{ id: string; name: string }> {
	const api = await ApiClient.login(org.owner.email, org.owner.password);
	const seriesName = uniqueName('Drift Series');
	const series = await api.post<{ id: string }>(
		`/api/organization-admin/${org.slug}/create-recurring-event`,
		{
			series_name: seriesName,
			generation_window_weeks: 3,
			auto_publish: false,
			event: {
				name: uniqueName('Drift Occurrence'),
				start: start.toISOString(),
				end: new Date(start.getTime() + 2 * 3600_000).toISOString(),
				event_type: 'public',
				visibility: 'public'
			},
			recurrence: {
				frequency: 'weekly',
				interval: 1,
				weekdays: [backendWeekday(start)],
				dtstart: start.toISOString(),
				timezone: 'UTC'
			}
		}
	);
	// Sanity: generation materialized occurrences, and none drift yet.
	const drift = await api.get<{ stale_occurrences: string[] }>(
		`/api/organization-admin/${org.slug}/event-series/${series.id}/drift`
	);
	if (drift.stale_occurrences.length !== 0) {
		throw new Error(`Fresh series ${series.id} already reports drift`);
	}
	return { id: series.id, name: seriesName };
}

/** Desktop header action row vs mobile "More actions" sheet (same testids). */
async function seriesAction(page: Page, testId: string): Promise<void> {
	const sheetTrigger = page.getByTestId('action-sheet-trigger').filter({ visible: true });
	if ((await sheetTrigger.count()) > 0) {
		await sheetTrigger.click();
		await page.getByTestId('series-action-sheet').getByTestId(testId).click();
	} else {
		await page.getByTestId(testId).filter({ visible: true }).first().click();
	}
}

test.describe('J18 cadence drift @p2', () => {
	test('changing the weekday flags every scheduled occurrence as off-schedule', async ({
		browser
	}) => {
		test.setTimeout(120_000);
		const org = await createOrganization();
		// Anchor two days out at 18:00 UTC so every occurrence is in the future.
		const start = new Date(Date.now() + 2 * DAY_MS);
		start.setUTCHours(18, 0, 0, 0);
		const series = await createWeeklySeries(org, start);
		const oldDay = backendWeekday(start);
		const newDay = (oldDay + 1) % 7;

		const context = await browser.newContext();
		await authenticateContext(context, org.owner);
		const page = await context.newPage();
		try {
			await gotoHydrated(page, `/org/${org.slug}/admin/event-series/${series.id}`);
			await waitForClientAuth(page);

			const rows = page.getByTestId('occurrence-row');
			await expect(rows.first()).toBeVisible({ timeout: 20_000 });
			const occurrenceCount = await rows.count();
			expect(occurrenceCount).toBeGreaterThan(1);
			// Nothing has drifted yet.
			await expect(page.getByTestId('drift-banner')).toHaveCount(0);

			// Move the weekly rule from the anchor's weekday to the next day.
			await seriesAction(page, 'action-edit-recurrence');
			const dialog = page.getByTestId('recurrence-edit-dialog');
			await expect(dialog).toBeVisible({ timeout: 10_000 });
			const weekdays = dialog.getByRole('group', { name: 'Weekly' });
			const oldButton = weekdays.getByRole('button', { name: WEEKDAY_NAMES[oldDay] });
			const newButton = weekdays.getByRole('button', { name: WEEKDAY_NAMES[newDay] });
			await expect(oldButton).toHaveAttribute('aria-pressed', 'true');
			await newButton.click();
			await expect(newButton).toHaveAttribute('aria-pressed', 'true');
			await oldButton.click();
			await expect(oldButton).toHaveAttribute('aria-pressed', 'false');

			// A cadence change goes through the "already scheduled dates stay" confirm.
			await dialog.getByRole('button', { name: 'Review changes' }).click();
			await expect(dialog.getByTestId('recurrence-edit-confirm-banner')).toContainText(
				'Upcoming occurrences already on the calendar keep their dates'
			);
			await dialog.getByRole('button', { name: 'Yes, save changes' }).click();
			await expect(page.getByText('Recurrence saved')).toBeVisible({ timeout: 15_000 });
			await expect(dialog).toBeHidden();

			// The drift banner reports every scheduled occurrence as stale.
			const banner = page.getByTestId('drift-banner');
			await expect(banner).toBeVisible({ timeout: 20_000 });
			await expect(banner.getByRole('heading')).toHaveText(
				`${occurrenceCount} occurrences off the current schedule`
			);
			await expect(
				banner.getByRole('button', { name: `Cancel all ${occurrenceCount} stale dates` })
			).toBeVisible();
			await expect(banner.getByRole('link', { name: 'Review stale dates' })).toBeVisible();

			// Advisory only: the stale occurrences stay on the calendar.
			await expect(rows).toHaveCount(occurrenceCount);

			// It is server state, not a client flag — it survives a reload.
			await gotoHydrated(page, `/org/${org.slug}/admin/event-series/${series.id}`);
			await expect(page.getByTestId('drift-banner').getByRole('heading')).toHaveText(
				`${occurrenceCount} occurrences off the current schedule`,
				{ timeout: 20_000 }
			);
		} finally {
			await context.close();
		}
	});
});
