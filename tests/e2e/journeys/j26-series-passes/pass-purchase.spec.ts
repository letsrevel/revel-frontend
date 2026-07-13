import { test, expect } from '../../support/fixtures';
import { ApiClient, ApiError } from '../../support/api';
import {
	createEventSeries,
	createOrganization,
	createSeriesPass,
	createTicketedEvent,
	createTicketTier,
	createVerifiedUser
} from '../../support/factories';
import { authenticateContext } from '../../support/session';
import { gotoHydrated, waitForClientAuth } from '../../support/navigation';

// J26 (USER_JOURNEYS.md) — season pass, offline flavor: the public series
// page quotes the pass PRO-RATA (one covered event already happened → price
// drops by one pro_rata_discount step), reserving holds it PENDING until the
// organizer confirms payment from the Holders dialog, and activation
// materializes one ticket per remaining event. Pass-derived tickets fold into
// the pass card on /dashboard/tickets and refuse self-cancellation (400).
//
// Isolation: throwaway org — nothing here needs Stripe, and series/passes
// have no cleanup. The past covered event is API-created with past dates.

const DAY_MS = 24 * 60 * 60 * 1000;

test.describe('J26 season pass purchase @p3', () => {
	test('pro-rata quote → reserve offline → confirm → tickets materialized, not self-cancellable', async ({
		browser
	}) => {
		test.setTimeout(240_000);

		// Public visibility: the buyer browses the org's PUBLIC series page.
		const org = await createOrganization({ publicVisibility: true });
		const series = await createEventSeries(org.owner, org.slug);
		const pastStart = new Date(Date.now() - 2 * DAY_MS);
		const [pastEvent, upcomingA, upcomingB] = await Promise.all([
			createTicketedEvent({
				owner: org.owner,
				orgSlug: org.slug,
				// The factory's default tier opens sales yesterday, which the
				// backend rejects on an event that started 2 days ago — this
				// event gets its own tier with an earlier sales window below.
				freeTier: false,
				event: {
					event_series_id: series.id,
					start: pastStart.toISOString(),
					end: new Date(pastStart.getTime() + 3 * 60 * 60 * 1000).toISOString()
				}
			}),
			createTicketedEvent({
				owner: org.owner,
				orgSlug: org.slug,
				event: { event_series_id: series.id }
			}),
			createTicketedEvent({
				owner: org.owner,
				orgSlug: org.slug,
				event: { event_series_id: series.id }
			})
		]);
		const pastTier = await createTicketTier(
			pastEvent.id,
			{
				name: 'Free Entry',
				payment_method: 'free',
				price: '0.00',
				total_quantity: 200,
				sales_start_at: new Date(pastStart.getTime() - 7 * DAY_MS).toISOString(),
				sales_end_at: pastStart.toISOString()
			},
			org.owner
		);
		const pass = await createSeriesPass(org.owner, series.id, {
			payment_method: 'offline',
			price: '10.00',
			pro_rata_discount: '2.50',
			tier_links: [
				{ event_id: pastEvent.id, tier_id: pastTier.id },
				{ event_id: upcomingA.id, tier_id: upcomingA.freeTierId as string },
				{ event_id: upcomingB.id, tier_id: upcomingB.freeTierId as string }
			]
		});

		const buyer = await createVerifiedUser('PassBuyer');
		const buyerContext = await browser.newContext();
		await authenticateContext(buyerContext, buyer);
		const page = await buyerContext.newPage();
		try {
			// Series page: the pass card quotes €7.50 (10.00 − 1 passed × 2.50).
			await gotoHydrated(page, series.path);
			await waitForClientAuth(page);
			await expect(page.getByRole('heading', { name: pass.name })).toBeVisible({ timeout: 15_000 });
			await expect(page.getByText('2 of 3 events remaining')).toBeVisible({ timeout: 15_000 });
			await page.getByRole('button', { name: 'Get season pass' }).click();

			// Purchase dialog: pro-rata price + note, offline reserve CTA.
			const dialog = page.getByRole('dialog', { name: new RegExp(pass.name) });
			await expect(dialog).toBeVisible();
			await expect(dialog.getByText('Price today')).toBeVisible();
			await expect(dialog.getByText('€7.50')).toBeVisible();
			await expect(dialog.getByText(/1 event\(s\) have already passed/)).toBeVisible();
			await dialog.getByRole('button', { name: 'Reserve pass' }).click();

			// Reserved → success toast → the app navigates to My passes (PENDING).
			await expect(page.getByText('Season pass reserved!')).toBeVisible({ timeout: 20_000 });
			await page.waitForURL(/\/dashboard\/passes/, { timeout: 20_000 });
			const passCard = page
				.locator('article, li, div')
				.filter({ hasText: pass.name })
				.filter({ hasText: /Pending/ })
				.first();
			await expect(passCard).toBeVisible({ timeout: 20_000 });

			// Organizer confirms the offline payment from the Holders dialog.
			const ownerContext = await browser.newContext();
			await authenticateContext(ownerContext, org.owner);
			const ownerPage = await ownerContext.newPage();
			try {
				await gotoHydrated(ownerPage, `/org/${org.slug}/admin/event-series/${series.id}`);
				await waitForClientAuth(ownerPage);
				// The dashboard's tab strip is plain buttons, not a WAI-ARIA tablist.
				await ownerPage.getByRole('button', { name: 'Passes', exact: true }).click();
				await expect(ownerPage.getByRole('heading', { name: 'Season passes' })).toBeVisible({
					timeout: 15_000
				});
				await ownerPage.getByRole('button', { name: 'Holders' }).click();
				const holders = ownerPage.getByRole('dialog', {
					name: new RegExp(`Holders — ${pass.name}`)
				});
				await expect(holders).toBeVisible();
				await expect(holders.getByText(`${buyer.firstName} ${buyer.lastName}`)).toBeVisible({
					timeout: 15_000
				});
				// The confirmation dialog stacks under the (still-open, aria-modal)
				// holders dialog, whose overlay intercepts pointer events — dispatch the
				// click straight to the button, outcome-keyed on the row's
				// Confirm-payment action disappearing (it only renders while the holder
				// is still PENDING; a just-mounted dialog button can swallow the first
				// dispatch under parallel-worker load).
				const confirmRowButton = holders.getByRole('button', { name: 'Confirm payment' });
				const confirmDialog = ownerPage.getByRole('dialog', { name: 'Confirm offline payment' });
				await confirmRowButton.click();
				await expect(confirmDialog).toBeVisible();
				await expect(async () => {
					if (await confirmRowButton.isHidden()) return;
					if (await confirmDialog.isHidden()) {
						await confirmRowButton.click();
						await expect(confirmDialog).toBeVisible({ timeout: 3_000 });
					}
					await confirmDialog
						.getByRole('button', { name: 'Confirm payment' })
						.dispatchEvent('click');
					await expect(confirmRowButton).toBeHidden({ timeout: 5_000 });
				}).toPass({ timeout: 45_000 });
			} finally {
				await ownerContext.close();
			}

			// Buyer side: the pass flips ACTIVE, and the two upcoming events'
			// materialized tickets fold into the pass card on the tickets page.
			await expect(async () => {
				await gotoHydrated(page, '/dashboard/passes');
				await expect(
					page
						.locator('article, li, div')
						.filter({ hasText: pass.name })
						.filter({ hasText: /Active/ })
						.first()
				).toBeVisible({ timeout: 5_000 });
			}).toPass({ timeout: 45_000 });
			// Coverage counts every covered event (3) with 2 still upcoming.
			await expect(page.getByText('2 of 3 events remaining').first()).toBeVisible();

			await gotoHydrated(page, '/dashboard/tickets');
			await waitForClientAuth(page);
			await expect(page.getByText(pass.name).first()).toBeVisible({ timeout: 20_000 });
			await expect(page.getByRole('button', { name: 'View pass' }).first()).toBeVisible();

			// Pass-derived tickets are not self-cancellable — the cancel endpoint
			// blocks with 409 and the stable part_of_series_pass reason code.
			const buyerApi = await ApiClient.login(buyer.email, buyer.password);
			const tickets = await buyerApi.get<{ results: Array<{ id: string }> }>(
				'/api/dashboard/tickets'
			);
			expect(tickets.results.length).toBeGreaterThan(0);
			const attempt = buyerApi.post(`/api/events/tickets/${tickets.results[0].id}/cancel`, {});
			await expect(attempt).rejects.toThrow(ApiError);
			await attempt.catch((error: ApiError) => {
				expect(error.status).toBe(409);
				expect(error.body).toContain('part_of_series_pass');
			});
		} finally {
			await buyerContext.close();
		}
	});
});
