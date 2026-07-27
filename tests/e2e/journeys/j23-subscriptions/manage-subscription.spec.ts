import type { Locator, Page } from '@playwright/test';
import { test, expect } from '../../support/fixtures';
import {
	createMembershipTier,
	createSubscriptionPlan,
	createVerifiedUser,
	getOrganizationId,
	subscribeViaApi,
	uniqueName,
	type ThrowawayUser
} from '../../support/factories';
import { authenticateContext } from '../../support/session';
import { membershipCard } from '../../support/membership-locators';
import { gotoHydrated, waitForClientAuth } from '../../support/navigation';
import { completeStripeCheckout } from '../../support/stripe';

// J23.5 (USER_JOURNEYS.md) — member SELF-SERVICE on a live Stripe subscription:
// change plan (both directions), cancel (both modes) and the billing portal
// hand-off. Everything here is driven from /account/memberships, the only
// surface that offers these controls (MembershipCard + its two dialogs).
//
// Sibling coverage: subscribe-online.spec.ts owns the org-page → hosted
// checkout → webhook journey; this spec compresses that arrange to
// subscribeViaApi + page.goto(checkout_url) and only re-asserts what it needs
// (an ACTIVE card) before exercising management.
//
// Requires the full Stripe test-mode setup from tests/e2e/README.md (backend
// bootstrapped with CONNECTED_TEST_STRIPE_ID + the `stripe listen` forwarder).
//
// Isolation / retry-safety: Org Alpha is the only Stripe-connected org, so the
// plans live there — but every test arranges its OWN uniqueName()-d tier +
// plans and its OWN throwaway subscriber inside the test body. A retry
// therefore never inherits the subscription of the attempt before it (the
// backend refuses a second non-terminal subscription per user per org), and
// the change-plan catalogue — which is org-wide — is still navigated by unique
// plan name, so concurrent workers' plans cannot be picked by accident.

const ORG_SLUG = 'revel-events-collective';
const ORG_NAME = 'Revel Events Collective';
const ORG_PATH = `/org/${ORG_SLUG}`;

/**
 * Dates render through `date.ts`, which always uses a TEXTUAL month (the
 * house rule that keeps DD/MM vs MM/DD ambiguity out of the UI) — `formatDate`
 * picks the SHORT form, e.g. "Aug 27, 2026". Asserting the presence of a month
 * name proves a real formatted date without recomputing the backend's period
 * boundary (or its timezone) here.
 */
const MONTH = 'Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec';

function escapeRe(value: string): string {
	return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** The org's card in the account hub's Memberships section. Every test in this
 *  file works against the one seeded org, so the shared helper is bound to it. */
function orgCard(page: Page): Locator {
	return membershipCard(page, ORG_NAME);
}

/**
 * Re-open the account hub until the card settles into the asserted shape.
 *
 * Every management action here ends in a Stripe round trip whose confirmation
 * webhooks land AFTER the HTTP response the dialog already succeeded on, and
 * they do not land in order. PROBED on the live stack (cancel-at-period-end
 * after a downgrade): the POST returned `cancel_at_period_end: true` at
 * T+0.507s, the `subscription_schedule.released` webhook (raised by the cancel
 * releasing the queued downgrade) was applied at T+0.543s and mirrored Stripe's
 * pre-modify snapshot back onto the row — `cancel_at_period_end: false` — and
 * the `customer.subscription.updated` webhook for the modify itself only
 * corrected it at T+0.850s. The dialog's one-shot `invalidateQueries` refetch
 * fired inside that ~300ms window and latched the wrong value: with nothing
 * polling afterwards, the card keeps showing "Next renewal" until the member
 * reloads. Reloading here asserts the state the member actually converges on
 * instead of that transient. (Reported as a finding of this task — the fix,
 * seeding the cache from the mutation's own response or briefly re-polling,
 * belongs in src, not in the spec.)
 */
async function reloadUntil(
	page: Page,
	assertions: (card: Locator) => Promise<void>,
	timeout = 90_000
): Promise<void> {
	await expect(async () => {
		await gotoHydrated(page, '/account/memberships');
		await waitForClientAuth(page);
		await assertions(orgCard(page));
	}).toPass({ timeout });
}

/**
 * Two ONLINE plans on one fresh tier of Org Alpha (€15 "Standard" and €10
 * "Lite", same currency so both are change-plan candidates for the other),
 * plus the throwaway subscriber and the org id the member endpoints are keyed
 * by.
 */
async function arrangeTwoPlans(label: string): Promise<{
	user: ThrowawayUser;
	orgId: string;
	standard: { id: string; name: string };
	lite: { id: string; name: string };
}> {
	const [tier, user, orgId] = await Promise.all([
		createMembershipTier('owner', ORG_SLUG, uniqueName(`${label} Tier`)),
		createVerifiedUser(label),
		getOrganizationId(ORG_SLUG)
	]);
	const [standard, lite] = await Promise.all([
		createSubscriptionPlan('owner', ORG_SLUG, tier.id, {
			name: uniqueName(`${label} Standard`),
			payment_method: 'online',
			price: '15.00',
			currency: 'EUR'
		}),
		createSubscriptionPlan('owner', ORG_SLUG, tier.id, {
			name: uniqueName(`${label} Lite`),
			payment_method: 'online',
			price: '10.00',
			currency: 'EUR'
		})
	]);
	return { user, orgId, standard, lite };
}

/**
 * Get to ACTIVE the cheap way: mint the subscription + hosted session over the
 * API, pay it on Stripe, then poll the account hub until the `stripe listen`
 * webhook has flipped the row ACTIVE. The org-page UI around this is
 * subscribe-online.spec.ts's job, not ours.
 */
async function subscribeAndPay(
	page: Page,
	user: ThrowawayUser,
	orgId: string,
	plan: { id: string; name: string }
): Promise<void> {
	const { checkoutUrl } = await subscribeViaApi(user, orgId, plan.id);
	expect(checkoutUrl, 'an ONLINE subscribe must mint a hosted checkout URL').toBeTruthy();
	await page.goto(checkoutUrl as string);
	await completeStripeCheckout(page);

	// Activation arrives via the webhook, never the redirect. Each pass is a
	// fresh navigation so the account queries refetch rather than serve cache.
	await reloadUntil(
		page,
		async (card) => {
			await expect(card).toBeVisible({ timeout: 15_000 });
			await expect(card.getByLabel('Active')).toBeVisible({ timeout: 10_000 });
			await expect(card.getByText(plan.name)).toBeVisible({ timeout: 5_000 });
		},
		150_000
	);
}

/** Open ChangePlanDialog from the card and switch to `target`. */
async function switchPlan(
	page: Page,
	current: { name: string },
	target: { name: string },
	explainer: RegExp
): Promise<void> {
	await orgCard(page).getByRole('button', { name: 'Change plan' }).click();
	const dialog = page.getByRole('dialog', { name: 'Change plan' });
	await expect(dialog).toBeVisible({ timeout: 15_000 });
	await expect(dialog.getByText(`Your ${ORG_NAME} membership`)).toBeVisible();
	await expect(dialog.getByText(`Current plan: ${current.name}`)).toBeVisible();

	// The catalogue is org-wide (other workers' plans are in this list too), so
	// the option is addressed by its unique name. The radio's accessible name
	// comes from its wrapping <label>: "<plan name> <price>".
	await dialog.getByRole('radio', { name: target.name }).check();
	// Direction explainer lives in a shared pre-mounted live region — it only
	// appears once a radio is picked, and it is the member's only warning about
	// WHEN the switch happens.
	await expect(dialog.getByText(explainer)).toBeVisible();

	await dialog.getByRole('button', { name: 'Switch plan' }).click();
	await expect(dialog).toBeHidden({ timeout: 30_000 });
}

test.describe('J23 manage subscription @p2', () => {
	test('downgrade queues at renewal, then cancel-at-period-end dates the card', async ({
		browser
	}) => {
		// One hosted checkout plus two Stripe round trips on top.
		test.setTimeout(300_000);

		const { user, orgId, standard, lite } = await arrangeTwoPlans('SubDowngrade');

		const context = await browser.newContext();
		await authenticateContext(context, user);
		const page = await context.newPage();

		await subscribeAndPay(page, user, orgId, standard);
		const card = orgCard(page);
		await expect(card.getByText('€15.00 / month')).toBeVisible();
		await expect(card.getByText(new RegExp(`^Next renewal: .*(${MONTH})`))).toBeVisible();

		// --- Downgrade: scheduled, not immediate -------------------------------
		await switchPlan(page, standard, lite, /Takes effect at your next renewal/);

		// The queued switch is the whole point of a downgrade: the card must say
		// so, naming the target plan and the date it lands on.
		await reloadUntil(page, async (settled) => {
			await expect(
				settled.getByText(new RegExp(`^Switching to ${escapeRe(lite.name)} on .*(${MONTH})`))
			).toBeVisible({ timeout: 10_000 });
		});
		// …while the paid plan keeps billing until then.
		await expect(card.getByText(standard.name)).toBeVisible();
		await expect(card.getByLabel('Active')).toBeVisible();
		// A second change would only 400 while one is pending (getMemberActions).
		await expect(card.getByRole('button', { name: 'Change plan' })).toBeHidden();

		// --- Cancel at period end ----------------------------------------------
		await card.getByRole('button', { name: 'Cancel membership' }).click();
		const cancelDialog = page.getByRole('dialog', { name: 'Cancel membership' });
		await expect(cancelDialog).toBeVisible({ timeout: 15_000 });
		await expect(cancelDialog.getByText(`${standard.name} · ${ORG_NAME}`)).toBeVisible();

		// Period-end is the default: no acknowledgement, no destructive surprise.
		await expect(
			cancelDialog.getByRole('radio', { name: 'At the end of the current period' })
		).toBeChecked();
		await expect(
			cancelDialog.getByText(new RegExp(`You keep access until .*(${MONTH})`))
		).toBeVisible();
		const confirm = cancelDialog.getByRole('button', { name: 'Cancel membership' });
		await expect(confirm).toBeEnabled();
		await confirm.click();
		await expect(cancelDialog).toBeHidden({ timeout: 30_000 });

		// Still a member until the period closes — the date line flips from
		// "Next renewal" to "Cancels on", and every action but billing is gone.
		await reloadUntil(page, async (settled) => {
			await expect(settled.getByText(new RegExp(`^Cancels on .*(${MONTH})`))).toBeVisible({
				timeout: 10_000
			});
		});
		await expect(
			card.getByText('Renewal is off. To keep your membership, contact the organization.')
		).toBeVisible();
		await expect(card.getByLabel('Active')).toBeVisible();
		await expect(card.getByRole('button', { name: 'Cancel membership' })).toBeHidden();
		await expect(card.getByRole('button', { name: 'Change plan' })).toBeHidden();
		await expect(card.getByRole('button', { name: 'Manage billing' })).toBeVisible();

		await context.close();
	});

	test('upgrade applies immediately, then an immediate cancel strips the subscription', async ({
		browser
	}) => {
		test.setTimeout(300_000);

		const { user, orgId, standard, lite } = await arrangeTwoPlans('SubUpgrade');

		const context = await browser.newContext();
		await authenticateContext(context, user);
		const page = await context.newPage();

		await subscribeAndPay(page, user, orgId, lite);
		const card = orgCard(page);
		await expect(card.getByText('€10.00 / month')).toBeVisible();

		// --- Upgrade: prorated and immediate -----------------------------------
		await switchPlan(
			page,
			lite,
			standard,
			/You'll be charged the difference now \(prorated\) and switch immediately\./
		);

		// Immediate means the card names the new plan without waiting for a
		// renewal — and never grows a pending-switch line.
		await reloadUntil(page, async (settled) => {
			await expect(settled.getByText(standard.name)).toBeVisible({ timeout: 10_000 });
			await expect(settled.getByText('€15.00 / month')).toBeVisible({ timeout: 5_000 });
		});
		await expect(card.getByText(/^Switching to /)).toBeHidden();
		await expect(card.getByLabel('Active')).toBeVisible();

		// --- Immediate cancel ---------------------------------------------------
		await card.getByRole('button', { name: 'Cancel membership' }).click();
		const cancelDialog = page.getByRole('dialog', { name: 'Cancel membership' });
		await expect(cancelDialog).toBeVisible({ timeout: 15_000 });
		await cancelDialog.getByRole('radio', { name: 'Immediately' }).check();
		await expect(cancelDialog.getByText('Your membership ends right away.')).toBeVisible();

		// The acknowledgement gates the destructive button — it is the only
		// thing standing between a click and irreversible loss of access.
		const confirm = cancelDialog.getByRole('button', { name: 'Cancel membership' });
		await expect(confirm).toBeDisabled();
		await cancelDialog
			.getByRole('checkbox', { name: 'I understand my membership ends immediately.' })
			.click();
		await expect(confirm).toBeEnabled();
		await confirm.click();
		await expect(cancelDialog).toBeHidden({ timeout: 30_000 });

		// PROBED: the OrganizationMember row survives an immediate cancel (the
		// backend's subscription signal maps CANCELLED → member CANCELLED rather
		// than deleting the row), and `list_my_memberships` inlines only
		// NON-terminal subscriptions. So the card stays but is stripped bare: no
		// plan, no price, no date line, no management actions — the discriminator
		// against the at-period-end mode, which keeps all of them plus a date.
		await reloadUntil(page, async (settled) => {
			await expect(settled).toBeVisible({ timeout: 10_000 });
			await expect(settled.getByText(standard.name)).toBeHidden({ timeout: 5_000 });
		});
		await expect(card.getByText('cancelled', { exact: true })).toBeVisible();
		await expect(card.getByText(new RegExp(`Member since .*(${MONTH})`))).toBeVisible();
		await expect(card.getByRole('button', { name: 'Manage billing' })).toBeHidden();
		await expect(card.getByRole('button', { name: 'Change plan' })).toBeHidden();
		await expect(card.getByRole('button', { name: 'Cancel membership' })).toBeHidden();

		// The org page tells the same story: the member row is still there, so
		// the CTA slot renders the cancelled member badge (NOT a fresh Join
		// button — the server load reports `isMember` from the permissions
		// memberships dict, which keeps cancelled rows).
		await gotoHydrated(page, ORG_PATH);
		await waitForClientAuth(page);
		await expect(page.getByLabel('Membership status: Cancelled')).toBeVisible({ timeout: 20_000 });

		await context.close();
	});

	test('Manage billing mints a Stripe portal session and hands the browser over', async ({
		browser
	}) => {
		test.setTimeout(300_000);

		const { user, orgId, standard } = await arrangeTwoPlans('SubPortal');

		const context = await browser.newContext();
		await authenticateContext(context, user);
		const page = await context.newPage();

		await subscribeAndPay(page, user, orgId, standard);

		// Network-layer: the portal lives on another origin, so the contract the
		// app owns is "POST returns 201 with a Stripe URL, then the browser
		// leaves". Asserted on the response, not on Stripe's page.
		//
		// The body is captured through a route handler rather than
		// `waitForResponse(...).json()`: onSuccess assigns `window.location.href`
		// the instant the promise resolves, and the document navigation tears down
		// the network resource before Playwright can read its body ("No resource
		// with given identifier found" — observed every run).
		let portal: { status: number; body: string } | null = null;
		await page.route(/\/billing-portal(\?|$)/, async (route) => {
			const fetched = await route.fetch();
			portal = { status: fetched.status(), body: await fetched.text() };
			await route.fulfill({ response: fetched });
		});

		await orgCard(page).getByRole('button', { name: 'Manage billing' }).click();

		// onSuccess assigns window.location.href — a real document navigation.
		await page.waitForURL(/billing\.stripe\.com/, { timeout: 30_000 });

		expect(portal, 'the Manage billing click must POST /billing-portal').not.toBeNull();
		const captured = portal as unknown as { status: number; body: string };
		expect(captured.status).toBe(201);
		expect((JSON.parse(captured.body) as { url?: string }).url).toMatch(
			/^https:\/\/billing\.stripe\.com\//
		);

		await context.close();
	});
});
