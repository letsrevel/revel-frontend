import { test, expect } from '../../support/fixtures';
import {
	createTicketedEvent,
	createVerifiedUser,
	claimTicketViaApi
} from '../../support/factories';
import { authenticateContext } from '../../support/session';
import { gotoHydrated, waitForClientAuth } from '../../support/navigation';

// J6.5 (USER_JOURNEYS.md) — managing held tickets in /dashboard/tickets:
// list, status + payment-method filters, search, QR display, PDF download.
//
// Isolation: instead of charlie's seeded tickets (whose statuses/dates drift
// with the clock and with other suites mutating them), a throwaway user holds
// exactly ONE known ticket — an API-claimed free ticket on a fresh event — so
// every filter has a deterministic expected result.

test.describe('J6 ticket management @p1', () => {
	test('dashboard list: filters, search, QR display, PDF download', async ({ browser }) => {
		const [event, user] = await Promise.all([
			createTicketedEvent(),
			createVerifiedUser('TicketMgmt')
		]);
		if (!event.freeTierId) throw new Error('arranged event is missing its free tier');
		await claimTicketViaApi(user, event.id, event.freeTierId);

		const context = await browser.newContext();
		await authenticateContext(context, user);
		const page = await context.newPage();

		// The one held ticket renders as an Active card. Reload-retry: a
		// silently unauthorized my-tickets query renders the empty state and
		// heals on a fresh load (see free-tier.spec.ts).
		const ticketCard = page
			.locator('article, li, div')
			.filter({ hasText: event.name })
			.filter({ hasText: /Active/i })
			.first();
		await expect(async () => {
			await gotoHydrated(page, '/dashboard/tickets');
			await waitForClientAuth(page);
			await expect(ticketCard).toBeVisible({ timeout: 5_000 });
		}).toPass({ timeout: 45_000 });

		const emptyState = page.getByRole('heading', { name: 'No tickets found' });

		// Status filter: Active keeps the ticket, Cancelled filters it out.
		await page.getByRole('button', { name: 'Active', exact: true }).click();
		await expect(ticketCard).toBeVisible();
		await page.getByRole('button', { name: 'Cancelled', exact: true }).click();
		await expect(emptyState).toBeVisible();
		await page.getByRole('button', { name: 'Clear Filters' }).click();
		await expect(ticketCard).toBeVisible();

		// Payment-method filter: Free keeps it, Paid filters it out.
		await page.getByRole('button', { name: 'Free', exact: true }).click();
		await expect(ticketCard).toBeVisible();
		await page.getByRole('button', { name: 'Paid', exact: true }).click();
		await expect(emptyState).toBeVisible();
		await page.getByRole('button', { name: 'Clear Filters' }).click();

		// Search matches the event name (debounced input), garbage matches nothing.
		const search = page.getByRole('searchbox');
		await search.fill(event.name);
		await expect(ticketCard).toBeVisible();
		await search.fill('zzz-no-such-event-zzz');
		await expect(emptyState).toBeVisible();
		await search.fill('');
		await expect(ticketCard).toBeVisible();

		// QR display: the ticket modal renders the QR image and the ticket id.
		await ticketCard.getByRole('button', { name: 'View ticket and QR code' }).click();
		const modal = page.getByRole('dialog', { name: 'Your Ticket' });
		await expect(modal).toBeVisible();
		await expect(modal.getByRole('img', { name: 'Ticket QR Code' })).toBeVisible();
		await expect(modal.getByText('Ticket ID:')).toBeVisible();

		// PDF download: served either as a blob download or (with a pre-signed
		// URL) a new tab — accept both, reject the inline error alert.
		const downloadOrPopup = Promise.race([
			page
				.waitForEvent('download', { timeout: 30_000 })
				.then(() => 'download' as const)
				.catch(() => null),
			page
				.waitForEvent('popup', { timeout: 30_000 })
				.then(() => 'popup' as const)
				.catch(() => null)
		]);
		await modal.getByRole('button', { name: 'Download PDF' }).click();
		expect(['download', 'popup']).toContain(await downloadOrPopup);
		await expect(modal.getByRole('alert')).not.toBeVisible();

		await context.close();
	});
});
