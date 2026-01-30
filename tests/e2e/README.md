# E2E Tests

End-to-end tests for Revel Frontend using [Playwright](https://playwright.dev/).

## Prerequisites

1. **Backend running**: The backend API must be running at `http://localhost:8000`
2. **Seed data loaded**: The backend should have test users seeded (see Test Users below)
3. **Browsers installed**: Run `pnpm exec playwright install` to install browsers

## Quick Start

```bash
# Run all E2E tests
pnpm test:e2e

# Run tests with UI mode (recommended for debugging)
pnpm exec playwright test --ui

# Run tests on specific browser
pnpm exec playwright test --project=chromium
pnpm exec playwright test --project=firefox
pnpm exec playwright test --project=webkit

# Run specific test file
pnpm exec playwright test tests/e2e/admin/event-creation.spec.ts

# Run tests matching a pattern
pnpm exec playwright test -g "should create RSVP event"

# View test report
pnpm exec playwright show-report
```

## Test Users

Tests use seeded users from the backend (`make bootstrap`):

| User    | Email                      | Password      | Role                    | Organization              |
|---------|----------------------------|---------------|-------------------------|---------------------------|
| Alice   | alice.owner@example.com    | password123   | Organization owner      | Revel Events Collective   |
| Bob     | bob.staff@example.com      | password123   | Organization staff      | Revel Events Collective   |
| Charlie | charlie.member@example.com | password123   | Organization member     | Revel Events Collective   |
| Diana   | diana.owner@example.com    | password123   | Organization owner      | Tech Innovators Network   |
| George  | george.attendee@example.com| password123   | Regular attendee        | -                         |

**Organization Slugs:**
- `revel-events-collective` - Owned by Alice, staff: Bob, member: Charlie
- `tech-innovators-network` - Owned by Diana

## Directory Structure

```
tests/e2e/
├── README.md              # This file
├── fixtures/              # Test fixtures and helpers
│   ├── auth.fixture.ts    # Authentication helpers (loginAs, TEST_USERS)
│   ├── test-data.fixture.ts # Test data constants
│   └── index.ts           # Fixture exports
├── pages/                 # Page Object Models
│   └── base.page.ts       # Base page class
├── auth/                  # Authentication tests
│   ├── register.spec.ts   # User registration
│   ├── password-reset.spec.ts # Password reset flow
│   └── logout.spec.ts     # Logout functionality
├── events/                # Event discovery tests
│   ├── event-listing.spec.ts  # Event listing page
│   ├── event-detail.spec.ts   # Event detail page
│   ├── rsvp-flow.spec.ts      # RSVP functionality
│   └── potluck.spec.ts        # Potluck features
├── tickets/               # Ticketing tests
│   └── ticket-purchase.spec.ts # Ticket purchase flow
├── dashboard/             # User dashboard tests
│   ├── dashboard.spec.ts  # Main dashboard
│   └── my-events.spec.ts  # RSVPs, tickets, invitations
├── account/               # Account management tests
│   └── profile.spec.ts    # Profile, settings, security
├── admin/                 # Organization admin tests
│   ├── event-creation.spec.ts # Event creation wizard
│   └── event-editing.spec.ts  # Event editing & publication
└── login.spec.ts          # Login tests (legacy location)
```

## Test Coverage

### Authentication (`auth/`)
- User registration with validation
- Password reset flow
- Logout functionality
- Session management

### Events (`events/`)
- Event listing with filters and search
- Calendar and list view modes
- Event detail page
- RSVP flow (Yes/Maybe/No)
- Potluck item management

### Tickets (`tickets/`)
- Viewing ticket tiers
- Free ticket claiming
- Ticket modal display
- Dashboard tickets page

### Dashboard (`dashboard/`)
- Welcome message and quick actions
- Activity cards (tickets, RSVPs, invitations)
- Calendar view toggle
- RSVPs, tickets, invitations pages
- Following organizations

### Account (`account/`)
- Profile editing (name, pronouns, language)
- Security settings
- Notification preferences
- Privacy settings

### Admin (`admin/`)
- **Event Creation** (29 tests)
  - Wizard structure and validation
  - RSVP events (no tickets)
  - Ticketed events with tiers
  - Capacity settings (max attendees, waitlist)
  - Advanced options (potluck, invitation requests, guest access)
  - Visibility options (public, unlisted, private)
  - Event types (public, members-only, invitation-only)
  - Mobile responsiveness

- **Event Editing** (33 tests)
  - Loading and updating event details
  - Publication workflow (draft → publish → close)
  - Event duplication
  - Events list management
  - Ticketing configuration
  - Mobile responsiveness
  - Accessibility compliance

## Running Specific Test Suites

```bash
# Authentication tests
pnpm exec playwright test tests/e2e/auth/

# Event discovery tests
pnpm exec playwright test tests/e2e/events/

# Dashboard tests
pnpm exec playwright test tests/e2e/dashboard/

# Account management tests
pnpm exec playwright test tests/e2e/account/

# Admin tests (event creation/editing)
pnpm exec playwright test tests/e2e/admin/

# Ticket purchase tests
pnpm exec playwright test tests/e2e/tickets/
```

## Writing New Tests

### Using Auth Fixtures

```typescript
import { test, expect } from '@playwright/test';
import { TEST_USERS } from '../fixtures/auth.fixture';

test('should do something as authenticated user', async ({ page }) => {
  // Login
  await page.goto('/login');
  await page.getByRole('textbox', { name: 'Email address' }).fill(TEST_USERS.alice.email);
  await page.getByRole('textbox', { name: 'Password' }).fill(TEST_USERS.alice.password);
  await page.getByRole('button', { name: 'Sign in' }).click();
  await expect(page).toHaveURL('/dashboard');

  // Your test logic here
});
```

### Best Practices

1. **Use accessible selectors**: Prefer `getByRole`, `getByLabel`, `getByText` over CSS selectors
   ```typescript
   // Good
   page.getByRole('button', { name: 'Submit' })
   page.getByLabel('Email address')

   // Avoid
   page.locator('.btn-primary')
   page.locator('#email-input')
   ```

2. **Handle empty states gracefully**: Tests should pass whether data exists or not
   ```typescript
   const hasEvents = await eventList.isVisible().catch(() => false);
   const hasEmptyState = await emptyState.isVisible().catch(() => false);
   expect(hasEvents || hasEmptyState).toBe(true);
   ```

3. **Use explicit waits**: Avoid arbitrary timeouts
   ```typescript
   // Good
   await expect(page.getByRole('heading')).toBeVisible();
   await page.waitForLoadState('networkidle');

   // Avoid
   await page.waitForTimeout(5000);
   ```

4. **Test mobile viewports**: Include mobile tests for responsive features
   ```typescript
   test.describe('Mobile', () => {
     test.use({ viewport: { width: 375, height: 667 } });

     test('should work on mobile', async ({ page }) => {
       // Mobile-specific test
     });
   });
   ```

5. **Add timeout for slow operations**: Increase timeout when needed
   ```typescript
   test('should handle slow operation', async ({ page }) => {
     test.setTimeout(60000); // 60 seconds
     // Test logic
   });
   ```

## Debugging Tests

### Interactive UI Mode
```bash
pnpm exec playwright test --ui
```

### Debug Mode (step through tests)
```bash
pnpm exec playwright test --debug
```

### Headed Mode (see browser)
```bash
pnpm exec playwright test --headed
```

### Generate Test Code
```bash
pnpm exec playwright codegen http://localhost:5173
```

### View Traces on Failure
```bash
pnpm exec playwright show-trace test-results/*/trace.zip
```

## Troubleshooting

### Tests timeout finding organization
The admin tests try to find an organization the test user owns. If tests timeout:
1. Ensure the backend has seed data loaded
2. Check that Alice owns an organization
3. Try running with fewer workers: `--workers=4`

### Strict mode violations (multiple elements found)
Use more specific selectors:
```typescript
// Instead of
page.getByRole('heading', { level: 1 })

// Use
page.getByRole('heading', { name: /create.*event/i })
```

### Tests pass individually but fail in parallel
Reduce worker count to avoid resource contention:
```bash
pnpm exec playwright test --workers=4
```

### Browser not installed
```bash
pnpm exec playwright install chromium
pnpm exec playwright install firefox
pnpm exec playwright install webkit
```

## CI/CD Integration

The tests are configured to run in CI with:
- Screenshots on failure
- Video recording on retry
- HTML report generation

See `playwright.config.ts` for configuration details.
