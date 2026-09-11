import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { expect, test, type Page } from '@playwright/test';

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

/* -------------------------------------------------------------------------- *
 * Webhook-forwarder guard (#919)
 * -------------------------------------------------------------------------- */

export const STRIPE_FORWARDER_MISSING_MESSAGE =
	'Stripe webhook forwarder not detected. Run `make run-stripe` in `revel-backend` ' +
	'(`stripe listen --forward-to localhost:8000/api/stripe/webhook`) before this suite.';

/**
 * Why the verdict is OBSERVED and never guessed.
 *
 * `stripe listen` opens an OUTBOUND websocket to Stripe and binds no local
 * port, so nothing about the forwarder is reachable from this process: there is
 * no socket to connect to, and a process-name probe (`pgrep`) is both
 * platform-specific and a liar (a wedged or wrong-target forwarder still shows
 * up). The only honest signal available here is the forwarder's EFFECT — a
 * backend state change that can arrive by no other route (a ticket flipping
 * ACTIVE, a subscription's Welcome card, a generated attendee invoice).
 *
 * So this module never claims "the forwarder is running". It records what the
 * run actually saw:
 *
 *   delivered — some webhook-only effect landed. Every later wait behaves
 *               exactly as it did before this guard existed: full timeout, its
 *               own assertion error on failure. There is no path from here back
 *               to a forwarder complaint, which is what makes a false "missing"
 *               verdict impossible once a single webhook has been seen.
 *   missing   — a webhook-only wait burned its whole budget and NOTHING had
 *               been delivered in this run yet. Later waits then abort
 *               immediately instead of each spending 90–150s on a webhook that
 *               is not coming.
 *   unknown   — nothing observed yet: wait, with the caller's normal timeout.
 *
 * A false "delivered" is impossible by construction — it is only written after
 * a real webhook-driven assertion passed. A false "missing" costs a red run its
 * detail, not its verdict: the marker is only written when a test was already
 * failing, and the message hedges (it names the first expired wait and says so)
 * rather than asserting a diagnosis. This is DELIBERATELY not a skip: the
 * Stripe paths stay failures, the documented skip baseline stays at 3.
 */

/**
 * The verdict lives in files, not in a module variable.
 *
 * `support/skip.ts` caches its backend probe per worker, and copying that here
 * would achieve nothing: Playwright spawns a FRESH worker process after every
 * test failure, so the cache would be thrown away at exactly the moment it
 * matters and all 22 Stripe tests would pay the full wait again. Keying the
 * directory by the run id that `global-setup.ts` plants in the environment
 * (inherited by every worker, unique per run) keeps concurrent and later runs
 * from reading each other's verdict.
 */
const VERDICT_DIR = join(
	tmpdir(),
	'revel-e2e-stripe-webhooks',
	process.env.E2E_RUN_ID ?? `ppid-${process.ppid}`
);
const DELIVERED_MARKER = join(VERDICT_DIR, 'delivered');
const MISSING_MARKER = join(VERDICT_DIR, 'missing');

function readMarker(path: string): string | null {
	try {
		return readFileSync(path, 'utf8');
	} catch {
		return null;
	}
}

function writeMarker(path: string, body: string): void {
	try {
		mkdirSync(VERDICT_DIR, { recursive: true });
		writeFileSync(path, body);
	} catch {
		// Bookkeeping only: a verdict we cannot persist costs the next test
		// another wait. It must never be the reason a test fails.
	}
}

function currentTest(): string {
	try {
		return test.info().titlePath.join(' › ');
	} catch {
		return 'unknown test';
	}
}

/** The first expired webhook wait of this run, or null while none has expired. */
function ruledOutBy(): string | null {
	if (existsSync(DELIVERED_MARKER)) return null;
	return readMarker(MISSING_MARKER);
}

/**
 * Abort NOW when an earlier test in this run already burned a full webhook
 * budget without a single delivery.
 *
 * Call it as the first statement of any test whose ARRANGE spends minutes
 * driving hosted checkout before it can even reach a webhook-dependent
 * assertion — that whole arrange is wasted once the run has been ruled out.
 * `expectWebhookEffect` applies the same guard, so tests that reach a webhook
 * wait cheaply do not need this call.
 */
export function requireStripeWebhooks(): void {
	const firstFailure = ruledOutBy();
	if (firstFailure === null) return;
	throw new Error(
		`${STRIPE_FORWARDER_MISSING_MESSAGE}\n\n` +
			'No Stripe webhook was delivered anywhere in this run; the first wait to ' +
			`expire was:\n  ${firstFailure}\n` +
			'Aborting before the arrange rather than repeating that wait. If the ' +
			'forwarder IS running, that first expiry is a real failure — fix it and re-run.'
	);
}

/**
 * Wait for a backend state change that can ONLY be delivered by the
 * `stripe listen` webhook forwarder, and record what happened.
 *
 * Drop-in for the `await expect(async () => { … }).toPass({ timeout })` polling
 * loops that follow `completeStripeCheckout()`: same retry semantics, same
 * timeout budget, no behaviour change at all while webhooks are flowing. What
 * it adds is the run-wide verdict above — the first expiry names the forwarder,
 * the rest of the run stops paying for it.
 *
 * `description` is what the webhook is expected to make happen, phrased for a
 * failure line, e.g. 'the ticket flips ACTIVE on /dashboard/tickets'.
 */
export async function expectWebhookEffect(
	description: string,
	assertion: () => Promise<void>,
	options: { timeout: number }
): Promise<void> {
	requireStripeWebhooks();
	try {
		await expect(assertion).toPass({ timeout: options.timeout });
	} catch (error) {
		if (!existsSync(DELIVERED_MARKER)) {
			writeMarker(MISSING_MARKER, `${currentTest()} — waiting for ${description}`);
			throw new Error(
				`${STRIPE_FORWARDER_MISSING_MESSAGE}\n\n` +
					`Waited ${options.timeout}ms for ${description}, which nothing but that ` +
					'webhook can produce, and no webhook has been delivered anywhere in this ' +
					'run. If the forwarder IS running, this is a real failure — the assertion ' +
					`error follows.\n\n${error instanceof Error ? error.message : String(error)}`,
				{ cause: error }
			);
		}
		throw error;
	}
	if (!existsSync(DELIVERED_MARKER)) {
		writeMarker(DELIVERED_MARKER, `${currentTest()} — ${description}`);
	}
}
