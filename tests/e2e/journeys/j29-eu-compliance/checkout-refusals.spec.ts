import { test, expect } from '../../support/fixtures';
import { API_URL, ApiClient, ApiError } from '../../support/api';
import { createVerifiedUser, uniqueEmail } from '../../support/factories';
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

	test('the season pass checkout is refused inline in the purchase dialog', async ({ browser }) => {
		const owner = await complianceApi();
		const series = await owner.get<{ id: string }>('/api/event-series/compliance-it/it-season');
		const passes = await owner.get<Array<{ id: string; name: string }>>(
			`/api/series-passes/event-series/${series.id}`
		);
		const pass = passes.find((p) => p.name === 'IT Season Pass');
		if (!pass) throw new Error('fixture pass "IT Season Pass" is missing — reseed the backend');

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
			await page.getByRole('button', { name: 'Get season pass' }).click();
			const dialog = page.getByRole('dialog', { name: /IT Season Pass/ });
			await expect(dialog).toBeVisible();
			const pay = dialog.getByRole('button', { name: 'Continue to payment' });
			await pay.click();

			const refusal = dialog.getByRole('alert');
			await expect(refusal).toHaveText(ITALY_ONLINE_DETAIL, { timeout: 15_000 });
			await expect(pay).toBeDisabled();
			await expect(pay).toHaveAccessibleDescription(ITALY_ONLINE_DETAIL);
		} finally {
			await context.close();
		}
	});
});
