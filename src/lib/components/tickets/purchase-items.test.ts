import { describe, it, expect } from 'vitest';
import { buildPurchaseTicketItems, defaultGuestName, defaultPurchaseItems } from './purchase-items';

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
});

describe('defaultPurchaseItems', () => {
	it('carries the buyer name when the event requires names', () => {
		expect(defaultPurchaseItems(true, 'Alice A')).toEqual([{ guest_name: 'Alice A' }]);
	});

	it('is a single nameless item when the event does not require names', () => {
		const items = defaultPurchaseItems(false, 'Alice A');
		expect(items).toEqual([{}]);
		expect('guest_name' in items[0]).toBe(false);
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
