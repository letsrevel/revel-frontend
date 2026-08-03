import { describe, it, expect } from 'vitest';
import {
	guestCheckoutBody,
	guestPwycCheckoutBody,
	guestNamesError,
	guestTicketItems,
	type GuestCheckoutArgs,
	type GuestTicketItemsArgs
} from './guest-checkout-payload';

function args(overrides: Partial<GuestCheckoutArgs> = {}): GuestCheckoutArgs {
	return {
		email: 'guest@example.com',
		firstName: 'Gia',
		lastName: 'Guest',
		tickets: [{ guest_name: 'Gia Guest', seat_id: null }],
		billingInfo: undefined,
		accessibleRequired: false,
		priceCategoryId: undefined,
		pricePerTicket: undefined,
		...overrides
	};
}

describe('guestCheckoutBody', () => {
	it('sends first/last name when provided', () => {
		const body = guestCheckoutBody(args());
		expect(body.first_name).toBe('Gia');
		expect(body.last_name).toBe('Guest');
	});

	it('omits first/last name entirely for email-only checkout', () => {
		const body = guestCheckoutBody(args({ firstName: undefined, lastName: undefined }));
		expect('first_name' in body).toBe(false);
		expect('last_name' in body).toBe(false);
		expect(body.email).toBe('guest@example.com');
	});

	it('passes nameless ticket items through untouched', () => {
		const body = guestCheckoutBody(args({ tickets: [{ seat_id: null }] }));
		expect(body.tickets).toEqual([{ seat_id: null }]);
	});
});

describe('guestPwycCheckoutBody', () => {
	it('keeps the email-only shape and adds price_per_ticket', () => {
		const body = guestPwycCheckoutBody(
			args({ firstName: undefined, lastName: undefined, pricePerTicket: 12.5 })
		);
		expect('first_name' in body).toBe(false);
		expect(body.price_per_ticket).toBe(12.5);
	});
});

const itemsBase: GuestTicketItemsArgs = {
	guestNames: ['Gia Guest', 'Pat Plus'],
	namesShown: true,
	requireTicketNames: true,
	primaryName: 'Gia Guest',
	heldSeatIds: [],
	useHeldSeats: false
};

describe('guestTicketItems', () => {
	it('uses the typed per-ticket names and an explicit null seat', () => {
		expect(guestTicketItems(itemsBase)).toEqual([
			{ guest_name: 'Gia Guest', seat_id: null },
			{ guest_name: 'Pat Plus', seat_id: null }
		]);
	});

	it('falls back to the purchaser name for a hidden single-ticket input', () => {
		expect(guestTicketItems({ ...itemsBase, guestNames: [' '], namesShown: false })).toEqual([
			{ guest_name: 'Gia Guest', seat_id: null }
		]);
	});

	it('omits guest_name entirely when the event does not require names', () => {
		const items = guestTicketItems({ ...itemsBase, requireTicketNames: false });
		expect(items).toEqual([{ seat_id: null }, { seat_id: null }]);
		expect('guest_name' in items[0]).toBe(false);
	});

	it('attaches held seats positionally in user_choice mode', () => {
		const items = guestTicketItems({
			...itemsBase,
			heldSeatIds: ['s1'],
			useHeldSeats: true
		});
		expect(items).toEqual([
			{ guest_name: 'Gia Guest', seat_id: 's1' },
			{ guest_name: 'Pat Plus', seat_id: null }
		]);
	});

	// JSON.stringify, not toEqual, ON PURPOSE: the reservation-resume fingerprint
	// serializes these items, so KEY ORDER is part of the contract.
	it('serializes guest_name before seat_id (resume-fingerprint contract)', () => {
		expect(
			JSON.stringify(guestTicketItems({ ...itemsBase, heldSeatIds: ['s1'], useHeldSeats: true }))
		).toBe('[{"guest_name":"Gia Guest","seat_id":"s1"},{"guest_name":"Pat Plus","seat_id":null}]');
	});
});

describe('guestNamesError', () => {
	it('returns empty string when name inputs are hidden', () => {
		expect(guestNamesError([''], false)).toBe('');
	});

	it('flags the first empty name when inputs are shown', () => {
		expect(guestNamesError(['Gia', '  '], true)).not.toBe('');
	});
});
