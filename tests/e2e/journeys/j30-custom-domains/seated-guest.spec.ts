import type { Browser, Page } from '@playwright/test';
import { test, expect } from '../../support/fixtures';
import { gotoHydrated } from '../../support/navigation';
import { uniqueEmail } from '../../support/factories';
import { extractLink, waitForEmail } from '../../support/mailpit';
import { requireStripeWebhooks } from '../../support/stripe';
import {
	PAID_HOST,
	PAID_ORG_SLUG,
	PAID_ORIGIN,
	TENANT_HOST,
	TENANT_ORG_SLUG,
	TENANT_ORIGIN,
	tenantContext,
	tenantUnavailableReason
} from '../../support/tenant';

// Custom domains (#1072) — ANONYMOUS seated checkout on a tenant host. The
// guest-hold session used to be a SameSite=Lax cookie on the API host, which a
// custom domain never stores (cross-site). The backend (#1180) now returns it as
// `guest_hold_token` and accepts it back as `X-Guest-Hold`, so the whole
// hold → checkout path must work with NO API cookie. Backend DEBUG seeds (#1181):
//   tenant.localhost : `tenant-seated-event`      tier "Seated Free"     (FREE)
//   paid.localhost   : `tenant-paid-seated-event` tier "Seated Standard" (ONLINE, 10 EUR)
// Seat map: sector "Main Floor", rows A/B/C x seats 1-6 (18 seats per event).
// Each run consumes one seat of the free event, so the seat is chosen at runtime
// (first one not held/sold) rather than by a fixed label.

const SEATED_FREE_PATH = `/events/${TENANT_ORG_SLUG}/tenant-seated-event`;
const SEATED_PAID_PATH = `/events/${PAID_ORG_SLUG}/tenant-paid-seated-event`;

/** Cookies the API host would set for a guest-hold session. */
const GUEST_HOLD_COOKIE = /guest_hold/i;

/**
 * Open the seat picker and hold the first seat that is free right now.
 * Returns the picked seat's accessible name. Only clicks while not pressed (a
 * second tap would release the hold).
 */
async function holdFirstFreeSeat(page: Page): Promise<string> {
	const picker = page.getByTestId('seat-picker-dialog');
	await expect(async () => {
		if (await picker.isVisible()) return;
		await page.getByRole('button', { name: 'Pick seats…', exact: true }).first().click();
		await expect(picker).toBeVisible({ timeout: 8_000 });
	}).toPass({ timeout: 60_000 });

	// A free seat's accessible name is exactly "Seat B2"; held or taken seats
	// carry a suffix (", held by someone else"), and the picker has other
	// toggle buttons, so match seats by exact name rather than by state.
	await expect(picker.getByRole('button', { name: /^Seat [ABC][1-6](,|$)/ }).first()).toBeVisible({
		timeout: 15_000
	});
	let name = '';
	for (const row of ['A', 'B', 'C']) {
		for (let n = 1; n <= 6 && !name; n++) {
			const candidate = picker.getByRole('button', { name: `Seat ${row}${n}`, exact: true });
			if (
				(await candidate.count()) === 1 &&
				(await candidate.isEnabled()) &&
				(await candidate.getAttribute('aria-pressed')) !== 'true'
			) {
				name = `Seat ${row}${n}`;
			}
		}
		if (name) break;
	}
	expect(name, 'a free seat on the seeded map').not.toBe('');

	const seat = picker.getByRole('button', { name, exact: true });
	await expect(async () => {
		if ((await seat.getAttribute('aria-pressed')) !== 'true') await seat.click();
		await expect(seat).toHaveAttribute('aria-pressed', 'true', { timeout: 5_000 });
		await expect(picker.getByText('Selected seats are held for you for 10 minutes.')).toBeVisible();
	}).toPass({ timeout: 60_000 });
	return name;
}

async function anonymousPage(browser: Browser, origin: string): Promise<Page> {
	return (await tenantContext(browser, origin)).newPage();
}

test.describe('J30 seated guest checkout on a tenant host @p1', () => {
	test.skip(({ browserName }) => browserName !== 'chromium', 'tenant hosts need Chromium');

	test('guest holds a seat, survives a reload, checks out and confirms by email', async ({
		browser
	}, testInfo) => {
		test.setTimeout(240_000);
		const unavailable = await tenantUnavailableReason(TENANT_HOST, { needsTenantMode: true });
		testInfo.skip(unavailable !== null, unavailable ?? '');

		const page = await anonymousPage(browser, TENANT_ORIGIN);
		const missing = await page.goto(SEATED_FREE_PATH).then((r) => r?.status() === 404);
		testInfo.skip(missing, 'seated tenant event not seeded (backend #1181)');
		await gotoHydrated(page, SEATED_FREE_PATH);
		expect(new URL(page.url()).host).toBe(new URL(TENANT_ORIGIN).host);

		const seatName = await holdFirstFreeSeat(page);
		const picker = page.getByTestId('seat-picker-dialog');

		// Cross-check: no guest-hold cookie exists for any host, yet the hold works
		// (it is carried by X-Guest-Hold alone).
		const cookies = await page.context().cookies();
		expect(cookies.filter((c) => GUEST_HOLD_COOKIE.test(c.name))).toEqual([]);

		// Survives a reload: the picker re-seeds `my_holds` from availability,
		// which only recognises the hold through the header-based session.
		await page.reload();
		await gotoHydrated(page, SEATED_FREE_PATH);
		await page.getByRole('button', { name: 'Pick seats…', exact: true }).first().click();
		await expect(picker).toBeVisible({ timeout: 15_000 });
		await expect(picker.getByRole('button', { name: seatName, exact: true })).toHaveAttribute(
			'aria-pressed',
			'true',
			{ timeout: 15_000 }
		);

		await picker.getByRole('button', { name: 'Done', exact: true }).click();
		await expect(picker).toBeHidden();

		const summaryBar = page.getByTestId('cart-summary-bar');
		await expect(summaryBar).toBeVisible({ timeout: 15_000 });
		await summaryBar.getByRole('button', { name: /^(Buy|Claim)$/ }).click();

		const email = uniqueEmail('TenantSeatedGuest');
		const sheet = page.getByRole('dialog', { name: 'Checkout' });
		await expect(sheet).toBeVisible();
		const confirmDialog = page.getByRole('dialog', { name: 'Check your email!' });
		await expect(async () => {
			if (await confirmDialog.isVisible()) return;
			await sheet.getByLabel('Email address').fill(email);
			await sheet.getByLabel('First name').fill('E2E');
			await sheet.getByLabel('Last name').fill('TenantGuest');
			await sheet.getByLabel('Name for ticket 1').fill('E2E Tenant Guest');
			await sheet.getByRole('button', { name: 'Claim', exact: true }).click();
			await expect(confirmDialog).toBeVisible({ timeout: 10_000 });
		}).toPass({ timeout: 60_000 });

		const message = await waitForEmail({ to: email, subject: 'Confirm your ticket for' });
		const link = extractLink(message, /confirm-action\?token=/);

		await page.goto(link);
		await expect(async () => {
			const retry = page.getByRole('button', { name: 'Try Again' });
			if (await retry.isVisible()) await retry.click();
			await expect(page.getByRole('heading', { name: 'Ticket Confirmed!' })).toBeVisible({
				timeout: 10_000
			});
		}).toPass({ timeout: 45_000 });
		await expect(page.getByText('1 ticket confirmed')).toBeVisible();

		await page.context().close();
	});

	test('guest holds a seat and a paid tenant checkout reaches Stripe', async ({
		browser
	}, testInfo) => {
		test.setTimeout(180_000);
		requireStripeWebhooks();
		const unavailable = await tenantUnavailableReason(PAID_HOST, { needsTenantMode: true });
		testInfo.skip(unavailable !== null, unavailable ?? '');

		const page = await anonymousPage(browser, PAID_ORIGIN);
		const missing = await page.goto(SEATED_PAID_PATH).then((r) => r?.status() === 404);
		testInfo.skip(missing, 'paid seated tenant event not seeded (backend #1181)');
		await gotoHydrated(page, SEATED_PAID_PATH);

		await holdFirstFreeSeat(page);
		const picker = page.getByTestId('seat-picker-dialog');
		await picker.getByRole('button', { name: 'Done', exact: true }).click();
		await expect(picker).toBeHidden();

		const summaryBar = page.getByTestId('cart-summary-bar');
		await expect(summaryBar).toBeVisible({ timeout: 15_000 });
		await summaryBar.getByRole('button', { name: /^(Buy|Claim)$/ }).click();

		const email = uniqueEmail('TenantPaidSeatedGuest');
		const sheet = page.getByRole('dialog', { name: 'Checkout' });
		await expect(sheet).toBeVisible();
		await expect(async () => {
			if (page.url().includes('checkout.stripe.com')) return;
			await sheet.getByLabel('Email address').fill(email);
			await sheet.getByLabel('First name').fill('E2E');
			await sheet.getByLabel('Last name').fill('TenantGuest');
			await sheet.getByLabel('Name for ticket 1').fill('E2E Tenant Guest');
			await sheet.getByRole('button', { name: 'Pay Now', exact: true }).click();
			await page.waitForURL(/checkout\.stripe\.com/, { timeout: 15_000 });
		}).toPass({ timeout: 90_000 });
		await expect(page).toHaveURL(/^https:\/\/checkout\.stripe\.com\//);

		await page.context().close();
	});
});
