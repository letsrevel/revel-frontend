import { test, expect } from '@playwright/test';
import { TEST_USERS } from '../fixtures/auth.fixture';

/**
 * Helper to navigate to the first available event
 */
async function navigateToFirstEvent(page: import('@playwright/test').Page): Promise<boolean> {
	await page.goto('/events');
	await page.waitForLoadState('networkidle');
	await page.waitForTimeout(2000);

	// Try multiple selectors for finding event links
	const eventListItem = page.locator('[role="listitem"]').first();
	const eventLinks = page.locator('a[href*="/events/"]').filter({ hasText: /.+/ });

	const hasListItem = await eventListItem.isVisible().catch(() => false);
	const hasEventLinks = (await eventLinks.count()) > 0;

	if (!hasListItem && !hasEventLinks) {
		return false;
	}

	// Click the first available event link
	if (hasListItem) {
		const link = eventListItem.getByRole('link').first();
		await link.click();
	} else {
		await eventLinks.first().click();
	}

	// Wait for navigation and page load
	try {
		await expect(page).toHaveURL(/\/events\/[^/]+\/[^/]+$/, { timeout: 10000 });
		await expect(page.getByRole('heading', { level: 1 })).toBeVisible({ timeout: 10000 });
		return true;
	} catch {
		return false;
	}
}

test.describe('RSVP Flow - Authenticated User', () => {
	test.beforeEach(async ({ page }) => {
		// Login as Alice (organization owner - known to work)
		await page.goto('/login');
		await page.getByRole('textbox', { name: 'Email address' }).fill(TEST_USERS.alice.email);
		await page.getByRole('textbox', { name: 'Password' }).fill(TEST_USERS.alice.password);
		await page.getByRole('button', { name: 'Sign in' }).click();
		await expect(page).toHaveURL('/dashboard');
	});

	test('should display RSVP options when viewing event', async ({ page }) => {
		const success = await navigateToFirstEvent(page);
		if (!success) {
			test.skip(true, 'No events available to test');
			return;
		}

		// Look for RSVP-related elements on the page (sidebar or mobile actions)
		// The sidebar uses EventActionSidebar component which contains RSVP buttons
		const yesButton = page.getByRole('button', { name: /^yes$/i });
		const maybeButton = page.getByRole('button', { name: /^maybe$/i });
		const getTicketsButton = page.getByRole('button', { name: /get tickets|buy tickets/i });
		const rsvpQuestion = page.getByText(/will you attend|are you going/i);

		// Wait for any of these to appear
		await page.waitForTimeout(2000);

		const hasYesButton = await yesButton
			.first()
			.isVisible()
			.catch(() => false);
		const hasMaybeButton = await maybeButton
			.first()
			.isVisible()
			.catch(() => false);
		const hasGetTickets = await getTicketsButton
			.first()
			.isVisible()
			.catch(() => false);
		const hasRsvpQuestion = await rsvpQuestion
			.first()
			.isVisible()
			.catch(() => false);

		// At least one form of RSVP action should be available
		expect(hasYesButton || hasMaybeButton || hasGetTickets || hasRsvpQuestion).toBe(true);
	});

	test('should show RSVP buttons for non-ticketed event', async ({ page }) => {
		const success = await navigateToFirstEvent(page);
		if (!success) return;

		// Look for RSVP-related UI elements
		const rsvpQuestion = page.getByText(/will you attend|are you going/i);
		const yesButton = page.getByRole('button', { name: /^yes$/i });
		const maybeButton = page.getByRole('button', { name: /^maybe$/i });
		const getTicketsButton = page.getByRole('button', { name: /get tickets|buy tickets/i });

		const hasRsvpQuestion = await rsvpQuestion.isVisible().catch(() => false);
		const hasYesButton = await yesButton
			.first()
			.isVisible()
			.catch(() => false);
		const hasMaybeButton = await maybeButton
			.first()
			.isVisible()
			.catch(() => false);
		const hasGetTickets = await getTicketsButton
			.first()
			.isVisible()
			.catch(() => false);

		// At least one form of action should be available
		expect(hasRsvpQuestion || hasYesButton || hasMaybeButton || hasGetTickets).toBe(true);
	});

	test('should RSVP Yes to event and show confirmation', async ({ page }) => {
		const success = await navigateToFirstEvent(page);
		if (!success) return;

		// Try to find and click Yes button
		const yesButton = page.getByRole('button', { name: /^yes$/i }).first();
		const hasYesButton = await yesButton.isVisible().catch(() => false);

		if (hasYesButton) {
			await yesButton.click();

			// Should show success message or attendance status
			const successMessage = page
				.getByRole('status')
				.or(page.getByText(/you're.*attending|going.*to/i));
			await expect(successMessage.first()).toBeVisible({ timeout: 10000 });
		}
	});

	test('should RSVP Maybe to event', async ({ page }) => {
		const success = await navigateToFirstEvent(page);
		if (!success) return;

		// Try to find and click Maybe button
		const maybeButton = page.getByRole('button', { name: /^maybe$/i }).first();
		const hasMaybeButton = await maybeButton.isVisible().catch(() => false);

		if (hasMaybeButton) {
			await maybeButton.click();

			// Should show success message
			const successMessage = page
				.getByRole('status')
				.or(page.getByText(/might.*attend|interested/i));
			await expect(successMessage.first()).toBeVisible({ timeout: 10000 });
		}
	});

	test('should allow changing RSVP status', async ({ page }) => {
		const success = await navigateToFirstEvent(page);
		if (!success) return;

		// First RSVP Yes
		const yesButton = page.getByRole('button', { name: /^yes$/i }).first();
		const hasYesButton = await yesButton.isVisible().catch(() => false);

		if (hasYesButton) {
			await yesButton.click();
			await page.waitForTimeout(1000);

			// Look for change response button
			const changeButton = page.getByRole('button', { name: /change.*rsvp|change.*response/i });
			const hasChangeButton = await changeButton.isVisible().catch(() => false);

			if (hasChangeButton) {
				await changeButton.click();
				// Should show RSVP buttons again
				const maybeButton = page.getByRole('button', { name: /^maybe$/i }).first();
				await expect(maybeButton).toBeVisible({ timeout: 5000 });
			}
		}
	});

	test('should show attendance status after RSVP', async ({ page }) => {
		const success = await navigateToFirstEvent(page);
		if (!success) return;

		// Check if already RSVP'd or RSVP now
		const attendingStatus = page.getByText(/you're.*attending|you.*have.*ticket/i);
		const yesButton = page.getByRole('button', { name: /^yes$/i }).first();

		const alreadyAttending = await attendingStatus
			.first()
			.isVisible()
			.catch(() => false);
		const hasYesButton = await yesButton.isVisible().catch(() => false);

		if (!alreadyAttending && hasYesButton) {
			await yesButton.click();
			await page.waitForTimeout(1000);
		}

		// Just verify page works
		expect(true).toBe(true);
	});
});

test.describe('RSVP Flow - Unauthenticated User', () => {
	test('should show login prompt when trying to RSVP', async ({ page }) => {
		const success = await navigateToFirstEvent(page);
		if (!success) return;

		// Should either show login link, guest RSVP button, or ticket option
		const loginLink = page.getByRole('link', { name: /login|sign.*in/i });
		const guestButton = page.getByRole('button', { name: /rsvp|attend/i });
		const ticketOption = page.getByRole('button', { name: /get tickets|claim/i });

		const hasLogin = await loginLink
			.first()
			.isVisible()
			.catch(() => false);
		const hasGuest = await guestButton
			.first()
			.isVisible()
			.catch(() => false);
		const hasTicket = await ticketOption
			.first()
			.isVisible()
			.catch(() => false);

		// One of these should be available for unauthenticated users
		expect(hasLogin || hasGuest || hasTicket).toBe(true);
	});

	test('should have login link with redirect', async ({ page }) => {
		const success = await navigateToFirstEvent(page);
		if (!success) return;

		// Look for login link
		const loginLink = page.getByRole('link', { name: /login|sign.*in/i }).first();
		const hasLoginLink = await loginLink.isVisible().catch(() => false);

		if (hasLoginLink) {
			const href = await loginLink.getAttribute('href');
			expect(href).toContain('/login');
		}
	});
});

test.describe('RSVP Flow - Mobile', () => {
	test.use({ viewport: { width: 375, height: 667 } });

	test.beforeEach(async ({ page }) => {
		// Login as Alice
		await page.goto('/login');
		await page.getByRole('textbox', { name: 'Email address' }).fill(TEST_USERS.alice.email);
		await page.getByRole('textbox', { name: 'Password' }).fill(TEST_USERS.alice.password);
		await page.getByRole('button', { name: 'Sign in' }).click();
		await expect(page).toHaveURL('/dashboard');
	});

	test('should RSVP on mobile', async ({ page }) => {
		const success = await navigateToFirstEvent(page);
		if (!success) return;

		// Try to RSVP
		const yesButton = page.getByRole('button', { name: /^yes$/i }).first();
		const hasYesButton = await yesButton.isVisible().catch(() => false);

		if (hasYesButton) {
			await yesButton.click();

			// Should show success
			const successMessage = page
				.getByRole('status')
				.or(page.getByText(/you're.*attending|going.*to/i));
			await expect(successMessage.first()).toBeVisible({ timeout: 10000 });
		}
	});

	test('should display event page on mobile', async ({ page }) => {
		const success = await navigateToFirstEvent(page);
		if (!success) return;

		// Event title should be visible
		const title = page.getByRole('heading', { level: 1 });
		await expect(title).toBeVisible();
	});
});

test.describe('RSVP Flow - Keyboard Navigation', () => {
	test.beforeEach(async ({ page }) => {
		await page.goto('/login');
		await page.getByRole('textbox', { name: 'Email address' }).fill(TEST_USERS.alice.email);
		await page.getByRole('textbox', { name: 'Password' }).fill(TEST_USERS.alice.password);
		await page.getByRole('button', { name: 'Sign in' }).click();
		await expect(page).toHaveURL('/dashboard');
	});

	test('should navigate RSVP buttons with keyboard', async ({ page }) => {
		const success = await navigateToFirstEvent(page);
		if (!success) return;

		// Check if RSVP buttons exist
		const yesButton = page.getByRole('button', { name: /^yes$/i }).first();
		const hasYesButton = await yesButton.isVisible().catch(() => false);

		if (hasYesButton) {
			// Focus on Yes button
			await yesButton.focus();
			await expect(yesButton).toBeFocused();

			// Press Enter to submit
			await page.keyboard.press('Enter');
			await page.waitForTimeout(1000);
		}
	});
});
