import { describe, it, expect } from 'vitest';
import { confirmBlocked, sheetValidationError } from './checkout-sheet-validation';
import type { CartGroup } from './cart.svelte';
import type { TierSchemaWithId } from '$lib/types/tickets';

function makeTier(overrides: Partial<TierSchemaWithId> = {}): TierSchemaWithId {
	return {
		id: overrides.id ?? crypto.randomUUID(),
		name: 'GA',
		payment_method: 'online',
		price_type: 'fixed',
		seat_assignment_mode: 'none',
		currency: 'EUR',
		price: '25.00',
		total_available: 100,
		pwyc_min: null,
		pwyc_max: null,
		...overrides
	} as TierSchemaWithId;
}

function makeGroup(overrides: Partial<CartGroup> = {}): CartGroup {
	return {
		tier: makeTier(),
		quantity: 1,
		guestNames: [],
		pwycAmount: null,
		priceCategoryId: null,
		accessibleRequired: false,
		seatIds: [],
		...overrides
	};
}

describe('sheetValidationError', () => {
	it('returns "names" when a required name is missing for one ticket in a group', () => {
		const group = makeGroup({ quantity: 2, guestNames: ['Alice', ''] });
		expect(sheetValidationError([group], true)).toBe('names');
	});

	it('returns "names" when guestNames is shorter than quantity (unpadded)', () => {
		const group = makeGroup({ quantity: 2, guestNames: ['Alice'] });
		expect(sheetValidationError([group], true)).toBe('names');
	});

	it('returns "names" when a name is present but only whitespace', () => {
		const group = makeGroup({ quantity: 1, guestNames: ['   '] });
		expect(sheetValidationError([group], true)).toBe('names');
	});

	it('ignores missing names when requireTicketNames is false', () => {
		const group = makeGroup({ quantity: 2, guestNames: [] });
		expect(sheetValidationError([group], false)).toBeNull();
	});

	it('returns "pwyc" when a pwyc group has no amount entered', () => {
		const group = makeGroup({
			tier: makeTier({ price_type: 'pwyc' }),
			pwycAmount: null
		});
		expect(sheetValidationError([group], false)).toBe('pwyc');
	});

	it('returns "pwyc" when a pwyc group amount is below the tier minimum', () => {
		const group = makeGroup({
			tier: makeTier({ price_type: 'pwyc', pwyc_min: '10.00' }),
			pwycAmount: '5.00'
		});
		expect(sheetValidationError([group], false)).toBe('pwyc');
	});

	it('returns "pwyc" when a pwyc group amount exceeds the tier maximum', () => {
		const group = makeGroup({
			tier: makeTier({ price_type: 'pwyc', pwyc_min: '5.00', pwyc_max: '20.00' }),
			pwycAmount: '25.00'
		});
		expect(sheetValidationError([group], false)).toBe('pwyc');
	});

	it('returns "names" before "pwyc" when both a names group and an earlier pwyc group are invalid (first-failing order)', () => {
		const pwycGroup = makeGroup({
			tier: makeTier({ id: 'pwyc-tier', price_type: 'pwyc' }),
			quantity: 1,
			guestNames: ['Alice'],
			pwycAmount: null
		});
		const namesGroup = makeGroup({
			tier: makeTier({ id: 'named-tier' }),
			quantity: 1,
			guestNames: ['']
		});
		// pwyc group appears first in the array, but a name failure on ANY group
		// still surfaces — order within the array determines which tag wins when
		// a single group offends on names; here they're separate groups so the
		// first group in iteration order (pwyc) reports first.
		expect(sheetValidationError([pwycGroup, namesGroup], true)).toBe('pwyc');
		expect(sheetValidationError([namesGroup, pwycGroup], true)).toBe('names');
	});

	it('returns null when every group is valid: names filled and pwyc in range', () => {
		const namesGroup = makeGroup({
			tier: makeTier({ id: 'named-tier' }),
			quantity: 2,
			guestNames: ['Alice', 'Bob']
		});
		const pwycGroup = makeGroup({
			tier: makeTier({ id: 'pwyc-tier', price_type: 'pwyc', pwyc_min: '5.00' }),
			quantity: 1,
			guestNames: ['Carol'],
			pwycAmount: '10.00'
		});
		expect(sheetValidationError([namesGroup, pwycGroup], true)).toBeNull();
	});

	it('returns null for an empty cart', () => {
		expect(sheetValidationError([], true)).toBeNull();
	});

	it('does not require names for a pwyc-only, non-required-names cart with a valid amount', () => {
		const group = makeGroup({
			tier: makeTier({ price_type: 'pwyc', pwyc_min: '1.00' }),
			pwycAmount: '5.00'
		});
		expect(sheetValidationError([group], false)).toBeNull();
	});

	// #853 PR 3: a mapped best-available tier (non-empty seat_pricing.categories)
	// is a mandatory zone pick — the backend has no default price_category_id.
	it('returns "zone" when a mapped best-available group has no priceCategoryId', () => {
		const group = makeGroup({
			tier: makeTier({
				seat_assignment_mode: 'best_available',
				seat_pricing: { categories: [{ id: 'gold', name: 'Gold', color: null, price: '10.00' }] }
			}),
			priceCategoryId: null
		});
		expect(sheetValidationError([group], false)).toBe('zone');
	});

	it('returns null when a mapped best-available group has a priceCategoryId set', () => {
		const group = makeGroup({
			tier: makeTier({
				seat_assignment_mode: 'best_available',
				seat_pricing: { categories: [{ id: 'gold', name: 'Gold', color: null, price: '10.00' }] }
			}),
			priceCategoryId: 'gold'
		});
		expect(sheetValidationError([group], false)).toBeNull();
	});

	it('does not require a zone for an UNMAPPED best-available group (empty seat_pricing)', () => {
		const group = makeGroup({
			tier: makeTier({ seat_assignment_mode: 'best_available', seat_pricing: null }),
			priceCategoryId: null
		});
		expect(sheetValidationError([group], false)).toBeNull();
	});

	it('does not require a zone for a non-best-available group even with priceCategoryId null', () => {
		const group = makeGroup({
			tier: makeTier({ seat_assignment_mode: 'none' }),
			priceCategoryId: null
		});
		expect(sheetValidationError([group], false)).toBeNull();
	});

	it('returns "names" before "zone" within the same group (names checked first)', () => {
		const group = makeGroup({
			tier: makeTier({
				seat_assignment_mode: 'best_available',
				seat_pricing: { categories: [{ id: 'gold', name: 'Gold', color: null, price: '10.00' }] }
			}),
			quantity: 1,
			guestNames: [''],
			priceCategoryId: null
		});
		expect(sheetValidationError([group], true)).toBe('names');
	});

	it('returns "pwyc" before "zone" within the same group (pwyc checked before zone)', () => {
		const group = makeGroup({
			tier: makeTier({
				price_type: 'pwyc',
				seat_assignment_mode: 'best_available',
				seat_pricing: { categories: [{ id: 'gold', name: 'Gold', color: null, price: '10.00' }] }
			}),
			pwycAmount: null,
			priceCategoryId: null
		});
		expect(sheetValidationError([group], false)).toBe('pwyc');
	});

	it('returns "zone" from an earlier group before a later group\'s "names" failure', () => {
		const zoneGroup = makeGroup({
			tier: makeTier({
				id: 'zone-tier',
				seat_assignment_mode: 'best_available',
				seat_pricing: { categories: [{ id: 'gold', name: 'Gold', color: null, price: '10.00' }] }
			}),
			quantity: 1,
			guestNames: ['Alice'],
			priceCategoryId: null
		});
		const namesGroup = makeGroup({
			tier: makeTier({ id: 'named-tier' }),
			quantity: 1,
			guestNames: ['']
		});
		expect(sheetValidationError([zoneGroup, namesGroup], true)).toBe('zone');
	});
});

describe('confirmBlocked', () => {
	const clear = {
		isProcessing: false,
		discountValidating: false,
		guestError: null,
		validationError: null
	};

	it('is false when nothing blocks', () => {
		expect(confirmBlocked(clear)).toBe(false);
	});

	it('blocks while processing', () => {
		expect(confirmBlocked({ ...clear, isProcessing: true })).toBe(true);
	});

	it('blocks while a discount validation is in flight — confirm must not overtake it (#863 review)', () => {
		expect(confirmBlocked({ ...clear, discountValidating: true })).toBe(true);
	});

	it('blocks on a guest identity error', () => {
		expect(confirmBlocked({ ...clear, guestError: 'email' })).toBe(true);
	});

	it('blocks on a sheet validation error', () => {
		expect(confirmBlocked({ ...clear, validationError: 'names' })).toBe(true);
	});
});
