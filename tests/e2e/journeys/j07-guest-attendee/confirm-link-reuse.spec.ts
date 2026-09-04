import { test, expect } from '../../support/fixtures';
import { createTicketedEvent, uniqueEmail } from '../../support/factories';
import { API_URL, ApiError, fetchWithRetry } from '../../support/api';
import { extractLink, waitForEmail } from '../../support/mailpit';

// Prod incident 2026-09-04 ("Kitts Meets") regression guard: every backend
// rejection at /events/confirm-action used to collapse into the meaningless
// hard-coded "No data returned from confirmation" (ConfirmationResult only
// checked response.data; the client resolves non-2xx instead of throwing).
// The realistic rejection is a guest clicking their confirmation email twice:
// the first confirm blacklists the token, the second answers 401 "Token is
// blacklisted." — which the page must localize to the already-confirmed copy.
//
// Arrange via API (guest RSVP submit + first confirm), assert via UI (the
// second visit) — only the failure branch under test goes through the page.

test.describe('J7 guest confirm-link reuse @p2', () => {
	test('a second visit to a used confirmation link explains, not "No data returned"', async ({
		page
	}) => {
		test.setTimeout(120_000);

		const event = await createTicketedEvent({
			freeTier: false,
			event: { requires_ticket: false, can_attend_without_login: true }
		});
		const email = uniqueEmail('ConfirmReuse');

		const rsvp = await fetchWithRetry(`${API_URL}/api/events/${event.id}/rsvp/yes/public`, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ email, first_name: 'E2E', last_name: 'ConfirmReuse' })
		});
		if (!rsvp.ok) {
			throw new ApiError(rsvp.status, 'POST', `/api/events/${event.id}/rsvp/yes/public`, '');
		}

		const message = await waitForEmail({ to: email, subject: 'Confirm your RSVP to' });
		const link = extractLink(message, /confirm-action\?token=/);

		// First confirmation succeeds through the UI (and blacklists the token).
		await page.goto(link);
		await expect(async () => {
			const retry = page.getByRole('button', { name: 'Try Again' });
			if (await retry.isVisible()) await retry.click();
			await expect(page.getByRole('heading', { name: 'RSVP Confirmed!' })).toBeVisible({
				timeout: 10_000
			});
		}).toPass({ timeout: 45_000 });

		// Second visit: the failure page must carry the REAL, localized reason.
		await page.goto(link);
		await expect(page.getByRole('heading', { name: 'Confirmation Failed' })).toBeVisible({
			timeout: 15_000
		});
		await expect(page.getByText('This action has already been confirmed.').first()).toBeVisible();
		await expect(page.getByText('No data returned from confirmation')).toHaveCount(0);
	});
});
