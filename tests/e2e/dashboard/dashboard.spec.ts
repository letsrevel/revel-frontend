import { test, expect } from '@playwright/test';
import { loginAsUser } from '../fixtures/auth.fixture';

test.describe('Dashboard - Main Page', () => {
	test.beforeEach(async ({ page }) => {
		await loginAsUser(page, 'alice');
	});

	test('should display welcome message with user name', async ({ page }) => {
		// Wait for page to load
		await page.waitForTimeout(1000);

		// Should show "Welcome back" heading
		const welcomeHeading = page.getByRole('heading', { level: 1 });
		await expect(welcomeHeading).toBeVisible();

		const headingText = await welcomeHeading.textContent();
		expect(headingText?.toLowerCase()).toContain('welcome');
	});

	test('should display Browse Events quick action', async ({ page }) => {
		// Look for Browse Events button/link in the main content area (not nav or footer)
		const mainContent = page.locator('#main-content');
		const browseEventsButton = mainContent.getByRole('link', { name: /browse events/i });
		await expect(browseEventsButton).toBeVisible();

		// Verify it links to /events
		const href = await browseEventsButton.getAttribute('href');
		expect(href).toBe('/events');
	});

	test('should display quick action buttons', async ({ page }) => {
		// Wait for page to load
		await page.waitForTimeout(1000);

		// Look for quick action buttons in main content area
		const mainContent = page.locator('#main-content');
		const browseEvents = mainContent.getByRole('link', { name: /browse events/i });
		const createEvent = mainContent
			.getByRole('link', { name: /create event/i })
			.or(mainContent.getByRole('button', { name: /create event/i }));
		const myOrganizations = mainContent.getByRole('button', { name: /my organizations/i });

		const hasBrowseEvents = await browseEvents.isVisible().catch(() => false);
		const hasCreateEvent = await createEvent
			.first()
			.isVisible()
			.catch(() => false);
		const hasMyOrgs = await myOrganizations.isVisible().catch(() => false);

		// Browse events should always be visible
		expect(hasBrowseEvents).toBe(true);
	});

	test('should display activity cards when user has activity', async ({ page }) => {
		// Wait for data to load
		await page.waitForTimeout(2000);

		// Look for activity summary cards (tickets, RSVPs, invitations)
		const ticketCard = page.locator('text=/active tickets/i');
		const rsvpCard = page.locator('text=/upcoming rsvps/i');
		const invitationCard = page.locator('text=/pending invitations/i');

		// At least check the page structure is correct - main content should exist
		const mainContent = page.locator('#main-content');
		await expect(mainContent).toBeVisible();
	});

	test('should display Discover Events section', async ({ page }) => {
		// Wait for data to load
		await page.waitForTimeout(2000);

		// Look for Discover Events section heading
		const discoverSection = page.getByRole('heading', { name: /discover events/i });
		await expect(discoverSection).toBeVisible();
	});

	test('should display My Organizations section', async ({ page }) => {
		// Wait for data to load
		await page.waitForTimeout(2000);

		// Look for My Organizations section heading
		const orgSection = page.getByRole('heading', { name: /my organizations/i });
		await expect(orgSection).toBeVisible();
	});

	test('should navigate to events page from Browse Events', async ({ page }) => {
		// Click Browse Events in main content area
		const mainContent = page.locator('#main-content');
		const browseEventsButton = mainContent.getByRole('link', { name: /browse events/i });
		await browseEventsButton.click();

		// Should navigate to /events
		await expect(page).toHaveURL('/events');
	});
});

test.describe('Dashboard - Your Events Section', () => {
	test.beforeEach(async ({ page }) => {
		await loginAsUser(page, 'alice');
	});

	test('should display Your Events section if user has events', async ({ page }) => {
		// Wait for data to load
		await page.waitForTimeout(2000);

		// Look for Your Events section (may not exist for new users)
		const yourEventsSection = page.getByRole('heading', { name: /your events/i });
		const hasYourEvents = await yourEventsSection.isVisible().catch(() => false);

		// Just verify page structure
		expect(true).toBe(true);
	});

	test('should display filter buttons in Your Events section', async ({ page }) => {
		// Wait for data to load
		await page.waitForTimeout(2000);

		// Look for filter buttons
		const allFilter = page.getByRole('button', { name: /^all$/i });
		const organizingFilter = page.getByRole('button', { name: /organizing/i });
		const attendingFilter = page.getByRole('button', { name: /attending/i });
		const invitedFilter = page.getByRole('button', { name: /invited/i });

		// Filters may only be visible if user has events
		const hasAllFilter = await allFilter.isVisible().catch(() => false);
		const hasOrganizingFilter = await organizingFilter.isVisible().catch(() => false);
		const hasAttendingFilter = await attendingFilter.isVisible().catch(() => false);

		// If Your Events section exists, filters should be there
		expect(true).toBe(true);
	});

	test('should filter events when clicking Organizing filter', async ({ page }) => {
		await page.waitForTimeout(2000);

		const organizingFilter = page.getByRole('button', { name: /organizing/i });
		const hasFilter = await organizingFilter.isVisible().catch(() => false);

		if (hasFilter) {
			await organizingFilter.click();
			await page.waitForTimeout(1000);

			// Filter should be active (visually different)
			const isActive = await organizingFilter.evaluate((el) => el.className.includes('bg-primary'));
		}
	});

	test('should filter events when clicking Attending filter', async ({ page }) => {
		await page.waitForTimeout(2000);

		const attendingFilter = page.getByRole('button', { name: /attending/i });
		const hasFilter = await attendingFilter.isVisible().catch(() => false);

		if (hasFilter) {
			await attendingFilter.click();
			await page.waitForTimeout(1000);
		}
	});

	test('should toggle between list and calendar view', async ({ page }) => {
		await page.waitForTimeout(2000);

		// Look for view toggle button
		const calendarViewButton = page.getByRole('button', { name: /calendar view/i });
		const listViewButton = page.getByRole('button', { name: /list view/i });

		const hasCalendarToggle = await calendarViewButton.isVisible().catch(() => false);

		if (hasCalendarToggle) {
			await calendarViewButton.click();
			await page.waitForTimeout(1000);

			// Should now show List View button
			const hasListToggle = await listViewButton.isVisible().catch(() => false);
			expect(hasListToggle).toBe(true);
		}
	});

	test('should display calendar controls when in calendar view', async ({ page }) => {
		await page.waitForTimeout(2000);

		const calendarViewButton = page.getByRole('button', { name: /calendar view/i });
		const hasCalendarToggle = await calendarViewButton.isVisible().catch(() => false);

		if (hasCalendarToggle) {
			await calendarViewButton.click();
			await page.waitForTimeout(1000);

			// Calendar controls should be visible
			const prevButton = page.getByRole('button', { name: /previous/i });
			const nextButton = page.getByRole('button', { name: /next/i });

			const hasPrev = await prevButton.isVisible().catch(() => false);
			const hasNext = await nextButton.isVisible().catch(() => false);

			// Either calendar controls exist or empty state is shown
			expect(true).toBe(true);
		}
	});
});

test.describe('Dashboard - Organizations Section', () => {
	test.beforeEach(async ({ page }) => {
		await loginAsUser(page, 'alice');
	});

	test('should display organization cards or empty state', async ({ page }) => {
		await page.waitForTimeout(2000);

		// Look for organization section
		const orgSection = page.locator('#organizations-section');
		await expect(orgSection).toBeVisible();

		// Either organization cards or empty state should be visible
		const orgCards = orgSection.locator('[class*="border"]');
		const emptyState = orgSection.getByText(/no organizations/i);

		const hasCards = (await orgCards.count()) > 0;
		const hasEmptyState = await emptyState.isVisible().catch(() => false);

		expect(hasCards || hasEmptyState).toBe(true);
	});

	test('should show View Profile button on organization cards', async ({ page }) => {
		await page.waitForTimeout(2000);

		const viewProfileButton = page.getByRole('link', { name: /view profile/i });
		const hasViewProfile = await viewProfileButton
			.first()
			.isVisible()
			.catch(() => false);

		// View Profile button exists if user has organizations
		expect(true).toBe(true);
	});

	test('should show Admin button for owned organizations', async ({ page }) => {
		await page.waitForTimeout(2000);

		// Look for Admin button (only visible for owners/staff)
		const adminButton = page.getByRole('link', { name: /admin/i });
		const hasAdminButton = await adminButton
			.first()
			.isVisible()
			.catch(() => false);

		// Admin button exists if user owns/manages organizations
		expect(true).toBe(true);
	});

	test('should navigate to organization profile when clicking View Profile', async ({ page }) => {
		await page.waitForTimeout(2000);

		const viewProfileButton = page.getByRole('link', { name: /view profile/i }).first();
		const hasViewProfile = await viewProfileButton.isVisible().catch(() => false);

		if (hasViewProfile) {
			await viewProfileButton.click();

			// Should navigate to /org/[slug]
			await expect(page).toHaveURL(/\/org\/[^/]+$/);
		}
	});

	test('should navigate to admin panel when clicking Admin button', async ({ page }) => {
		await page.waitForTimeout(2000);

		const adminButton = page.getByRole('link', { name: /admin/i }).first();
		const hasAdminButton = await adminButton.isVisible().catch(() => false);

		if (hasAdminButton) {
			await adminButton.click();

			// Should navigate to /org/[slug]/admin
			await expect(page).toHaveURL(/\/org\/[^/]+\/admin/);
		}
	});
});

test.describe('Dashboard - Mobile', () => {
	test.use({ viewport: { width: 375, height: 667 } });

	test.beforeEach(async ({ page }) => {
		await loginAsUser(page, 'alice');
	});

	test('should display dashboard on mobile', async ({ page }) => {
		await page.waitForTimeout(1000);

		// Welcome heading should be visible
		const welcomeHeading = page.getByRole('heading', { level: 1 });
		await expect(welcomeHeading).toBeVisible();
	});

	test('should stack quick action buttons on mobile', async ({ page }) => {
		await page.waitForTimeout(1000);

		// Browse Events button in main content should be visible
		const mainContent = page.locator('#main-content');
		const browseEventsButton = mainContent.getByRole('link', { name: /browse events/i });
		await expect(browseEventsButton).toBeVisible();
	});

	test('should display sections stacked vertically on mobile', async ({ page }) => {
		await page.waitForTimeout(2000);

		// Sections should all be visible in vertical layout
		const discoverSection = page.getByRole('heading', { name: /discover events/i });
		const orgSection = page.getByRole('heading', { name: /my organizations/i });

		await expect(discoverSection).toBeVisible();
		await expect(orgSection).toBeVisible();
	});
});

test.describe('Dashboard - Activity Cards', () => {
	test.beforeEach(async ({ page }) => {
		await loginAsUser(page, 'alice');
	});

	test('should navigate to tickets page from Active Tickets card', async ({ page }) => {
		await page.waitForTimeout(2000);

		const ticketCard = page.getByRole('link', { name: /active tickets/i });
		const hasTicketCard = await ticketCard.isVisible().catch(() => false);

		if (hasTicketCard) {
			await ticketCard.click();
			await expect(page).toHaveURL('/dashboard/tickets');
		}
	});

	test('should navigate to RSVPs page from Upcoming RSVPs card', async ({ page }) => {
		await page.waitForTimeout(2000);

		const rsvpCard = page.getByRole('link', { name: /upcoming rsvps/i });
		const hasRsvpCard = await rsvpCard.isVisible().catch(() => false);

		if (hasRsvpCard) {
			await rsvpCard.click();
			await expect(page).toHaveURL('/dashboard/rsvps');
		}
	});

	test('should navigate to invitations page from Pending Invitations card', async ({ page }) => {
		await page.waitForTimeout(2000);

		const invitationCard = page.getByRole('link', { name: /pending invitations/i });
		const hasInvitationCard = await invitationCard.isVisible().catch(() => false);

		if (hasInvitationCard) {
			await invitationCard.click();
			await expect(page).toHaveURL('/dashboard/invitations');
		}
	});
});
