import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
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
	'No webhook-driven effect appeared anywhere in this run, across two independent ' +
	'Stripe flows. The leading hypothesis is a missing webhook forwarder: run ' +
	'`make run-stripe` in `revel-backend` ' +
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
 *   expired   — a webhook-only wait burned its whole budget with nothing
 *               delivered anywhere in the run yet. ONE of these rules nothing
 *               out (see below); it is filed as evidence and the caller's own
 *               assertion error is rethrown untouched.
 *   ruled out — CORROBORATION_THRESHOLD *distinct* webhook effects have expired
 *               with no delivery. Later waits then abort immediately instead of
 *               each spending 90–150s on a webhook that is not coming.
 *
 * Why corroboration, and what it does NOT prove.
 *
 * `expectWebhookEffect` retries an arbitrary UI callback, so a single expiry is
 * ambiguous by construction: a plain app regression on that surface looks
 * exactly like a webhook that never arrived. Ruling out a whole run on one
 * expiry meant a UI bug could abort 21 later tests under a forwarder diagnosis
 * its assertion never established. The verdict therefore needs evidence from
 * two DIFFERENT effects — keyed by `description`, so the same effect awaited by
 * two specs (or the same test on retry) counts once, and the two records come
 * from genuinely different surfaces (a ticket list vs a membership card vs an
 * invoice table). A regression that takes out two unrelated surfaces at once is
 * far less likely than one that takes out a single flow.
 *
 * This is corroboration, not proof, which is why the message offers the
 * forwarder as the leading hypothesis rather than asserting it. Proof would
 * need a webhook-SPECIFIC signal, and there is none reachable from here: the
 * backend logs every verified inbound event in `StripeWebhookEvent`, but that
 * table is exposed only through the Django admin (session auth, and the E2E
 * seed creates no superuser) — no REST route reads it. A staff-only or
 * debug-only "events seen since T" counter on the backend would let this guard
 * observe the forwarder directly and drop the heuristic entirely.
 *
 * A false "delivered" remains impossible by construction — it is only written
 * after a real webhook-driven assertion passed. A false "ruled out" costs a red
 * run its detail, not its verdict: records are only filed when a test was
 * already failing. This is DELIBERATELY not a skip: the Stripe paths stay
 * failures, the documented skip baseline stays at 3.
 */

/**
 * How many DISTINCT webhook effects must expire, with nothing delivered, before
 * the run is ruled out. Two is the cheapest number that stops a single UI
 * regression from mis-diagnosing a run; the cost of raising it from one is a
 * second full wait (~90–150s) against the ~24 minutes the guard saves.
 */
const CORROBORATION_THRESHOLD = 2;

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
/** One file per distinct expired effect, named by a digest of its description. */
const EXPIRY_DIR = join(VERDICT_DIR, 'expired');

function readMarker(path: string): string | null {
	try {
		return readFileSync(path, 'utf8');
	} catch {
		return null;
	}
}

/**
 * Create a marker, never overwrite one.
 *
 * `wx` is what keeps the FIRST writer's diagnostic: parallel workers can reach
 * the same marker, and the loser's `EEXIST` lands in the catch below, which is
 * already best-effort. Nothing reads a marker expecting it to have been
 * rewritten — `delivered` is only ever tested for existence, and each expiry
 * file is keyed by its description so a second writer would only be restating
 * the same effect.
 */
function writeMarker(path: string, body: string): void {
	try {
		mkdirSync(dirname(path), { recursive: true });
		writeFileSync(path, body, { flag: 'wx' });
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

/** File the expiry of one webhook effect, once per distinct description. */
function recordExpiry(description: string): void {
	const key = createHash('sha256').update(description).digest('hex').slice(0, 16);
	writeMarker(join(EXPIRY_DIR, key), `${currentTest()} — waiting for ${description}`);
}

function modifiedAt(path: string): number {
	try {
		return statSync(path).mtimeMs;
	} catch {
		return 0;
	}
}

/** Every distinct expired wait of this run, oldest first. */
function expiredWaits(): string[] {
	let entries: string[];
	try {
		entries = readdirSync(EXPIRY_DIR);
	} catch {
		// No directory yet: nothing has expired.
		return [];
	}
	return entries
		.map((name) => join(EXPIRY_DIR, name))
		.sort((a, b) => modifiedAt(a) - modifiedAt(b))
		.map(readMarker)
		.filter((body): body is string => body !== null);
}

/**
 * The corroborating expired waits once the run is ruled out, else null.
 *
 * A single delivery anywhere makes this permanently null — there is no path
 * from a seen webhook back to a forwarder complaint.
 */
function ruledOutBy(): string[] | null {
	if (existsSync(DELIVERED_MARKER)) return null;
	const expired = expiredWaits();
	return expired.length >= CORROBORATION_THRESHOLD ? expired : null;
}

function listWaits(waits: readonly string[]): string {
	return waits.map((wait) => `  - ${wait}`).join('\n');
}

/**
 * Leave the forwarder hypothesis on a test that expired without corroboration.
 *
 * The assertion error itself is rethrown untouched — it is the honest report
 * when one wait has expired — so the hint rides along as a report annotation
 * instead of rewriting the failure. Matters most when a single spec is run
 * under `--grep`, where a second effect can never corroborate.
 */
function noteForwarderHypothesis(description: string): void {
	try {
		test.info().annotations.push({
			type: 'stripe-webhook',
			description:
				`The wait for ${description} expired and no webhook-driven effect has been ` +
				'seen anywhere in this run. If this is not an app regression, check that the ' +
				'`stripe listen` forwarder is running (`make run-stripe` in `revel-backend`).'
		});
	} catch {
		// Outside a running test there is no report to annotate. A hint we
		// cannot attach must never be the reason a test fails.
	}
}

/**
 * Abort NOW when earlier tests in this run already burned full webhook budgets
 * on two distinct effects without a single delivery.
 *
 * Call it as the first statement of any test whose ARRANGE spends minutes
 * driving hosted checkout before it can even reach a webhook-dependent
 * assertion — that whole arrange is wasted once the run has been ruled out.
 * `expectWebhookEffect` applies the same guard, so tests that reach a webhook
 * wait cheaply do not need this call.
 */
export function requireStripeWebhooks(): void {
	const corroboration = ruledOutBy();
	if (corroboration === null) return;
	throw new Error(
		`${STRIPE_FORWARDER_MISSING_MESSAGE}\n\n` +
			`The ${corroboration.length} distinct waits that expired, oldest first:\n` +
			`${listWaits(corroboration)}\n` +
			'Aborting before the arrange rather than repeating those waits. If the ' +
			'forwarder IS running, those expiries are real failures — fix them and re-run.'
	);
}

/**
 * Wait for a backend state change that can ONLY be delivered by the
 * `stripe listen` webhook forwarder, and record what happened.
 *
 * Drop-in for the `await expect(async () => { … }).toPass({ timeout })` polling
 * loops that follow `completeStripeCheckout()`: same retry semantics, same
 * timeout budget, no behaviour change at all while webhooks are flowing. What
 * it adds is the run-wide verdict above — once two distinct effects have
 * expired with nothing delivered, the rest of the run stops paying for them.
 *
 * `description` identifies the effect, so pick one per surface and keep it
 * stable: it is both the failure-line wording AND the corroboration key. Phrase
 * it for a failure line, e.g. 'the ticket flips ACTIVE on /dashboard/tickets'.
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
		// A webhook was seen earlier: this failure is the caller's own, and the
		// guard has nothing to add to it.
		if (existsSync(DELIVERED_MARKER)) throw error;
		recordExpiry(description);
		const corroboration = ruledOutBy();
		if (corroboration === null) {
			// Uncorroborated. One expired UI wait cannot tell a missing forwarder
			// apart from a regression on this surface, so the caller's assertion
			// error is rethrown verbatim (Playwright keeps its locator detail) and
			// the forwarder rides along as an annotated hypothesis.
			noteForwarderHypothesis(description);
			throw error;
		}
		throw new Error(
			`${STRIPE_FORWARDER_MISSING_MESSAGE}\n\n` +
				`Waited ${options.timeout}ms for ${description}, which nothing but that ` +
				`webhook can produce. The ${corroboration.length} distinct waits that have ` +
				`expired in this run, oldest first:\n${listWaits(corroboration)}\n\n` +
				'If the forwarder IS running, these are real failures — the assertion ' +
				`error follows.\n\n${error instanceof Error ? error.message : String(error)}`,
			{ cause: error }
		);
	}
	if (!existsSync(DELIVERED_MARKER)) {
		writeMarker(DELIVERED_MARKER, `${currentTest()} — ${description}`);
	}
}
