import { test, expect } from '../../support/fixtures';
import { ApiClient } from '../../support/api';
import { PERSONAS } from '../../support/personas';
import { gotoHydrated, waitForClientAuth } from '../../support/navigation';

// J25 (USER_JOURNEYS.md) — the org Financials surface: seeded last-month
// revenue renders in the Totals card, the per-event breakdown expands to the
// full figures, and the year/period filters drive the range (an empty period
// shows the empty state). Read-only on seeded data.
//
// Seed contract (bootstrap create_payments_and_invoice): SUCCEEDED payments on
// an Org Alpha ONLINE EUR tier, back-dated across the PREVIOUS calendar month
// relative to bootstrap time. The exact amounts follow whichever tier the
// fixture picks (`.first()` on the concert event) and have drifted across
// bootstrap reshapes — so the expected figures are DERIVED from the org
// revenue API for the period (the same aggregation engine the page renders;
// the engine's own math is backend-tested) instead of pinned constants. The
// spec then owns exactly what it's for: the page rendering the period's
// figures, filters, and breakdown.
//
// The page is owner-only (403 otherwise — covered by j09 permission-gating);
// figures arrive via a client-side query after SSR, so every assertion waits
// out the "Loading financials…" state implicitly through expect timeouts.

const FINANCIALS_PATH = '/org/revel-events-collective/admin/financials';

// Previous calendar month, assuming the DB was bootstrapped in the current
// month (the standing suite assumption for all clock-relative seed data).
const PREV = new Date(new Date().getFullYear(), new Date().getMonth() - 1, 1);

/** Format as the app does (formatMoney at the default 'en' UI language). */
function eur(value: string): string {
	return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'EUR' }).format(
		parseFloat(value)
	);
}

interface CurrencyTotals {
	currency: string;
	gross: string;
	net_taxable: string;
	sold_count: number;
}

interface OrgRevenue {
	totals: CurrencyTotals[];
	events: Array<{ event_name: string; by_currency: CurrencyTotals[] }>;
}

test.describe('J25 financials @p2', () => {
	test('seeded last-month revenue, per-event breakdown, period filters', async ({ asOwner }) => {
		const api = await ApiClient.login(PERSONAS.owner.email, PERSONAS.owner.password);
		const revenue = await api.get<OrgRevenue>(
			`/api/organization-admin/revel-events-collective/revenue?year=${PREV.getFullYear()}&month=${PREV.getMonth() + 1}`
		);
		const totals = revenue.totals.find((t) => t.currency === 'EUR');
		const topEvent = revenue.events[0];
		const eventTotals = topEvent?.by_currency.find((c) => c.currency === 'EUR');
		if (!totals || !topEvent || !eventTotals) {
			throw new Error(
				'Seed contract broken: no EUR revenue on Org Alpha for the previous month — re-run the reset recipe in tests/e2e/README.md'
			);
		}

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
		await expect(totalsCard.getByText(eur(totals.gross)).first()).toBeVisible({
			timeout: 15_000
		});
		await expect(totalsCard.getByText(eur(totals.net_taxable)).first()).toBeVisible();
		await expect(totalsCard.getByText(`Sold: ${totals.sold_count}`)).toBeVisible();

		// Per-event breakdown: the row is an aria-expanded button; expanding it
		// reveals the event's own figures (Net taxable lives only in the
		// expanded summary, scoped to the row's <li> to dodge the Totals card).
		await expect(asOwner.getByRole('heading', { name: 'By event' })).toBeVisible();
		const eventRow = asOwner.locator('li').filter({ hasText: topEvent.event_name });
		// String role-name matching is substring-based — never build a RegExp
		// from data (names with metacharacters would break it).
		const rowToggle = eventRow.getByRole('button', { name: topEvent.event_name });
		await expect(rowToggle).toHaveAttribute('aria-expanded', 'false');
		await rowToggle.click();
		await expect(rowToggle).toHaveAttribute('aria-expanded', 'true');
		await expect(eventRow.getByText('Net taxable')).toBeVisible();
		await expect(eventRow.getByText(eur(eventTotals.net_taxable)).first()).toBeVisible();

		// A period with no sales shows the empty state (two years back is safely
		// before both the seed's back-dated month and any e2e-run purchases).
		await asOwner.getByLabel('Year').selectOption(String(new Date().getFullYear() - 2));
		await expect(asOwner.getByText('No revenue in this period')).toBeVisible({ timeout: 15_000 });
		// The "nothing at all" state must account for BOTH money sources. This copy
		// used to read "no ticket sales", which told a membership-funded org it had
		// none while its membership revenue sat in the same period — the bug the
		// membership-financials work fixed. The ticket-only wording still exists,
		// but only on the per-event section, which this branch never renders.
		await expect(
			asOwner.getByText('There are no ticket sales or membership payments for the selected period.')
		).toBeVisible();
	});
});
