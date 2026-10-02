import { describe, it, expect } from 'vitest';
import type { OrganizationComplianceSchema } from '$lib/api/generated/types.gen';
import {
	complianceDocsUrl,
	countryName,
	invoicingNotice,
	isReservationOnly,
	noticesFor,
	onlinePaymentBlockedText,
	restrictionBullets
} from './compliance';

function org(overrides: Partial<OrganizationComplianceSchema> = {}): OrganizationComplianceSchema {
	return {
		country: 'DE',
		attendee_invoicing: 'allowed',
		online_payment: 'allowed',
		offline_payment: 'allowed',
		notices: [],
		...overrides
	};
}

describe('countryName', () => {
	it('localizes the ISO code, never shows it raw', () => {
		expect(countryName('IT')).toBe('Italy');
		expect(countryName('GR')).toBe('Greece');
	});

	it('is empty for an unknown country', () => {
		expect(countryName('')).toBe('');
	});
});

describe('complianceDocsUrl', () => {
	it('links the per-country page for EU countries', () => {
		expect(complianceDocsUrl('IT')).toBe('https://docs.letsrevel.io/compliance/eu/it/');
	});

	it('falls back to the section index for non-EU and unknown countries', () => {
		expect(complianceDocsUrl('US')).toBe('https://docs.letsrevel.io/compliance/');
		expect(complianceDocsUrl('')).toBe('https://docs.letsrevel.io/compliance/eu/');
	});
});

describe('restrictionBullets', () => {
	it('is empty when nothing is restricted', () => {
		expect(restrictionBullets(org())).toEqual([]);
	});

	it('names the blocked invoicing country', () => {
		const bullets = restrictionBullets(org({ country: 'HR', attendee_invoicing: 'blocked' }));
		expect(bullets).toEqual(['Attendee invoices: not available in Croatia.']);
	});

	it('uses the Belgian wording for BE and the all-businesses wording for PL', () => {
		expect(
			restrictionBullets(org({ country: 'BE', attendee_invoicing: 'blocked_for_business_buyers' }))
		).toEqual(['Invoices to Belgium businesses: issue them from your own e-invoicing software.']);
		expect(
			restrictionBullets(org({ country: 'PL', attendee_invoicing: 'blocked_for_business_buyers' }))
		).toEqual(['Invoices to businesses: issue them from your own e-invoicing software.']);
	});

	it('warns Spain before the 2027 block while the API still reads allowed', () => {
		expect(restrictionBullets(org({ country: 'ES' }))).toEqual([
			'Attendee invoices: available until 31 December 2026.'
		]);
	});

	it('lists the online payment block', () => {
		expect(restrictionBullets(org({ country: 'IT', online_payment: 'blocked' }))).toEqual([
			'Online card payments: not available for events in Italy. Payments at the door and by bank transfer work as usual.'
		]);
	});
});

describe('invoicingNotice', () => {
	it('is null when invoicing works normally', () => {
		expect(invoicingNotice(org())).toBeNull();
	});

	it('names the per-country system when blocked', () => {
		const notice = invoicingNotice(org({ country: 'GR', attendee_invoicing: 'blocked' }));
		expect(notice?.kind).toBe('blocked');
		expect(notice?.text).toContain('Greece');
		expect(notice?.text).toContain('myDATA');
	});

	it('uses Peppol for Belgium and the KSeF copy for Poland', () => {
		const be = invoicingNotice(
			org({ country: 'BE', attendee_invoicing: 'blocked_for_business_buyers' })
		);
		expect(be?.kind).toBe('business');
		expect(be?.text).toContain('Peppol');
		const pl = invoicingNotice(
			org({ country: 'PL', attendee_invoicing: 'blocked_for_business_buyers' })
		);
		expect(pl?.text).toBe(
			"Invoices to business customers must be issued through KSeF. Revel won't create those. Issue them from your e-invoicing software. Invoices to consumers work as usual."
		);
	});

	it('shows the upcoming Spanish block as a warning', () => {
		expect(invoicingNotice(org({ country: 'ES' }))?.kind).toBe('upcoming');
		// Once the API flips to blocked, the hard block wins.
		expect(invoicingNotice(org({ country: 'ES', attendee_invoicing: 'blocked' }))?.text).toContain(
			'Verifactu'
		);
	});
});

describe('noticesFor', () => {
	const notices = [
		{ key: 'at_registrierkasse', applies_to: 'offline_payment' as const, message: 'a' },
		{ key: 'pl_kasa_fiskalna', applies_to: 'ticket_sales' as const, message: 'b' }
	];

	it('filters by topic, keeping API order', () => {
		expect(noticesFor(notices, 'ticket_sales').map((n) => n.key)).toEqual(['pl_kasa_fiskalna']);
		expect(noticesFor(notices, 'offline_payment', 'ticket_sales')).toHaveLength(2);
	});

	it('tolerates a missing list', () => {
		expect(noticesFor(undefined, 'ticket_sales')).toEqual([]);
	});
});

describe('event-level helpers', () => {
	it('uses the Italian wording for events held in Italy', () => {
		expect(onlinePaymentBlockedText('IT')).toContain('Agenzia delle Entrate');
		expect(onlinePaymentBlockedText('FR')).toContain('France');
	});

	it('treats only events held in Italy as reservation-only', () => {
		expect(isReservationOnly('IT')).toBe(true);
		expect(isReservationOnly('')).toBe(false);
		expect(isReservationOnly(undefined)).toBe(false);
	});
});
