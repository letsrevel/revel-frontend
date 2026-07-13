import { test, expect } from '../../support/fixtures';
import { gotoHydrated, waitForClientAuth } from '../../support/navigation';

// J25 (USER_JOURNEYS.md) — the org Financials surface: seeded last-month
// revenue renders in the Totals card, the per-event breakdown expands to the
// full figures, and the year/period filters drive the range (an empty period
// shows the empty state). Read-only on seeded data.
//
// Seed contract (bootstrap create_payments_and_invoice): 4 SUCCEEDED €75.00
// payments on Org Alpha's "Classical Music Evening", back-dated across the
// PREVIOUS calendar month relative to bootstrap time → €300.00 gross /
// €250.00 net taxable / €50.00 VAT, EUR only. Because the period has a single
// currency, the currency pill switcher deliberately doesn't render
// (available_currencies.length > 1 gate) — so this spec covers the
// year/period/sort filters, not currency switching.
//
// The page is owner-only (403 otherwise — covered by j09 permission-gating);
// figures arrive via a client-side query after SSR, so every assertion waits
// out the "Loading financials…" state implicitly through expect timeouts.

const FINANCIALS_PATH = '/org/revel-events-collective/admin/financials';

// Previous calendar month, assuming the DB was bootstrapped in the current
// month (the standing suite assumption for all clock-relative seed data).
const PREV = new Date(new Date().getFullYear(), new Date().getMonth() - 1, 1);

test.describe('J25 financials @p2', () => {
	test('seeded last-month revenue, per-event breakdown, period filters', async ({ asOwner }) => {
		await gotoHydrated(asOwner, FINANCIALS_PATH);
		await waitForClientAuth(asOwner);

		await expect(asOwner.getByRole('heading', { name: 'Financials', level: 1 })).toBeVisible();
		await expect(asOwner.getByLabel('Sort by')).toBeVisible();

		// Narrow to the seeded month (year select matters when Jan wraps to Dec).
		await asOwner.getByLabel('Year').selectOption(String(PREV.getFullYear()));
		await asOwner.getByLabel('Period').selectOption(`m${PREV.getMonth() + 1}`);

		// Totals card: the deepest container holding the "Totals" heading is the
		// card itself (ancestors precede descendants in locator order).
		const totalsCard = asOwner
			.locator('div')
			.filter({ has: asOwner.getByRole('heading', { name: 'Totals' }) })
			.last();
		await expect(totalsCard.getByText('€300.00').first()).toBeVisible({ timeout: 15_000 });
		await expect(totalsCard.getByText('€250.00').first()).toBeVisible();
		await expect(totalsCard.getByText('Sold: 4')).toBeVisible();

		// Per-event breakdown: the row is an aria-expanded button; expanding it
		// reveals the event's own figures (Net taxable lives only in the
		// expanded summary, scoped to the row's <li> to dodge the Totals card).
		await expect(asOwner.getByRole('heading', { name: 'By event' })).toBeVisible();
		const eventRow = asOwner.locator('li').filter({ hasText: 'Classical Music Evening' });
		const rowToggle = eventRow.getByRole('button', { name: /Classical Music Evening/ });
		await expect(rowToggle).toHaveAttribute('aria-expanded', 'false');
		await rowToggle.click();
		await expect(rowToggle).toHaveAttribute('aria-expanded', 'true');
		await expect(eventRow.getByText('Net taxable')).toBeVisible();
		await expect(eventRow.getByText('€250.00').first()).toBeVisible();

		// A period with no sales shows the empty state (two years back is safely
		// before both the seed's back-dated month and any e2e-run purchases).
		await asOwner.getByLabel('Year').selectOption(String(new Date().getFullYear() - 2));
		await expect(asOwner.getByText('No revenue in this period')).toBeVisible({ timeout: 15_000 });
		await expect(
			asOwner.getByText('There are no ticket sales for the selected period.')
		).toBeVisible();
	});
});
