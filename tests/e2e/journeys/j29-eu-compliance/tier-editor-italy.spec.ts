import { test, expect, type Page } from '../../support/fixtures';
import { ApiError } from '../../support/api';
import { createTicketedEvent } from '../../support/factories';
import {
	ITALY_ONLINE_DETAIL,
	complianceApi,
	fixtureEvent,
	fixtureTiers,
	openTicketing
} from './helpers';

// J29.3 (USER_JOURNEYS.md) — the tier editor reads `event.compliance`, not the
// org's: online card payment is disabled up front for events held in Italy
// (whoever organizes them) and stays available for an Italian org's virtual
// event. Fixture tiers are only read or hit with writes the backend refuses;
// the tier this spec actually creates lives on an event it creates itself.

function tierForm(page: Page) {
	return page.getByRole('dialog', { name: /Create Ticket Tier|Edit Ticket Tier/ });
}

async function expectOnlineBlocked(page: Page): Promise<void> {
	const form = tierForm(page);
	const select = form.getByLabel(/Payment Method/);
	await expect(select.locator('option[value="online"]')).toBeDisabled();
	for (const method of ['free', 'offline', 'at_the_door']) {
		await expect(select.locator(`option[value="${method}"]`)).toBeEnabled();
	}
	const notice = form.getByTestId('tier-online-blocked');
	await expect(notice).toContainText("Online card payments aren't available for events in Italy.");
	// The disabled option's reason is wired to the selector.
	await expect(select).toHaveAccessibleDescription(/Online card payments aren't available/);
}

test.describe('J29.3 tier editor in Italy @p2', () => {
	test('it-club-night: legacy card tier banner opens the editor with card disabled', async ({
		asCompliance: page
	}) => {
		const event = await fixtureEvent('compliance-it', 'it-club-night');
		await openTicketing(page, event);

		const banner = page.getByTestId('tier-online-blocked-banner').filter({
			has: page.getByRole('button', { name: 'Change payment method for Card (legacy)' })
		});
		await expect(banner).toContainText(
			"This tier uses online card payment, which isn't available for events in Italy."
		);
		// Offline tiers carry no banner: only the two online fixtures do.
		await expect(page.getByTestId('tier-online-blocked-banner')).toHaveCount(2);

		await banner.getByRole('button', { name: 'Change payment method for Card (legacy)' }).click();
		await expect(tierForm(page)).toBeVisible();
		await expectOnlineBlocked(page);
		await page.keyboard.press('Escape');
		await expect(tierForm(page)).not.toBeVisible();
	});

	test('it-club-night: resuming the paused card tier is refused inline', async ({
		asCompliance: page
	}) => {
		const event = await fixtureEvent('compliance-it', 'it-club-night');
		await openTicketing(page, event);

		await page.getByRole('button', { name: 'Resume sales for Card (paused)' }).click();
		const refusal = page.getByTestId('tier-pause-error');
		await expect(refusal).toHaveAttribute('role', 'alert');
		await expect(refusal).toHaveText(ITALY_ONLINE_DETAIL, { timeout: 15_000 });

		// Refused server-side: the fixture is still paused (nothing to restore).
		const tiers = await fixtureTiers(event.id);
		expect(tiers.get('Card (paused)')?.sales_paused).toBe(true);
	});

	test('a new event in Italy: card is disabled, at-the-door tiers save', async ({
		asCompliance: page
	}) => {
		const event = await createTicketedEvent({
			owner: 'compliance',
			orgSlug: 'compliance-it',
			freeTier: false
		});

		// The API refuses an online tier outright, with the translated reason.
		const api = await complianceApi();
		const refused = await api
			.post(`/api/event-admin/${event.id}/ticket-tier`, {
				name: 'Card',
				price: '10.00',
				payment_method: 'online'
			})
			.then(() => null)
			.catch((err: unknown) => err);
		expect(refused).toBeInstanceOf(ApiError);
		expect((refused as ApiError).status).toBe(422);
		expect(JSON.parse((refused as ApiError).body).detail).toBe(ITALY_ONLINE_DETAIL);

		await openTicketing(page, { ...event, orgSlug: 'compliance-it' });
		await page.getByRole('button', { name: 'Add Another Tier' }).click();
		await expect(tierForm(page)).toBeVisible();
		await expectOnlineBlocked(page);

		await tierForm(page).getByLabel('Tier Name').fill('Door (Italy)');
		await tierForm(page)
			.getByLabel(/Payment Method/)
			.selectOption('at_the_door');
		await tierForm(page).getByRole('button', { name: 'Create Tier' }).click();
		await expect(tierForm(page)).not.toBeVisible({ timeout: 15_000 });
		await expect(page.getByText('Door (Italy)').first()).toBeVisible();
	});

	test("an Austrian org's event held in Italy follows Italy's rule", async ({
		asCompliance: page
	}) => {
		// The org itself allows card payments; the event's venue country decides.
		const api = await complianceApi();
		const org = await api.get<{ compliance: { online_payment: string } }>(
			'/api/organization-admin/compliance-at'
		);
		expect(org.compliance.online_payment).toBe('allowed');

		const event = await fixtureEvent('compliance-at', 'at-gig-in-italy');
		await openTicketing(page, event);
		await page.getByRole('button', { name: 'Add Another Tier' }).click();
		await expect(tierForm(page)).toBeVisible();
		await expectOnlineBlocked(page);
		await page.keyboard.press('Escape');
	});

	test("an Italian org's virtual event keeps card payments", async ({ asCompliance: page }) => {
		const event = await fixtureEvent('compliance-it', 'it-online-talk');
		await openTicketing(page, event);
		await expect(page.getByTestId('tier-online-blocked-banner')).toHaveCount(0);

		await page.getByRole('button', { name: 'Add Another Tier' }).click();
		const form = tierForm(page);
		await expect(form).toBeVisible();
		await expect(form.getByLabel(/Payment Method/).locator('option[value="online"]')).toBeEnabled();
		await expect(form.getByTestId('tier-online-blocked')).toHaveCount(0);
		await page.keyboard.press('Escape');
	});
});
