import { test, expect } from '../../support/fixtures';
import { ApiClient } from '../../support/api';
import {
	claimTicketViaApi,
	createEventSeries,
	createOrganization,
	createSeriesPass,
	createTicketedEvent,
	createVerifiedUser
} from '../../support/factories';
import { authenticateContext } from '../../support/session';
import { gotoHydrated, waitForClientAuth } from '../../support/navigation';

// J26.4 / J26.7 / J6.10 (USER_JOURNEYS.md) — season-pass check-in at a covered
// event, from the event-admin Manage Tickets page:
//
// 1. SOURCE FILTER (?source=pass|direct): with one pass holder and one direct
//    buyer on the event, "Season pass" lists only the pass-derived ticket (with
//    its Season pass badge) and "Direct purchase" only the direct one.
// 2. PASS SCAN: the QR scanner's manual-entry fallback accepts the pass QR
//    payload `series:<held-pass-uuid>`. Pass codes have no preview endpoint, so
//    the backend resolves them to THIS event's materialized ticket and checks it
//    in directly — the UI confirms with "Series pass checked in: <name>" and the
//    row flips to Checked In. Re-scanning the same pass is refused ("already
//    been checked in") — the pass does not admit twice at one event.
//
// Isolation: throwaway PUBLIC org (series visibility derives from the org's,
// and the buyer must see the pass to check it out); a FREE pass over two
// upcoming events, acquired via the public checkout API → ACTIVE immediately
// with one ticket materialized per covered event. Check-in windows are opened
// explicitly (the events start days out).

const TICKET_ROW = 'tr, div.rounded-lg.border.bg-card';

test.describe('J26 season pass check-in @p2', () => {
	test('source filter separates pass tickets; series: code checks the holder in', async ({
		browser
	}) => {
		test.setTimeout(240_000);

		const org = await createOrganization({ publicVisibility: true });
		const series = await createEventSeries(org.owner, org.slug);
		const checkInOpen = new Date(Date.now() - 60 * 60 * 1000).toISOString();
		const [eventA, eventB, holder, direct] = await Promise.all([
			createTicketedEvent({
				owner: org.owner,
				orgSlug: org.slug,
				event: { event_series_id: series.id, check_in_starts_at: checkInOpen }
			}),
			createTicketedEvent({
				owner: org.owner,
				orgSlug: org.slug,
				event: { event_series_id: series.id, check_in_starts_at: checkInOpen }
			}),
			createVerifiedUser('PassHolder'),
			createVerifiedUser('DirectBuyer')
		]);
		const pass = await createSeriesPass(org.owner, series.id, {
			payment_method: 'free',
			price: '0.00',
			tier_links: [
				{ event_id: eventA.id, tier_id: eventA.freeTierId as string },
				{ event_id: eventB.id, tier_id: eventB.freeTierId as string }
			]
		});

		// Free pass → ACTIVE at checkout, tickets materialized for both events.
		const holderApi = await ApiClient.login(holder.email, holder.password);
		const checkout = await holderApi.post<{
			requires_payment: boolean;
			held_pass: { id: string; status: string };
		}>(`/api/series-passes/${pass.id}/checkout`, {});
		expect(checkout.requires_payment).toBe(false);
		expect(checkout.held_pass.status).toBe('active');
		await claimTicketViaApi(direct, eventA.id, eventA.freeTierId as string);

		const holderName = `${holder.firstName} ${holder.lastName}`;
		const directName = `${direct.firstName} ${direct.lastName}`;

		const context = await browser.newContext();
		try {
			await authenticateContext(context, org.owner);
			const page = await context.newPage();
			await gotoHydrated(page, `/org/${org.slug}/admin/events/${eventA.id}/tickets`);
			await waitForClientAuth(page);
			await expect(page.getByRole('heading', { name: 'Manage Tickets' })).toBeVisible();

			const holderRow = page
				.locator(TICKET_ROW)
				.filter({ hasText: holderName })
				.filter({ visible: true })
				.first();
			const directRow = page
				.locator(TICKET_ROW)
				.filter({ hasText: directName })
				.filter({ visible: true })
				.first();
			await expect(holderRow).toBeVisible({ timeout: 20_000 });
			await expect(directRow).toBeVisible();

			// --- 1. Source filter ------------------------------------------
			await page.getByRole('button', { name: 'Season pass', exact: true }).click();
			await expect(page).toHaveURL(/source=pass/, { timeout: 15_000 });
			await expect(page.getByText(directName).filter({ visible: true })).toHaveCount(0, {
				timeout: 15_000
			});
			await expect(holderRow).toBeVisible();
			await expect(holderRow).toContainText(`From season pass “${pass.name}”`);

			await page.getByRole('button', { name: 'Direct purchase', exact: true }).click();
			await expect(page).toHaveURL(/source=direct/, { timeout: 15_000 });
			await expect(page.getByText(holderName).filter({ visible: true })).toHaveCount(0, {
				timeout: 15_000
			});
			await expect(directRow).toBeVisible();
			await expect(directRow).not.toContainText('Season pass');

			await page.getByRole('button', { name: 'Season pass', exact: true }).click();
			await expect(page).toHaveURL(/source=pass/, { timeout: 15_000 });
			await expect(holderRow).toBeVisible({ timeout: 15_000 });

			// --- 2. Scan the pass QR payload via manual entry --------------
			const passCode = `series:${checkout.held_pass.id}`;
			await page.getByRole('button', { name: 'Scan QR Code to Check In' }).click();
			const scanner = page.getByRole('dialog', { name: 'Scan QR Code' });
			await scanner.getByLabel('Enter ticket code manually').fill(passCode);
			await scanner.getByRole('button', { name: 'Check in' }).click();

			// No preview dialog for pass codes: the confirmation is the toast.
			await expect(page.getByText(`Series pass checked in: ${holderName}`)).toBeVisible({
				timeout: 15_000
			});
			await expect(scanner).toBeHidden();
			await expect(
				page
					.locator(TICKET_ROW)
					.filter({ hasText: holderName })
					.filter({ hasText: /Checked In/ })
					.filter({ visible: true })
					.first()
			).toBeVisible({ timeout: 15_000 });

			// Re-scanning the same pass at the same event is refused.
			await page.getByRole('button', { name: 'Scan QR Code to Check In' }).click();
			await scanner.getByLabel('Enter ticket code manually').fill(passCode);
			await scanner.getByRole('button', { name: 'Check in' }).click();
			await expect(page.getByText('This ticket has already been checked in.')).toBeVisible({
				timeout: 15_000
			});
		} finally {
			await context.close();
		}
	});
});
