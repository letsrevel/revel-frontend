import { test, expect, type Page } from '../../support/fixtures';
import { NOTICE_TEXT, fixtureEvent, openTicketing } from './helpers';

// J29.7 (USER_JOURNEYS.md) — non-blocking organizer notices in the tier
// editor, read from `event.compliance.notices` and placed by `applies_to`:
// `offline_payment` next to the payment-method selector, `ticket_sales` next
// to the tier sales settings. Notices never disable anything. Read-only.

function tierForm(page: Page) {
	return page.getByRole('dialog', { name: /Create Ticket Tier|Edit Ticket Tier/ });
}

async function openNewTierForm(page: Page): Promise<void> {
	await page.getByRole('button', { name: 'Add Another Tier' }).click();
	await expect(tierForm(page)).toBeVisible();
}

async function expectNothingDisabled(page: Page): Promise<void> {
	const select = tierForm(page).getByLabel(/Payment Method/);
	await expect(select).toBeEnabled();
	for (const method of ['free', 'offline', 'at_the_door', 'online']) {
		await expect(select.locator(`option[value="${method}"]`)).toBeEnabled();
	}
}

const OFFLINE_CASES = [
	{ org: 'compliance-at', event: 'at-gig-vienna', key: 'at_registrierkasse' },
	// A non-Austrian venue doesn't drop it: the org is established in Austria.
	{ org: 'compliance-at', event: 'at-gig-in-italy', key: 'at_registrierkasse' },
	{ org: 'compliance-dk', event: 'dk-disco-night', key: 'dk_sales_registration' }
] as const;

test.describe('J29.7 organizer notices @p2', () => {
	for (const c of OFFLINE_CASES) {
		test(`${c.event}: ${c.key} sits next to the payment selector`, async ({
			asCompliance: page
		}) => {
			const event = await fixtureEvent(c.org, c.event);
			await openTicketing(page, event);
			await openNewTierForm(page);

			const notice = tierForm(page).getByTestId(`compliance-notice-${c.key}`);
			await expect(notice).toHaveAttribute('role', 'status');
			await expect(notice).toHaveText(NOTICE_TEXT[c.key]);
			await page.keyboard.press('Escape');
		});
	}

	test('pl-dance-night: the kasa fiskalna notice sits with the tier sales settings', async ({
		asCompliance: page
	}) => {
		const event = await fixtureEvent('compliance-pl', 'pl-dance-night');
		await openTicketing(page, event);

		// On the Tickets view, above the tiers…
		const listNotice = page.getByTestId('compliance-notice-pl_kasa_fiskalna');
		await expect(listNotice).toHaveText(NOTICE_TEXT.pl_kasa_fiskalna);
		await expect(listNotice).toHaveAttribute('role', 'status');

		// …and in the tier editor, by price and payment method, with every
		// payment method still selectable.
		await page.getByRole('button', { name: 'Edit Card' }).click();
		await expect(tierForm(page)).toBeVisible();
		await expect(tierForm(page).getByTestId('compliance-notice-pl_kasa_fiskalna')).toHaveText(
			NOTICE_TEXT.pl_kasa_fiskalna
		);
		await expectNothingDisabled(page);
		await page.keyboard.press('Escape');
	});
});
