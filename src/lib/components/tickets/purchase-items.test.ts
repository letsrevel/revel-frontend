import { describe, it, expect } from 'vitest';
import { buildPurchaseTicketItems, defaultGuestName } from './purchase-items';

const base = {
	guestNames: ['Alice A', 'Bob B'],
	requireTicketNames: true,
	namesShown: true,
	defaultName: 'Buyer Name',
	heldSeatIds: [] as string[],
	useHeldSeats: false
};

describe('buildPurchaseTicketItems', () => {
	it('uses the typed names when names are required and shown', () => {
		expect(buildPurchaseTicketItems(base)).toEqual([
			{ guest_name: 'Alice A' },
			{ guest_name: 'Bob B' }
		]);
	});

	it('falls back to the default name for a hidden single-ticket input', () => {
		const items = buildPurchaseTicketItems({ ...base, guestNames: [''], namesShown: false });
		expect(items).toEqual([{ guest_name: 'Buyer Name' }]);
	});

	it('omits guest_name entirely when the event does not require names', () => {
		const items = buildPurchaseTicketItems({
			...base,
			requireTicketNames: false,
			namesShown: false
		});
		expect(items).toEqual([{}, {}]);
		expect('guest_name' in items[0]).toBe(false);
	});

	it('keeps one item per ticket and attaches held seats when names are off', () => {
		const items = buildPurchaseTicketItems({
			...base,
			requireTicketNames: false,
			namesShown: false,
			heldSeatIds: ['s1', 's2'],
			useHeldSeats: true
		});
		expect(items).toEqual([{ seat_id: 's1' }, { seat_id: 's2' }]);
	});

	it('attaches held seats alongside names when names are required', () => {
		const items = buildPurchaseTicketItems({
			...base,
			heldSeatIds: ['s1'],
			useHeldSeats: true
		});
		expect(items).toEqual([{ guest_name: 'Alice A', seat_id: 's1' }, { guest_name: 'Bob B' }]);
	});

	it('trims whitespace names', () => {
		const items = buildPurchaseTicketItems({ ...base, guestNames: ['  Alice  ', 'Bob'] });
		expect(items[0]).toEqual({ guest_name: 'Alice' });
	});

	// These two assert on JSON.stringify, not toEqual, ON PURPOSE: the checkout
	// mutations fingerprint their params with JSON.stringify, so KEY ORDER is part
	// of the contract. Assigning seat_id before guest_name would keep every
	// toEqual assertion green while changing the fingerprint — silently breaking
	// reservation resume for every seated checkout. Pin the serialized shape.
	it('serializes guest_name before seat_id (resume-fingerprint contract)', () => {
		expect(
			JSON.stringify(buildPurchaseTicketItems({ ...base, heldSeatIds: ['s1'], useHeldSeats: true }))
		).toBe('[{"guest_name":"Alice A","seat_id":"s1"},{"guest_name":"Bob B"}]');
	});

	it('serializes seat-only items stably when names are off (resume-fingerprint contract)', () => {
		expect(
			JSON.stringify(
				buildPurchaseTicketItems({
					...base,
					requireTicketNames: false,
					namesShown: false,
					heldSeatIds: ['s1', 's2'],
					useHeldSeats: true
				})
			)
		).toBe('[{"seat_id":"s1"},{"seat_id":"s2"}]');
	});
});

describe('defaultGuestName', () => {
	it('uses the trimmed profile name when there is one', () => {
		expect(defaultGuestName('  Alice A  ')).toBe('Alice A');
	});

	it('falls back to a non-empty placeholder without a profile name', () => {
		expect(defaultGuestName('   ').length).toBeGreaterThan(0);
	});
});
