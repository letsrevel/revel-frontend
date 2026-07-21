import { describe, it, expect } from 'vitest';
import type { TierRemainingTicketsSchema, VenueChartSchema } from '$lib/api/generated/types.gen';
import type { TierSchemaWithId } from '$lib/types/tickets';
import {
	buildSectorOverview,
	eventHasSeatingMap,
	isTierPurchasable,
	parseStageMetadata,
	tierPriceLabel
} from './venue-overview';

// Pure logic behind the map-first overview (#679): sector→tier mapping (1:N
// and no-tier cases), purchasability gates and defensive stage parsing.

const NOW = new Date('2026-07-21T12:00:00Z');

function tier(overrides: Partial<TierSchemaWithId> = {}): TierSchemaWithId {
	return {
		id: 'tier-1',
		event_id: 'event-1',
		name: 'Tier',
		price: '20.00',
		currency: 'EUR',
		total_available: null,
		seat_assignment_mode: 'user_choice',
		payment_method: 'offline',
		can_purchase: true,
		...overrides
	} as TierSchemaWithId;
}

function sectorTier(sectorId: string, overrides: Partial<TierSchemaWithId> = {}): TierSchemaWithId {
	return tier({
		sector: { id: sectorId, name: `Sector ${sectorId}` },
		...overrides
	});
}

function chart(overrides: Partial<VenueChartSchema> = {}): VenueChartSchema {
	return {
		venue_id: 'venue-1',
		venue_name: 'Teatro',
		updated_at: '2026-07-18T00:00:00Z',
		sectors: [
			{ id: 'platea', name: 'Platea', kind: 'seated' },
			{ id: 'galleria', name: 'Galleria', kind: 'seated' },
			{ id: 'palco-2', name: 'Palco 2', kind: 'seated' },
			{ id: 'pit', name: 'Pit', kind: 'standing', capacity: 100 }
		],
		...overrides
	};
}

describe('isTierPurchasable', () => {
	it('accepts a plain on-sale tier', () => {
		expect(isTierPurchasable(tier(), undefined, NOW)).toBe(true);
	});

	it.each([
		['hidden payment method', { payment_method: 'hidden' }],
		['backend can_purchase false', { can_purchase: false }],
		['sold out inventory', { total_available: 0 }],
		['sales not started', { sales_start_at: '2026-08-01T00:00:00Z' }],
		['sales ended', { sales_end_at: '2026-07-01T00:00:00Z' }]
	] as Array<[string, Partial<TierSchemaWithId>]>)('rejects %s', (_label, overrides) => {
		expect(isTierPurchasable(tier(overrides), undefined, NOW)).toBe(false);
	});

	it('respects the per-user remaining info when present', () => {
		const soldOut: TierRemainingTicketsSchema = {
			tier_id: 'tier-1',
			sold_out: true,
			remaining: 3
		};
		const quotaHit: TierRemainingTicketsSchema = {
			tier_id: 'tier-1',
			sold_out: false,
			remaining: 0
		};
		const fine: TierRemainingTicketsSchema = {
			tier_id: 'tier-1',
			sold_out: false,
			remaining: 2
		};
		expect(isTierPurchasable(tier(), soldOut, NOW)).toBe(false);
		expect(isTierPurchasable(tier(), quotaHit, NOW)).toBe(false);
		expect(isTierPurchasable(tier(), fine, NOW)).toBe(true);
	});

	it('accepts an open sales window that has started', () => {
		expect(
			isTierPurchasable(
				tier({ sales_start_at: '2026-07-01T00:00:00Z', sales_end_at: '2026-08-01T00:00:00Z' }),
				undefined,
				NOW
			)
		).toBe(true);
	});
});

describe('buildSectorOverview', () => {
	it('maps a 1:N sector, a 1:1 sector, and leaves unsold sectors empty', () => {
		// The seeded Traviata shape: Platea is sold by a flat user_choice tier
		// AND a category-priced best-available tier; Galleria by one tier;
		// Palco 2 by none.
		const plateaFlat = sectorTier('platea', { id: 't-platea', name: 'Platea', price: '45.00' });
		const plateaBest = sectorTier('platea', {
			id: 't-platea-ba',
			name: 'Platea — Best Available',
			seat_assignment_mode: 'best_available',
			price: '45.00',
			seat_pricing: {
				categories: [
					{ id: 'prem', name: 'Platea Premium', color: '#dc2626', price: '80', available: true },
					{ id: 'std', name: 'Platea', color: '#f59e0b', price: '45', available: true }
				],
				unpainted: null
			}
		});
		const galleria = sectorTier('galleria', {
			id: 't-galleria',
			name: 'Galleria',
			seat_assignment_mode: 'best_available',
			price: '25.00'
		});

		const entries = buildSectorOverview(chart(), [plateaFlat, plateaBest, galleria], { now: NOW });
		const byId = new Map(entries.map((entry) => [entry.sectorId, entry]));

		expect(entries).toHaveLength(4);
		const platea = byId.get('platea');
		expect(platea?.options.map((o) => o.tier.id)).toEqual(['t-platea', 't-platea-ba']);
		expect(platea?.options[0].priceDisplay).toBe('EUR 45.00');
		expect(platea?.options[0].mode).toBe('user_choice');
		// Honest range for the category-priced tier, straight from seat_pricing.
		expect(platea?.options[1].priceDisplay).toBe('EUR 45.00 - EUR 80.00');
		expect(platea?.options[1].mode).toBe('best_available');

		expect(byId.get('galleria')?.options.map((o) => o.tier.id)).toEqual(['t-galleria']);
		expect(byId.get('palco-2')?.options).toEqual([]);
	});

	it('excludes unpurchasable tiers so a fully unsold sector reads as not for sale', () => {
		const hidden = sectorTier('platea', { id: 't-hidden', payment_method: 'hidden' });
		const soldOut = sectorTier('platea', { id: 't-soldout', total_available: 0 });
		const notYet = sectorTier('platea', {
			id: 't-later',
			sales_start_at: '2026-08-01T00:00:00Z'
		});
		const entries = buildSectorOverview(chart(), [hidden, soldOut, notYet], { now: NOW });
		expect(entries.find((entry) => entry.sectorId === 'platea')?.options).toEqual([]);
	});

	it('applies per-user remaining info from opts.remaining', () => {
		const sold = sectorTier('galleria', { id: 't-galleria' });
		const remaining = [{ tier_id: 't-galleria', sold_out: true, remaining: 1 }];
		const entries = buildSectorOverview(chart(), [sold], { now: NOW, remaining });
		expect(entries.find((entry) => entry.sectorId === 'galleria')?.options).toEqual([]);
	});

	it('ignores tiers with no linked sector', () => {
		const unlinked = tier({ id: 't-none', sector: null });
		const entries = buildSectorOverview(chart(), [unlinked], { now: NOW });
		expect(entries.every((entry) => entry.options.length === 0)).toBe(true);
	});

	it('includes GA tiers linked to a standing sector, with the general mode hint', () => {
		const ga = sectorTier('pit', {
			id: 't-pit',
			name: 'Pit GA',
			seat_assignment_mode: 'none',
			price: '15.00'
		});
		const entries = buildSectorOverview(chart(), [ga], { now: NOW });
		const pit = entries.find((entry) => entry.sectorId === 'pit');
		expect(pit?.options.map((o) => o.tier.id)).toEqual(['t-pit']);
		expect(pit?.options[0].mode).toBe('general');
	});
});

describe('tierPriceLabel', () => {
	it('renders free, PWYC bounds, and flat prices', () => {
		expect(tierPriceLabel(tier({ payment_method: 'free' }))).toBe('Free');
		expect(tierPriceLabel(tier({ price_type: 'pwyc', pwyc_min: '5.00', pwyc_max: '15.00' }))).toBe(
			'EUR 5.00 - EUR 15.00'
		);
		expect(tierPriceLabel(tier())).toBe('EUR 20.00');
	});
});

describe('eventHasSeatingMap', () => {
	it('is true only when a purchasable tier sells a sector', () => {
		expect(eventHasSeatingMap([sectorTier('platea')], undefined, NOW)).toBe(true);
		expect(eventHasSeatingMap([tier({ sector: null })], undefined, NOW)).toBe(false);
		expect(
			eventHasSeatingMap([sectorTier('platea', { can_purchase: false })], undefined, NOW)
		).toBe(false);
		expect(
			eventHasSeatingMap(
				[sectorTier('platea', { id: 't-1' })],
				[{ tier_id: 't-1', sold_out: true, remaining: 1 }],
				NOW
			)
		).toBe(false);
	});
});

describe('parseStageMetadata', () => {
	it('parses a well-formed stage position', () => {
		expect(
			parseStageMetadata({ stage: { position: { x: 4.5, y: -2 }, shape: null, label: 'Main' } })
		).toEqual({ x: 4.5, y: -2 });
	});

	it.each([
		['missing metadata', null],
		['metadata without stage', {}],
		['stage not an object', { stage: 'front' }],
		['stage without position', { stage: { shape: null } }],
		['position not an object', { stage: { position: 'center' } }],
		['non-numeric x', { stage: { position: { x: '4', y: 2 } } }],
		['non-finite y', { stage: { position: { x: 4, y: Number.NaN } } }]
	] as Array<[string, { [key: string]: unknown } | null]>)(
		'returns null for %s',
		(_label, meta) => {
			expect(parseStageMetadata(meta)).toBeNull();
		}
	);
});
