import { test, expect } from '../../support/fixtures';
import { NOTICE_TEXT, complianceApi, openBilling } from './helpers';

// Spain's invoicing block starts on 2027-01-01 on the SERVER clock (Europe/
// Vienna, so an hour before UTC midnight): rows whose bullet depends on it read
// the org's current state from the API instead of the runner's clock.
async function invoicingBlocked(org: string): Promise<boolean> {
	const api = await complianceApi();
	const detail = await api.get<{ compliance: { attendee_invoicing: string } }>(
		`/api/organization-admin/${org}`
	);
	return detail.compliance.attendee_invoicing === 'blocked';
}

// J29.1 (USER_JOURNEYS.md) — the "Country rules" card in org settings →
// Billing, one row per seeded compliance-* org. Read-only.

interface CardCase {
	org: string;
	/** Text the card body must show. */
	body: RegExp;
	/** Fixed bullets, or chosen by whether the server says invoicing is blocked. */
	bullets: string[] | ((blocked: boolean) => string[]);
	/** Regional orgs (#1010): the card must never mention Verifactu. */
	noVerifactu?: boolean;
	notices: Array<keyof typeof NOTICE_TEXT>;
	docs: string;
}

const CASES: CardCase[] = [
	{
		org: 'compliance-it',
		body: /set up for Italy\. Some features work differently here/,
		bullets: [
			'Online card payments: not available for events in Italy. Payments at the door and by bank transfer work as usual.'
		],
		notices: [],
		docs: 'https://docs.letsrevel.io/compliance/eu/it/'
	},
	{
		org: 'compliance-hr',
		body: /set up for Croatia\. Some features work differently here/,
		bullets: ['Attendee invoices: not available in Croatia.'],
		notices: [],
		docs: 'https://docs.letsrevel.io/compliance/eu/hr/'
	},
	{
		org: 'compliance-be',
		body: /set up for Belgium\. Some features work differently here/,
		bullets: ['Invoices to Belgium businesses: issue them from your own e-invoicing software.'],
		notices: [],
		docs: 'https://docs.letsrevel.io/compliance/eu/be/'
	},
	{
		org: 'compliance-pl',
		body: /set up for Poland\. Some features work differently here/,
		bullets: ['Invoices to businesses: issue them from your own e-invoicing software.'],
		notices: ['pl_kasa_fiskalna'],
		docs: 'https://docs.letsrevel.io/compliance/eu/pl/'
	},
	{
		org: 'compliance-es',
		body: /set up for Spain\. Some features work differently here/,
		bullets: (blocked) => [
			blocked
				? 'Attendee invoices: not available in Spain.'
				: 'Attendee invoices: available until 31 December 2026.'
		],
		notices: [],
		docs: 'https://docs.letsrevel.io/compliance/eu/es/'
	},
	{
		// Basque Country (#1010): blocked now under TicketBAI, never "Spain".
		org: 'compliance-es-pv',
		body: /set up for Spain\. Some features work differently here/,
		bullets: ['Attendee invoices: not available in the Basque Country.'],
		noVerifactu: true,
		notices: [],
		docs: 'https://docs.letsrevel.io/compliance/eu/es/#basque-country-ticketbai'
	},
	{
		// Navarre (#1010): Spain's 2027 date, NaTicket copy, never Verifactu.
		// Its heads-up is an attendee_invoicing notice, shown by the modes, not here.
		org: 'compliance-es-nc',
		body: /set up for Spain\. Some features work differently here/,
		bullets: (blocked) => [
			blocked
				? 'Attendee invoices: not available in Navarre.'
				: 'Attendee invoices: available until 31 December 2026.'
		],
		noVerifactu: true,
		notices: [],
		docs: 'https://docs.letsrevel.io/compliance/eu/es/#navarre'
	},
	{
		org: 'compliance-at',
		body: /set up for Austria\. All Revel features are available\./,
		bullets: [],
		notices: ['at_registrierkasse'],
		docs: 'https://docs.letsrevel.io/compliance/eu/at/'
	},
	{
		org: 'compliance-dk',
		body: /set up for Denmark\. All Revel features are available\./,
		bullets: [],
		notices: ['dk_sales_registration'],
		docs: 'https://docs.letsrevel.io/compliance/eu/dk/'
	},
	{
		org: 'compliance-us',
		body: /only checks tax rules for EU countries/,
		bullets: [],
		notices: [],
		docs: 'https://docs.letsrevel.io/compliance/'
	},
	{
		org: 'compliance-unknown',
		body: /We don't know which country your organization is in yet/,
		bullets: [],
		notices: [],
		docs: 'https://docs.letsrevel.io/compliance/eu/'
	}
];

test.describe('J29.1 country rules card @p2', () => {
	for (const c of CASES) {
		test(`${c.org}`, async ({ asCompliance: page }) => {
			await openBilling(page, c.org);
			const card = page.getByTestId('country-rules-card');
			await expect(card.getByRole('heading', { name: 'Country rules' })).toBeVisible();
			await expect(card).toContainText(c.body);

			const bullets =
				typeof c.bullets === 'function' ? c.bullets(await invoicingBlocked(c.org)) : c.bullets;
			const items = card.getByRole('listitem');
			await expect(items).toHaveText(bullets);
			if (c.noVerifactu) await expect(card).not.toContainText(/veri\*?factu/i);

			for (const key of c.notices) {
				const notice = card.getByTestId(`compliance-notice-${key}`);
				await expect(notice).toHaveAttribute('role', 'status');
				await expect(notice).toHaveText(NOTICE_TEXT[key]);
			}
			await expect(card.locator('[data-testid^="compliance-notice-"]')).toHaveCount(
				c.notices.length
			);

			await expect(card.getByRole('link', { name: /Learn more/ })).toHaveAttribute('href', c.docs);
		});
	}
});
