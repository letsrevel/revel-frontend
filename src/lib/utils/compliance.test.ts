import { describe, it, expect } from 'vitest';
import type { OrganizationComplianceSchema } from '$lib/api/generated/types.gen';
import {
	complianceDocsUrl,
	countryName,
	invoicingNotice,
	isReservationOnly,
	noticesFor,
	onlinePaymentBlockedText,
	restrictionBullets,
	tierIsPriced,
	unplacedNotices,
	withoutBlockedOnlineTiers
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

describe('tierIsPriced', () => {
	it('matches the backend tier_is_paid rule', () => {
		expect(tierIsPriced({ price: '10.00', price_type: 'fixed' })).toBe(true);
		expect(tierIsPriced({ price: '0.00', price_type: 'pwyc' })).toBe(true);
		expect(tierIsPriced({ price: '0.00', price_type: 'fixed' })).toBe(false);
		expect(
			tierIsPriced({
				price: '0.00',
				seat_pricing: { categories: [{ price: '0.00' }, { price: '12.50' }] }
			})
		).toBe(true);
		expect(tierIsPriced({ price: '0.00', seat_pricing: { categories: [], unpainted: null } })).toBe(
			false
		);
	});
});

describe('unplacedNotices', () => {
	it('keeps only topics without a dedicated place', () => {
		const notices = [
			{ key: 'a', applies_to: 'offline_payment' as const, message: 'a' },
			{ key: 'b', applies_to: 'ticket_sales' as const, message: 'b' },
			// A topic a newer backend may send; the generated type doesn't know it yet.
			{ key: 'c', applies_to: 'invoicing' as unknown as 'ticket_sales', message: 'c' }
		];
		expect(unplacedNotices(notices).map((n) => n.key)).toEqual(['c']);
		expect(unplacedNotices(undefined)).toEqual([]);
	});
});

describe('withoutBlockedOnlineTiers', () => {
	const tiers = [
		{ id: 'card', payment_method: 'online' },
		{ id: 'door', payment_method: 'at_the_door' },
		{ id: 'bank', payment_method: 'offline' },
		{ id: 'free', payment_method: 'free' }
	];

	it('drops online tiers when card payment is blocked, keeping every other method', () => {
		expect(
			withoutBlockedOnlineTiers(tiers, { online_payment: 'blocked' }).map((t) => t.id)
		).toEqual(['door', 'bank', 'free']);
	});

	it('leaves the list untouched when card payment is allowed', () => {
		expect(withoutBlockedOnlineTiers(tiers, { online_payment: 'allowed' })).toBe(tiers);
	});

	it('leaves the list untouched when compliance is absent (older backend)', () => {
		expect(withoutBlockedOnlineTiers(tiers, undefined)).toBe(tiers);
		expect(withoutBlockedOnlineTiers(tiers, null)).toBe(tiers);
	});

	// The event page's seat-selection handoff (`handleSelectTier`) asks the same
	// question for the one tier a buyer picked on the map: an empty result means
	// "don't add it to the cart, don't hold seats for it".
	it('answers the single-tier handoff question', () => {
		const card = [{ id: 'card', payment_method: 'online' }];
		const door = [{ id: 'door', payment_method: 'at_the_door' }];
		expect(withoutBlockedOnlineTiers(card, { online_payment: 'blocked' })).toHaveLength(0);
		expect(withoutBlockedOnlineTiers(door, { online_payment: 'blocked' })).toHaveLength(1);
		expect(withoutBlockedOnlineTiers(card, { online_payment: 'allowed' })).toHaveLength(1);
	});
});
