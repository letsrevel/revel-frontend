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

	// The hosted page lists payment methods as a radio accordion (Card,
	// Klarna, iDEAL, …) and only renders the card fields once Card is
	// expanded. Single-method sessions show the fields directly, so expand
	// only when they aren't already there. The Card radio is COVERED by a
	// zero-size "Pay with card" button that intercepts pointer events, so a
	// normal click can never land — dispatch the click straight to it.
	// Role-scoped: the adaptive-pricing layout (shown when Stripe geolocates
	// the runner outside the session's currency zone) names the field the
	// same but getByLabel stops matching it.
	const cardNumber = page.getByRole('textbox', { name: 'Card number' }).first();
	await expect(async () => {
		if (await cardNumber.isVisible()) return;
		// Adaptive pricing variant: a "Choose a currency:" toggle precedes the
		// form. Selecting the original (€) price gets the standard layout —
		// match the € button specifically so retries don't flip currencies.
		const euro = page
			.getByRole('group', { name: /Choose a currency/ })
			.getByRole('button', { name: /€/, disabled: false });
		if ((await euro.count()) > 0) {
			await euro.first().click();
		}
		const accordion = page.locator('[data-testid="card-accordion-item-button"]');
		if ((await accordion.count()) > 0) {
			await accordion.dispatchEvent('click');
		}
		await expect(cardNumber).toBeVisible({ timeout: 5_000 });
	}).toPass({ timeout: 60_000 });

	// Email may be prefilled (session created server-side with the buyer's
	// email — sometimes rendered as plain text) — only fill an empty input.
	const email = page.getByLabel('Email');
	if (
		(await email.count()) > 0 &&
		(await email.first().isEditable()) &&
		(await email.first().inputValue()) === ''
	) {
		await email.first().fill('e2e-buyer@example.com');
	}

	// textbox-scoped: plain getByLabel also matches Stripe's decorative
	// labelled icons (e.g. the CVC card graphic) and trips strict mode.
	await cardNumber.fill(card.number);
	await page.getByRole('textbox', { name: 'Expiration' }).fill(card.expiry);
	await page.getByRole('textbox', { name: /CVC|Security code/ }).fill(card.cvc);
	// The cardholder-name field is not part of every checkout layout.
	const holder = page.getByRole('textbox', { name: /Cardholder name|Name on card/ });
	if ((await holder.count()) > 0) {
		await holder.first().fill(card.name);
	}

	// Stripe sometimes shows extra opt-ins (Link, save-my-info) — leave defaults.
	const submit = page.getByTestId('hosted-payment-submit-button');
	if ((await submit.count()) > 0) {
		await submit.click();
	} else {
		await page.getByRole('button', { name: 'Pay', exact: true }).click();
	}

	// Back on the app after payment (success URL is app-origin).
	await page.waitForURL(/localhost:5173/, { timeout: 45_000 });
	await expect(page).not.toHaveURL(/checkout\.stripe\.com/);
}
