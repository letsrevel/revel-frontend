import { test, expect } from '../../support/fixtures';
import { createTicketedEvent, createVerifiedUser } from '../../support/factories';
import { authenticateContext } from '../../support/session';
import { gotoHydrated, waitForClientAuth } from '../../support/navigation';
import { waitForEmail } from '../../support/mailpit';

// J6.2 (USER_JOURNEYS.md) — free-tier ticket: claim → ACTIVE immediately →
// visible in /dashboard/tickets → transactional confirmation email.
//
// Isolation: an API-arranged event (the seeded events' free tiers only go on
// sale 30 days before start, so they drift in and out of purchasability) and
// a THROWAWAY registered+verified user (tickets consume per-user quotas, so a
// persona would make the spec single-shot).

test.describe('J6 free-tier ticket @p0', () => {
	test('claim free ticket → active in dashboard → confirmation email', async ({ browser }) => {
		const [event, user] = await Promise.all([
			createTicketedEvent(),
			createVerifiedUser('FreeTier')
		]);
		const context = await browser.newContext();
		await authenticateContext(context, user);
		const page = await context.newPage();
		await gotoHydrated(page, event.path);
		await waitForClientAuth(page);

		await expect(page.getByRole('heading', { name: 'Free Entry' }).first()).toBeVisible();

		// Eligibility CTA → tier-selection dialog → confirmation → claim. Clicks
		// during dialog re-renders are occasionally dropped, so run the whole
		// sequence as an idempotent loop that exits on the success signal (the
		// claimed-ticket modal showing the ticket id/QR).
		const tierDialog = page.getByRole('dialog', { name: 'Select Your Ticket' });
		const claimTicket = page.getByRole('button', { name: 'Claim Ticket', exact: true });
		const success = page.getByRole('dialog', { name: 'Your Ticket' });
		await expect(async () => {
			if (await success.isVisible()) return;
			if (await claimTicket.isVisible()) {
				await claimTicket.click();
			} else if (await tierDialog.isVisible()) {
				await tierDialog.getByRole('button', { name: 'Claim Free Ticket' }).click();
				await claimTicket.click();
			} else {
				await page.getByRole('button', { name: 'Get Tickets', exact: true }).click();
				await tierDialog.getByRole('button', { name: 'Claim Free Ticket' }).click();
				await claimTicket.click();
			}
			await expect(success).toBeVisible({ timeout: 8_000 });
		}).toPass({ timeout: 60_000 });

		// Dashboard shows the ticket as Active. Reload-retry: a silently
		// unauthorized my-tickets query renders the empty state instead of an
		// error (issue #596 item 1) and heals on a fresh load.
		const ticketCard = page
			.locator('article, li, div')
			.filter({ hasText: event.name })
			.filter({ hasText: /Active/i })
			.first();
		await expect(async () => {
			await gotoHydrated(page, '/dashboard/tickets');
			await expect(ticketCard).toBeVisible({ timeout: 5_000 });
		}).toPass({ timeout: 45_000 });

		// Transactional confirmation email is delivered immediately (inline Celery).
		const email = await waitForEmail({ to: user.email, subject: 'icket' });
		expect(email.Subject).toMatch(/ticket/i);

		await context.close();
	});
});
