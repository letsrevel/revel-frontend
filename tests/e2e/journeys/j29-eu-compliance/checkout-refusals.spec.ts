import { test, expect } from '../../support/fixtures';
import { API_URL, ApiClient, ApiError } from '../../support/api';
import {
	createEventSeries,
	createSeriesPass,
	createTicketedEvent,
	createVerifiedUser,
	uniqueEmail
} from '../../support/factories';
import { authenticateContext } from '../../support/session';
import { gotoHydrated, waitForClientAuth } from '../../support/navigation';
import { ITALY_ONLINE_DETAIL, complianceApi, fixtureEvent, fixtureTiers } from './helpers';

// J29.4 (USER_JOURNEYS.md) — card checkout for an event held in Italy is
// refused. The event page reads `event.compliance` and never offers the card
// tier; every checkout path still answers 422 with the translated `detail`,
// which the UI renders verbatim (never a generic error). Refusals change
// nothing server-side, so the fixtures need no restoring.

async function expectRefused(promise: Promise<unknown>): Promise<void> {
	const refused = await promise.then(() => null).catch((err: unknown) => err);
	expect(refused).toBeInstanceOf(ApiError);
	expect((refused as ApiError).status).toBe(422);
	expect(JSON.parse((refused as ApiError).body).detail).toBe(ITALY_ONLINE_DETAIL);
}

test.describe('J29.4 checkout refusals @p2', () => {
	test('the event page offers no card checkout and says why', async ({ browser }) => {
		const [event, buyer] = await Promise.all([
			fixtureEvent('compliance-it', 'it-club-night'),
			createVerifiedUser('ItalyBuyer')
		]);
		const context = await browser.newContext();
		await authenticateContext(context, buyer);
		const page = await context.newPage();
		try {
			await gotoHydrated(page, event.path);
			await waitForClientAuth(page);

			const unavailable = page.getByRole('button', { name: 'Not available online' });
			await expect(unavailable.first()).toBeVisible({ timeout: 15_000 });
			// Only the purchasable card tier gets it (the paused one says "Sales paused").
			await expect(unavailable).toHaveCount(1);
			await expect(unavailable).toBeDisabled();
			await expect(unavailable).toHaveAccessibleDescription(
				"This ticket can't be bought online. Contact the organizer to find out how to pay."
			);
			// No quick-buy stepper for it either.
			await expect(page.getByRole('group', { name: 'Quantity for Card (legacy)' })).toHaveCount(0);
			// Offline tiers are still on sale.
			await expect(page.getByRole('group', { name: 'Quantity for Door' })).toBeVisible();
		} finally {
			await context.close();
		}
	});

	test('authenticated and guest checkout are refused with the Italian rule', async () => {
		const event = await fixtureEvent('compliance-it', 'it-club-night');
		const tiers = await fixtureTiers(event.id);
		const legacy = tiers.get('Card (legacy)');
		if (!legacy) throw new Error('fixture tier "Card (legacy)" is missing — reseed the backend');
		const items = [{ tier_id: legacy.id, tickets: [{ guest_name: 'E2E Card Buyer' }] }];

		const buyer = await createVerifiedUser('ItalyCard');
		const api = await ApiClient.login(buyer.email, buyer.password);
		await expectRefused(api.post(`/api/events/${event.id}/checkout`, { items }));

		// Guest checkout goes through the public endpoint (no account).
		const response = await fetch(`${API_URL}/api/events/${event.id}/checkout/public`, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({
				email: uniqueEmail('italy-guest'),
				first_name: 'Guest',
				last_name: 'Buyer',
				items
			})
		});
		expect(response.status).toBe(422);
		expect((await response.json()).detail).toBe(ITALY_ONLINE_DETAIL);

		// No ticket was created for the refused buyer.
		const mine = await api.get<{ results: unknown[] }>('/api/dashboard/tickets');
		expect(mine.results).toHaveLength(0);
	});

	test('the season pass shows "Not available online" up front; checkout still 422s', async ({
		browser
	}) => {
		const owner = await complianceApi();
		const series = await owner.get<{ id: string }>('/api/event-series/compliance-it/it-season');
		const passes = await owner.get<Array<{ id: string; name: string }>>(
			`/api/series-passes/event-series/${series.id}`
		);
		const pass = passes.find((p) => p.name === 'IT Season Pass');
		if (!pass) throw new Error('fixture pass "IT Season Pass" is missing — reseed the backend');

		// J26.2: the quote carries the checkout gate's decision.
		const quote = await owner.get<{ purchasable: boolean; compliance: { online_payment: string } }>(
			`/api/series-passes/${pass.id}/quote`
		);
		expect(quote.compliance.online_payment).toBe('blocked');
		expect(quote.purchasable).toBe(true); // by design: compliance is read separately

		// The fallback still holds if checkout is attempted anyway.
		const buyer = await createVerifiedUser('ItalyPass');
		const api = await ApiClient.login(buyer.email, buyer.password);
		await expectRefused(api.post(`/api/series-passes/${pass.id}/checkout`, {}));

		const context = await browser.newContext();
		await authenticateContext(context, buyer);
		const page = await context.newPage();
		try {
			await gotoHydrated(page, '/events/compliance-it/series/it-season');
			await waitForClientAuth(page);
			await expect(page.getByRole('heading', { name: 'IT Season Pass' })).toBeVisible({
				timeout: 15_000
			});
			const unavailable = page.getByRole('button', { name: 'Not available online' });
			await expect(unavailable).toBeDisabled({ timeout: 15_000 });
			await expect(unavailable).toHaveAccessibleDescription(
				"This pass can't be bought online. Contact the organizer to find out how to pay."
			);
			await expect(page.getByRole('button', { name: 'Get season pass' })).toHaveCount(0);
		} finally {
			await context.close();
		}
	});

	test('the same kind of pass switched to offline reads allowed and checks out', async ({
		browser
	}) => {
		test.setTimeout(120_000);
		// Own series in compliance-it (events held in Italy), so the switch never
		// touches the shared it-season fixture.
		const series = await createEventSeries('compliance', 'compliance-it');
		const [a, b] = await Promise.all([
			createTicketedEvent({
				owner: 'compliance',
				orgSlug: 'compliance-it',
				event: { event_series_id: series.id }
			}),
			createTicketedEvent({
				owner: 'compliance',
				orgSlug: 'compliance-it',
				event: { event_series_id: series.id }
			})
		]);
		const pass = await createSeriesPass('compliance', series.id, {
			price: '20.00',
			payment_method: 'online',
			tier_links: [a, b].map((e) => ({ event_id: e.id, tier_id: e.freeTierId ?? '' }))
		});
		const owner = await complianceApi();
		const quoteOf = () =>
			owner.get<{ compliance: { online_payment: string } }>(`/api/series-passes/${pass.id}/quote`);
		expect((await quoteOf()).compliance.online_payment).toBe('blocked');

		await owner.patch(`/api/event-series-admin/${series.id}/passes/${pass.id}`, {
			payment_method: 'offline'
		});
		expect((await quoteOf()).compliance.online_payment).toBe('allowed');

		const buyer = await createVerifiedUser('ItalyOfflinePass');
		const context = await browser.newContext();
		await authenticateContext(context, buyer);
		const page = await context.newPage();
		try {
			await gotoHydrated(page, series.path);
			await waitForClientAuth(page);
			await expect(page.getByRole('heading', { name: pass.name })).toBeVisible({
				timeout: 15_000
			});
			await expect(page.getByRole('button', { name: 'Not available online' })).toHaveCount(0);
			await page.getByRole('button', { name: 'Get season pass' }).click();
			const dialog = page.getByRole('dialog', { name: new RegExp(pass.name) });
			await expect(dialog).toBeVisible();
			await dialog.getByRole('button', { name: 'Reserve pass' }).click();
			await expect(page).toHaveURL(/\/dashboard\/passes/, { timeout: 15_000 });
		} finally {
			await context.close();
		}
	});
});
