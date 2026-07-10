import { test, expect } from '../../support/fixtures';

// J1.2 (USER_JOURNEYS.md) — anonymous event detail: public content is shown
// (description, tiers, attendance count), member/attendee content is gated
// behind a sign-in prompt, and there is no attendee list. Read-only.

test.describe('J1 guest views event details @p0', () => {
	test('shows public content and ticket tiers for a ticketed event', async ({ page }) => {
		await page.goto('/events/revel-events-collective/summer-sunset-music-festival');

		await expect(
			page.getByRole('heading', { level: 1, name: 'Summer Sunset Music Festival' }).first()
		).toBeVisible();
		await expect(
			page.getByRole('link', { name: /Organized by Revel Events Collective/ })
		).toBeVisible();
		await expect(page.getByRole('heading', { name: 'About this event' })).toBeVisible();

		// Event details sidebar: attendance count + type, no attendee names.
		await expect(page.getByText(/\d+ attending/)).toBeVisible();
		await expect(page.getByText('Ticketed event')).toBeVisible();

		// Public tiers with price and a purchase CTA are visible to guests.
		await expect(page.getByRole('heading', { name: 'Ticket Options' })).toBeVisible();
		await expect(page.getByRole('heading', { name: 'Early Bird General Admission' })).toBeVisible();
		await expect(page.getByText('USD 45.00')).toBeVisible();
		expect(await page.getByRole('button', { name: 'Get Ticket' }).count()).toBeGreaterThan(0);

		// The PRIVATE invited-only tier (wine-tasting style) must not leak; the
		// festival has none, but member-only content is gated generally:
		await expect(
			page.getByRole('heading', { name: 'Sign in to see more of this event' })
		).toBeVisible();
		await expect(page.getByRole('link', { name: 'Sign in' }).first()).toBeVisible();

		// No attendee list for guests.
		await expect(page.getByRole('heading', { name: /Attendees/ })).toBeHidden();
	});

	test('shows the RSVP card with a sign-in gate for a free-RSVP event', async ({ page }) => {
		await page.goto('/events/revel-events-collective/spring-community-potluck');

		await expect(
			page
				.getByRole('heading', { level: 1, name: 'Spring Community Potluck & Garden Party' })
				.first()
		).toBeVisible();
		await expect(page.getByRole('heading', { name: 'Will you attend?' })).toBeVisible();

		// The sign-in link preserves the return URL back to this event.
		const signIn = page.getByRole('link', { name: 'Sign in' }).first();
		await expect(signIn).toBeVisible();
		await expect(signIn).toHaveAttribute('href', /returnUrl=.*spring-community-potluck/);

		// Potluck items are attendee-only — guests get no potluck signup list.
		await expect(page.getByRole('button', { name: /I'll bring this/ })).toBeHidden();
	});

	test('unknown event returns the error page', async ({ page }) => {
		const response = await page.goto('/events/revel-events-collective/does-not-exist');
		expect(response?.status()).toBe(404);
	});
});
