import type { Browser } from '@playwright/test';
import { test, expect } from '../../support/fixtures';
import { createVerifiedUser } from '../../support/factories';
import { gotoHydrated, waitForClientAuth } from '../../support/navigation';
import {
	completeStripeCheckout,
	expectWebhookEffect,
	requireStripeWebhooks
} from '../../support/stripe';
import {
	PAID_EVENT_PATH,
	PAID_HOST,
	PAID_ORIGIN,
	tenantPage,
	tenantUnavailableReason
} from '../../support/tenant';

// Custom domains (#1056) — paid checkout on `paid.localhost`: the seeded
// `tenant-paid-event` (tier "Standard Ticket", ONLINE, 10.00 EUR) of
// `tenant-paid-org`, which uses the platform Stripe account. Mirrors j06 stripe-online: stepper → Buy → sheet →
// Pay Now → hosted Stripe Checkout. Reaching checkout.stripe.com needs the connected
// account (CONNECTED_TEST_STRIPE_ID at bootstrap, tests/e2e/README.md); the
// payment-and-return test additionally needs the `stripe listen` forwarder and,
// like every Stripe spec, FAILS (never skips) without it.

test.describe('J30 paid checkout on a tenant host @p1', () => {
	// eslint-disable-next-line no-empty-pattern
	test.beforeEach(async ({}, testInfo) => {
		const reason = await tenantUnavailableReason(PAID_HOST, { needsTenantMode: true });
		testInfo.skip(reason !== null, reason ?? '');
	});

	/** Throwaway buyer, then drive the UI on paid.localhost to Stripe. */
	async function startCheckoutOnPaidHost(browser: Browser) {
		const buyer = await createVerifiedUser('PaidTenantBuyer');

		const page = await tenantPage(browser, PAID_ORIGIN, buyer);
		await gotoHydrated(page, PAID_EVENT_PATH);
		await waitForClientAuth(page);
		expect(new URL(page.url()).host).toBe(new URL(PAID_ORIGIN).host);

		const stepper = page.getByRole('group', { name: 'Quantity for Standard Ticket' });
		await expect(stepper).toBeVisible({ timeout: 15_000 });
		const summaryBar = page.getByTestId('cart-summary-bar');
		const sheet = page.getByRole('dialog', { name: 'Checkout' });
		const payNow = sheet.getByRole('button', { name: 'Pay Now', exact: true });
		// Same idempotent loop as j06 stripe-online: clicks during rerenders are
		// occasionally dropped, so retry from whatever state the UI is in.
		await expect(async () => {
			if (page.url().includes('checkout.stripe.com')) return;
			if (!(await sheet.isVisible())) {
				if ((await stepper.locator('span[aria-live="polite"]').textContent()) === '0') {
					await stepper.getByRole('button', { name: 'Add one Standard Ticket' }).click();
				}
				await summaryBar.getByRole('button', { name: 'Buy', exact: true }).click();
				await expect(sheet).toBeVisible({ timeout: 8_000 });
			}
			await sheet.getByLabel('Name for ticket 1').fill('E2E Tenant Buyer');
			await payNow.click();
			await page.waitForURL(/checkout\.stripe\.com/, { timeout: 15_000 });
		}).toPass({ timeout: 90_000 });

		return { page };
	}

	test('buying a paid ticket on the custom domain reaches Stripe Checkout', async ({ browser }) => {
		test.setTimeout(180_000);
		requireStripeWebhooks();

		const { page } = await startCheckoutOnPaidHost(browser);
		await expect(page).toHaveURL(/^https:\/\/checkout\.stripe\.com\//);

		await page.context().close();
	});

	// Stripe success/cancel URLs stay on the PLATFORM's opaque UUID routes
	// (backend #1167: no organizer-chosen hostnames reach Stripe, and checkout
	// idempotency needs byte-identical params). The return hops platform UUID
	// route → same UUID path on paid.localhost (where the buyer's host-only
	// session lives) → the slug event page, query string intact.
	test('paying returns the buyer to the tenant host with payment_success', async ({ browser }) => {
		test.setTimeout(240_000);
		requireStripeWebhooks();

		const { page } = await startCheckoutOnPaidHost(browser);
		await completeStripeCheckout(page);

		await expect(page).toHaveURL(
			new RegExp(`^${PAID_ORIGIN}${PAID_EVENT_PATH}\\?(.*&)?payment_success=true`),
			{ timeout: 30_000 }
		);
		const activeCard = page
			.locator('article, li, div')
			.filter({ hasText: /Standard Ticket|Tenant Paid/i })
			.filter({ hasText: /Active/i })
			.first();
		await expectWebhookEffect(
			'the ticket to flip Active on /dashboard/tickets (tenant host)',
			async () => {
				await gotoHydrated(page, '/dashboard/tickets');
				await expect(activeCard).toBeVisible({ timeout: 5_000 });
			},
			{ timeout: 90_000 }
		);

		await page.context().close();
	});
});
