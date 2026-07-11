import { test, expect } from '../../support/fixtures';
import { createTicketedEvent } from '../../support/factories';
import { authenticateContext } from '../../support/session';
import { gotoHydrated, waitForClientAuth } from '../../support/navigation';

// J3.4 (USER_JOURNEYS.md) — bookmarks: add from the event detail sidebar,
// find the event under the dashboard "Bookmarked" preset, remove it from the
// event card's overlay button.
//
// Isolation: each project bookmarks its OWN API-created event as a DIFFERENT
// persona (hannah / ivan) — parallel projects never race one user's bookmark
// state, and a stale bookmark left by a failed earlier run can't collide with
// a freshly created event.

test.describe('J3 bookmarks @p1', () => {
	test('bookmark on detail, listed under Bookmarked facet, unbookmark on card', async ({
		browser,
		isMobile
	}) => {
		test.setTimeout(120_000);
		const event = await createTicketedEvent();
		const context = await browser.newContext();
		await authenticateContext(context, isMobile ? 'user2' : 'user');
		const page = await context.newPage();

		// Add on the event detail sidebar (bookmarking is a client mutation —
		// it needs the bootstrapped in-memory token).
		await gotoHydrated(page, event.path);
		await waitForClientAuth(page);
		const addButton = page.getByRole('button', { name: 'Bookmark this event' });
		await addButton.click();
		await expect(page.getByText('Event bookmarked')).toBeVisible({ timeout: 15_000 });
		// The same control flips to its remove state.
		const removeOnDetail = page.getByRole('button', { name: 'Remove bookmark' });
		await expect(removeOnDetail).toBeVisible();
		await expect(removeOnDetail).toHaveAttribute('aria-pressed', 'true');

		// The Bookmarked dashboard preset lists it. Scope to the "Your Events"
		// region — the dashboard's public discover section can also surface this
		// (public, soon-starting) event, and that copy never goes away.
		await gotoHydrated(page, '/dashboard');
		await page.getByRole('button', { name: 'Bookmarked' }).click();
		const yourEvents = page.getByRole('region', { name: /^Your Events/ });
		const card = yourEvents.locator('article').filter({ hasText: event.name }).first();
		await expect(card.getByRole('heading', { name: event.name })).toBeVisible();

		// Cards overlay a remove-bookmark button (only when bookmarked) — use it.
		await card.getByRole('button', { name: 'Remove bookmark' }).click();
		await expect(page.getByText('Bookmark removed')).toBeVisible({ timeout: 15_000 });
		await expect(yourEvents.getByRole('heading', { name: event.name })).toBeHidden();

		// Gone server-side too: the detail page renders the add state again.
		await gotoHydrated(page, event.path);
		await waitForClientAuth(page);
		await expect(page.getByRole('button', { name: 'Bookmark this event' })).toBeVisible();

		await context.close();
	});
});
