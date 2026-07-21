import { describe, it, expect } from 'vitest';
import {
	buildCategoryPricesPayload,
	buildTierSeatingFields,
	retainedSectorIdForMode
} from './tier-seating-payload';

const VENUE = 'venue-1';
const SECTOR = 'sector-1';
const STANDING = 'sector-standing';
const CATEGORY = 'pc-gold';

const STANDING_IDS: ReadonlySet<string> = new Set([STANDING]);

describe('buildTierSeatingFields', () => {
	it('nulls every seating field for none without a sector (plain general admission)', () => {
		expect(buildTierSeatingFields('none', VENUE, null)).toEqual({
			venue_id: null,
			sector_id: null
		});
	});

	it('passes a linked standing sector (and its venue) through for none — the capacity cap survives edits', () => {
		expect(buildTierSeatingFields('none', VENUE, STANDING)).toEqual({
			venue_id: VENUE,
			sector_id: STANDING
		});
	});

	it('sends venue and sector for user_choice', () => {
		expect(buildTierSeatingFields('user_choice', VENUE, SECTOR)).toEqual({
			venue_id: VENUE,
			sector_id: SECTOR
		});
	});

	it('sends venue and sector for best_available too (pricing convergence: a seated tier of either mode requires a sector)', () => {
		expect(buildTierSeatingFields('best_available', VENUE, SECTOR)).toEqual({
			venue_id: VENUE,
			sector_id: SECTOR
		});
	});

	it('editing none+standing -> user_choice submits the (kept or replaced) sector', () => {
		// The form clears a standing selection on the switch (retainedSectorIdForMode);
		// whatever seated sector the organizer then picks is sent as-is.
		const kept = retainedSectorIdForMode('user_choice', STANDING, STANDING_IDS);
		expect(kept).toBeNull();
		expect(buildTierSeatingFields('user_choice', VENUE, kept)).toEqual({
			venue_id: VENUE,
			sector_id: null
		});
		expect(buildTierSeatingFields('user_choice', VENUE, SECTOR).sector_id).toBe(SECTOR);
	});

	it('editing user_choice -> none does not wipe a standing selection, but drops a seated one', () => {
		// Standing selection (e.g. re-picked after the switch) survives into the payload…
		const standingKept = retainedSectorIdForMode('none', STANDING, STANDING_IDS);
		expect(buildTierSeatingFields('none', VENUE, standingKept)).toEqual({
			venue_id: VENUE,
			sector_id: STANDING
		});
		// …while a seated sector is cleared on the switch and never submitted.
		const seatedCleared = retainedSectorIdForMode('none', SECTOR, STANDING_IDS);
		expect(seatedCleared).toBeNull();
		expect(buildTierSeatingFields('none', VENUE, seatedCleared)).toEqual({
			venue_id: null,
			sector_id: null
		});
	});

	it('passes through null selections unchanged for seated modes', () => {
		expect(buildTierSeatingFields('user_choice', VENUE, null)).toEqual({
			venue_id: VENUE,
			sector_id: null
		});
		expect(buildTierSeatingFields('best_available', null, null)).toEqual({
			venue_id: null,
			sector_id: null
		});
	});
});

describe('retainedSectorIdForMode', () => {
	it('keeps null as null for every mode', () => {
		expect(retainedSectorIdForMode('none', null, STANDING_IDS)).toBeNull();
		expect(retainedSectorIdForMode('user_choice', null, STANDING_IDS)).toBeNull();
		expect(retainedSectorIdForMode('best_available', null, STANDING_IDS)).toBeNull();
	});

	it('none keeps a standing sector and clears a seated one', () => {
		expect(retainedSectorIdForMode('none', STANDING, STANDING_IDS)).toBe(STANDING);
		expect(retainedSectorIdForMode('none', SECTOR, STANDING_IDS)).toBeNull();
	});

	it('user_choice keeps a seated sector and clears a standing one', () => {
		expect(retainedSectorIdForMode('user_choice', SECTOR, STANDING_IDS)).toBe(SECTOR);
		expect(retainedSectorIdForMode('user_choice', STANDING, STANDING_IDS)).toBeNull();
	});

	it('best_available keeps a seated sector and clears a standing one (same rule as user_choice)', () => {
		expect(retainedSectorIdForMode('best_available', SECTOR, STANDING_IDS)).toBe(SECTOR);
		expect(retainedSectorIdForMode('best_available', STANDING, STANDING_IDS)).toBeNull();
	});

	it('clears everything not provably standing when the standing set is empty (chart not consulted)', () => {
		expect(retainedSectorIdForMode('none', SECTOR, new Set())).toBeNull();
		expect(retainedSectorIdForMode('user_choice', SECTOR, new Set())).toBe(SECTOR);
	});
});

describe('buildCategoryPricesPayload', () => {
	it('omits the field when nothing changed (unrelated edits cannot wipe prices)', () => {
		expect(buildCategoryPricesPayload('user_choice', {}, {})).toBeUndefined();
		expect(
			buildCategoryPricesPayload('user_choice', { [CATEGORY]: '50.00' }, { [CATEGORY]: '50.00' })
		).toBeUndefined();
	});

	it('sends the full replacement map when a price changes or appears', () => {
		expect(buildCategoryPricesPayload('user_choice', {}, { [CATEGORY]: '50.00' })).toEqual({
			[CATEGORY]: '50.00'
		});
		expect(
			buildCategoryPricesPayload(
				'user_choice',
				{ [CATEGORY]: '50.00' },
				{ [CATEGORY]: '60.00', extra: '10.00' }
			)
		).toEqual({ [CATEGORY]: '60.00', extra: '10.00' });
	});

	it('clears with {} when every price is emptied', () => {
		expect(
			buildCategoryPricesPayload('user_choice', { [CATEGORY]: '50.00' }, { [CATEGORY]: '' })
		).toEqual({});
	});

	it('drops empty inputs and normalizes comma decimals', () => {
		expect(
			buildCategoryPricesPayload('user_choice', {}, { [CATEGORY]: ' 12,50 ', other: '   ' })
		).toEqual({ [CATEGORY]: '12.50' });
	});

	it('keeps the map through best_available (the single pricing mechanism, both modes)', () => {
		expect(
			buildCategoryPricesPayload('best_available', { [CATEGORY]: '50.00' }, { [CATEGORY]: '50.00' })
		).toBeUndefined();
		expect(buildCategoryPricesPayload('best_available', {}, { [CATEGORY]: '80.00' })).toEqual({
			[CATEGORY]: '80.00'
		});
	});

	it('clears a stored map when the tier leaves the seated modes, and stays silent otherwise', () => {
		expect(
			buildCategoryPricesPayload('none', { [CATEGORY]: '50.00' }, { [CATEGORY]: '50.00' })
		).toEqual({});
		expect(buildCategoryPricesPayload('none', {}, {})).toBeUndefined();
	});
});
