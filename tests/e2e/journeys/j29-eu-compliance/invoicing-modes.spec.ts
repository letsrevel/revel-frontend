import { test, expect } from '../../support/fixtures';
import { ApiError } from '../../support/api';
import { complianceApi, fixtureEvent, openBilling, openTicketing } from './helpers';

// J29.2 (USER_JOURNEYS.md) — attendee invoicing modes under country rules, on
// the seeded compliance-* orgs. Read-only: the only writes force `auto` where
// the backend refuses it (422); each one still resets to `none` afterwards, so
// a regression that accepted it can't leak into other specs.

const HR_DETAIL =
	"Revel can't issue invoices to your attendees in Croatia. The law there requires invoices to go through the Tax Administration's fiscalization system, and Revel isn't connected to it yet. Please issue invoices from your own invoicing software.";

const ES_PV_DETAIL =
	"Revel can't issue invoices to your attendees in the Basque Country. The law there requires invoices to go through TicketBAI (Batuz in Bizkaia), and Revel isn't connected to it. Please issue invoices from your own TicketBAI-compliant invoicing software.";

const ES_NC_DETAIL =
	"Revel doesn't issue invoices to attendees for organizers in Spain, Navarre included. Navarre is bringing in its own invoicing-software rules (NaTicket), and Revel isn't connected to them. Please issue invoices from your own invoicing software.";

const ES_NC_UPCOMING_NOTICE =
	"From 1 January 2027, Revel stops issuing attendee invoices for organizers in Spain, Navarre included. Navarre is bringing in its own invoicing-software rules (NaTicket), and Revel won't be connected to them. If you use attendee invoicing, set up your own invoicing software before then.";

/** Forcing `auto` is refused with `detail`; resets to `none` either way. */
async function expectRefused(
	api: Awaited<ReturnType<typeof complianceApi>>,
	org: string,
	detail: string
): Promise<void> {
	try {
		const refused = await api
			.patch(`/api/organization-admin/${org}/invoicing`, { mode: 'auto' })
			.then(() => null)
			.catch((err: unknown) => err);
		expect(refused).toBeInstanceOf(ApiError);
		expect((refused as ApiError).status).toBe(422);
		expect(JSON.parse((refused as ApiError).body).detail).toBe(detail);
	} finally {
		await api.patch(`/api/organization-admin/${org}/invoicing`, { mode: 'none' });
	}
}

const HR_FISCAL_NOTICE =
	"Revel can't issue your attendee invoices. In Croatia, invoices to consumers must be fiscalized in real time with the Tax Administration (Porezna uprava).";

test.describe('J29.2 attendee invoicing modes @p2', () => {
	test('Croatia: Manual Review and Automatic are disabled and explained', async ({
		asCompliance: page
	}) => {
		await openBilling(page, 'compliance-hr');

		const notice = page.getByTestId('invoicing-compliance-notice');
		await expect(notice).toHaveText(HR_DETAIL);
		await expect(notice).toHaveAttribute('role', 'status');

		// The migration switched blocked orgs to NONE; it renders selected.
		await expect(page.getByRole('radio', { name: 'Disabled' })).toBeChecked();
		await expect(page.getByRole('radio', { name: 'Disabled' })).toBeEnabled();
		for (const label of ['Manual Review', 'Automatic']) {
			const radio = page.getByRole('radio', { name: label });
			await expect(radio).toBeDisabled();
			// Every disabled control names its reason (WCAG 1.3.1 / 3.3.2).
			await expect(radio).toHaveAccessibleDescription(HR_DETAIL);
		}
	});

	test('Croatia: the fiscalization notice sits next to the modes (#1007)', async ({
		asCompliance: page
	}) => {
		await openBilling(page, 'compliance-hr');
		const notice = page.getByTestId('compliance-notice-hr_fiscalization');
		// Once on the page: next to the selector, not repeated in the country card.
		await expect(notice).toHaveCount(1);
		await expect(notice).toHaveAttribute('role', 'status');
		await expect(notice).toContainText(HR_FISCAL_NOTICE);
		const section = page
			.locator('section')
			.filter({ has: page.getByRole('radio', { name: 'Disabled' }) });
		await expect(section.getByTestId('compliance-notice-hr_fiscalization')).toBeVisible();
		// A notice never disables anything; the block already does (J29.2).
		await expect(page.getByRole('radio', { name: 'Disabled' })).toBeEnabled();
		await expect(page.getByRole('radio', { name: 'Automatic' })).toBeDisabled();
	});

	test("Croatia: the event's tier editor carries the same notice", async ({
		asCompliance: page
	}) => {
		const event = await fixtureEvent('compliance-hr', 'hr-concert');
		await openTicketing(page, event);
		await expect(page.getByTestId('compliance-notice-hr_fiscalization')).toContainText(
			HR_FISCAL_NOTICE
		);
	});

	test('Croatia: forcing auto through the API is refused with the same text', async () => {
		const api = await complianceApi();
		const refused = await api
			.patch('/api/organization-admin/compliance-hr/invoicing', { mode: 'auto' })
			.then(() => null)
			.catch((err: unknown) => err);
		expect(refused).toBeInstanceOf(ApiError);
		expect((refused as ApiError).status).toBe(422);
		expect(JSON.parse((refused as ApiError).body).detail).toBe(HR_DETAIL);
		// `none` always succeeds (and is already the stored value).
		await api.patch('/api/organization-admin/compliance-hr/invoicing', { mode: 'none' });
	});

	test('Belgium: modes stay enabled with the Peppol notice', async ({ asCompliance: page }) => {
		await openBilling(page, 'compliance-be');
		await expect(page.getByTestId('invoicing-compliance-notice')).toHaveText(
			"Invoices to customers with a Belgium VAT ID must be sent as e-invoices through Peppol. Revel won't create those. Issue them from your e-invoicing software. Invoices to everyone else work as usual."
		);
		await expect(page.getByRole('radio', { name: 'Manual Review' })).toBeEnabled();
		await expect(page.getByRole('radio', { name: 'Automatic' })).toBeEnabled();
	});

	test('Poland: modes stay enabled with the KSeF notice', async ({ asCompliance: page }) => {
		await openBilling(page, 'compliance-pl');
		await expect(page.getByTestId('invoicing-compliance-notice')).toHaveText(
			"Invoices to business customers must be issued through KSeF. Revel won't create those. Issue them from your e-invoicing software. Invoices to consumers work as usual."
		);
		await expect(page.getByRole('radio', { name: 'Manual Review' })).toBeEnabled();
		await expect(page.getByRole('radio', { name: 'Automatic' })).toBeEnabled();
	});

	test('Spain: the Verifactu warning before 2027, the block after', async ({
		asCompliance: page
	}) => {
		// The flip happens on the server clock (2027-01-01), so the expected state
		// is read from the API rather than hard-coded: this spec stays valid on
		// both sides of the date.
		const api = await complianceApi();
		const org = await api.get<{ compliance: { attendee_invoicing: string } }>(
			'/api/organization-admin/compliance-es'
		);
		await openBilling(page, 'compliance-es');
		const banner = page.getByTestId('invoicing-compliance-notice');
		if (org.compliance.attendee_invoicing === 'allowed') {
			// The heads-up is the API's es_verifactu notice (#1087), shown once,
			// next to the modes; the client's own copy stays out of the way.
			const notice = page.getByTestId('compliance-notice-es_verifactu');
			await expect(notice).toHaveCount(1);
			await expect(notice).toHaveAttribute('role', 'status');
			await expect(notice).toHaveAttribute('data-tone', 'warning');
			await expect(banner).toHaveCount(0);
			await expect(page.getByRole('radio', { name: 'Manual Review' })).toBeEnabled();
			await expect(page.getByRole('radio', { name: 'Automatic' })).toBeEnabled();
		} else {
			await expect(banner).toContainText('Verifactu');
			await expect(banner).toHaveAttribute('data-tone', 'blocked');
			await expect(page.getByRole('radio', { name: 'Manual Review' })).toBeDisabled();
			await expect(page.getByRole('radio', { name: 'Automatic' })).toBeDisabled();
		}
	});

	test('Basque Country: blocked now under TicketBAI, with no Verifactu heads-up (#1010)', async ({
		asCompliance: page
	}) => {
		await openBilling(page, 'compliance-es-pv');
		const banner = page.getByTestId('invoicing-compliance-notice');
		await expect(banner).toHaveText(ES_PV_DETAIL);
		await expect(banner).toHaveAttribute('data-tone', 'blocked');
		await expect(banner).not.toContainText('Verifactu');
		await expect(page.getByTestId('compliance-notice-es_verifactu')).toHaveCount(0);
		for (const label of ['Manual Review', 'Automatic']) {
			const radio = page.getByRole('radio', { name: label });
			await expect(radio).toBeDisabled();
			await expect(radio).toHaveAccessibleDescription(ES_PV_DETAIL);
		}

		// The backend refuses a forced mode with the same TicketBAI copy.
		const api = await complianceApi();
		await expectRefused(api, 'compliance-es-pv', ES_PV_DETAIL);
	});

	test('Navarre: NaTicket, never Verifactu, on whichever side of 2027 the server is (#1010)', async ({
		asCompliance: page
	}) => {
		// Read from the API like Spain: the flip is on the server clock.
		const api = await complianceApi();
		const org = await api.get<{ compliance: { attendee_invoicing: string; region: string } }>(
			'/api/organization-admin/compliance-es-nc'
		);
		expect(org.compliance.region).toBe('ES-NC');
		await openBilling(page, 'compliance-es-nc');
		const banner = page.getByTestId('invoicing-compliance-notice');
		const notice = page.getByTestId('compliance-notice-es_nc_naticket');
		await expect(page.getByTestId('compliance-notice-es_verifactu')).toHaveCount(0);
		await expect(page.getByText(/veri\*?factu/i)).toHaveCount(0);

		if (org.compliance.attendee_invoicing === 'allowed') {
			await expect(notice).toHaveCount(1);
			await expect(notice).toHaveAttribute('role', 'status');
			await expect(notice).toHaveAttribute('data-tone', 'warning');
			await expect(notice).toHaveText(ES_NC_UPCOMING_NOTICE);
			await expect(banner).toHaveCount(0);
			await expect(page.getByRole('radio', { name: 'Manual Review' })).toBeEnabled();
			await expect(page.getByRole('radio', { name: 'Automatic' })).toBeEnabled();
		} else {
			// Once the block is in force, the heads-up goes away.
			await expect(notice).toHaveCount(0);
			await expect(banner).toHaveText(ES_NC_DETAIL);
			await expect(banner).toHaveAttribute('data-tone', 'blocked');
			for (const label of ['Manual Review', 'Automatic']) {
				const radio = page.getByRole('radio', { name: label });
				await expect(radio).toBeDisabled();
				await expect(radio).toHaveAccessibleDescription(ES_NC_DETAIL);
			}
			await expectRefused(api, 'compliance-es-nc', ES_NC_DETAIL);
		}
	});

	test('an org with no invoicing rule shows no invoicing notice', async ({
		asCompliance: page
	}) => {
		await openBilling(page, 'compliance-at');
		await expect(page.getByTestId('country-rules-card')).toBeVisible();
		await expect(page.getByTestId('invoicing-compliance-notice')).toHaveCount(0);
	});
});
