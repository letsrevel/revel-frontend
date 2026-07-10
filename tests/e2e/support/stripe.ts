import { expect, type Page } from '@playwright/test';

/**
 * Drives Stripe's HOSTED checkout page in test mode.
 *
 * The app hands off with a full-page redirect to `checkout_url`
 * (event-checkout-controller.svelte.ts), so by the time this helper runs the
 * page is (or is about to be) on checkout.stripe.com. After payment Stripe
 * redirects back to the app; ticket activation happens via the webhook, so
 * callers should then poll the UI for the ACTIVE state — never the webhook.
 *
 * Requires the backend to be running with a Stripe test key, the local
 * `stripe listen` webhook forwarder, and `CONNECTED_TEST_STRIPE_ID` set at
 * bootstrap time (see tests/e2e/README.md).
 */

export const TEST_CARD = {
	number: '4242 4242 4242 4242',
	expiry: '12 / 34',
	cvc: '123',
	name: 'E2E Test Buyer'
} as const;

export async function completeStripeCheckout(
	page: Page,
	card: typeof TEST_CARD = TEST_CARD
): Promise<void> {
	await page.waitForURL(/checkout\.stripe\.com/, { timeout: 20_000 });

	// Stripe's hosted form. Email may be prefilled (session created server-side
	// with the buyer's email) — only fill it when the field is empty & editable.
	const email = page.getByLabel('Email');
	if ((await email.count()) > 0 && (await email.first().inputValue()) === '') {
		await email.first().fill('e2e-buyer@example.com');
	}

	await page.getByLabel('Card number').fill(card.number);
	await page.getByLabel('Expiration').fill(card.expiry);
	await page.getByLabel(/CVC|Security code/).fill(card.cvc);
	await page.getByLabel(/Cardholder name|Name on card/).fill(card.name);

	// Stripe sometimes shows extra opt-ins (Link, save-my-info) — leave defaults.
	await page.getByTestId('hosted-payment-submit-button').click();

	// Back on the app after payment (success URL is app-origin).
	await page.waitForURL(/localhost:5173/, { timeout: 30_000 });
	await expect(page).not.toHaveURL(/checkout\.stripe\.com/);
}
