import { test, expect } from '../../support/fixtures';
import { createOrganization, uniqueName } from '../../support/factories';
import { authenticateContext } from '../../support/session';
import { gotoHydrated, waitForClientAuth } from '../../support/navigation';

// J18 (USER_JOURNEYS.md) — recurring-series authoring: the two-step wizard
// (template event → weekly recurrence), the initial occurrence generation,
// "Generate now" materialising further occurrences past the window, and
// pause/resume of the recurrence.
//
// Runs in a THROWAWAY org: series accumulate on the org profile with no
// cleanup, and repeated runs against a seeded org would eventually crowd its
// "Event Series" section (the same pollution class as the org-list resets).
// The wizard auto-derives the weekly weekday from the chosen start date, so
// no weekday toggling is needed for a weekly rule.

const DAY_MS = 24 * 60 * 60 * 1000;

/** datetime-local inputs want the browser-local `YYYY-MM-DDTHH:mm` shape. */
function toDatetimeLocal(date: Date): string {
	const pad = (n: number) => String(n).padStart(2, '0');
	return (
		`${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}` +
		`T${pad(date.getHours())}:${pad(date.getMinutes())}`
	);
}

/**
 * Fire a series-dashboard action: the desktop header renders the action row
 * directly, mobile funnels everything through the "More actions" sheet — both
 * carry the same data-testids, so pick whichever surface is visible.
 */
async function seriesAction(page: import('@playwright/test').Page, testId: string): Promise<void> {
	const sheetTrigger = page.getByTestId('action-sheet-trigger').filter({ visible: true });
	if ((await sheetTrigger.count()) > 0) {
		await sheetTrigger.click();
		await page.getByTestId('series-action-sheet').getByTestId(testId).click();
	} else {
		await page.getByTestId(testId).filter({ visible: true }).first().click();
	}
}

test.describe('J18 recurring series admin @p2', () => {
	test('wizard create → occurrences materialize → generate now → pause/resume', async ({
		browser
	}) => {
		const org = await createOrganization();
		const context = await browser.newContext();
		await authenticateContext(context, org.owner);
		const page = await context.newPage();

		await gotoHydrated(page, `/org/${org.slug}/admin/event-series`);
		await waitForClientAuth(page);

		// New series → the picker offers grouping-only vs recurring.
		await page.getByTestId('new-series-button').click();
		await page.getByTestId('new-series-picker-recurring').click();
		await page.waitForURL(/\/admin\/event-series\/new-recurring/);

		// Step A: the template event (name, times, city via manual address).
		const eventName = uniqueName('Occurrence');
		const start = new Date(Date.now() + 7 * DAY_MS);
		await page.locator('#event-name').fill(eventName);
		await page.locator('#event-start').fill(toDatetimeLocal(start));
		await page
			.locator('#event-end')
			.fill(toDatetimeLocal(new Date(start.getTime() + 2 * 3600_000)));
		await page.getByRole('button', { name: 'Add Address' }).click();
		await page.locator('#city-search').fill('Vienna');
		await page
			.getByRole('option', { name: /Vienna/ })
			.first()
			.click();

		// (Role-scoped: the step indicator repeats the step title in a <p>.)
		const stepB = page.getByRole('heading', { name: 'Recurrence & series settings' });
		await expect(async () => {
			if (!(await stepB.isVisible())) {
				await page.getByRole('button', { name: 'Continue' }).click();
			}
			await expect(stepB).toBeVisible({ timeout: 3_000 });
		}).toPass({ timeout: 30_000 });

		// Step B: weekly (the default), with a small 2-week window so the
		// initial generation stays cheap and "Generate now" has room to add more.
		const seriesName = uniqueName('Series');
		await page.locator('#series-name').fill(seriesName);
		await page.getByRole('button', { name: 'Advanced' }).click();
		await page.locator('#generation-window').fill('2');

		await expect(async () => {
			if (!/\/admin\/event-series\/[0-9a-f]{8}/.test(page.url())) {
				await page.getByRole('button', { name: 'Create series' }).click();
			}
			await page.waitForURL(/\/admin\/event-series\/[0-9a-f]{8}[0-9a-f-]+$/, { timeout: 8_000 });
		}).toPass({ timeout: 40_000 });
		await expect(page.getByText(`Series "${seriesName}" created.`)).toBeVisible({
			timeout: 15_000
		});

		// Creation already generated the first window of occurrences.
		const rows = page.getByTestId('occurrence-row');
		await expect(rows.first()).toBeVisible({ timeout: 20_000 });
		const initialCount = await rows.count();

		// Generate now, pushed past the 2-week window → new occurrences appear.
		await seriesAction(page, 'action-generate-now');
		const generateDialog = page.getByTestId('generate-now-dialog');
		await expect(generateDialog).toBeVisible();
		await generateDialog
			.getByLabel('Generate up to (optional)')
			.fill(toDatetimeLocal(new Date(Date.now() + 35 * DAY_MS)));
		await generateDialog.getByTestId('generate-now-submit').click();
		await expect(page.getByText(/new occurrences? scheduled through/)).toBeVisible({
			timeout: 20_000
		});
		await expect.poll(async () => rows.count(), { timeout: 20_000 }).toBeGreaterThan(initialCount);

		// Pause (confirm dialog) → status chip flips, then resume (immediate).
		await seriesAction(page, 'action-pause-resume');
		await page.getByTestId('pause-resume-confirm').click();
		await expect(page.getByText('Series paused.')).toBeVisible({ timeout: 15_000 });
		await expect(page.getByLabel('Paused').first()).toBeVisible();

		await seriesAction(page, 'action-pause-resume');
		await expect(page.getByText('Series resumed.')).toBeVisible({ timeout: 15_000 });
		await expect(page.getByLabel('Active').first()).toBeVisible();

		await context.close();
	});
});
