import { describe, it, expect } from 'vitest';
import { CartSeatHoldRegistry } from './cart-seat-registry.svelte';
import type { SeatHoldController } from './seat-hold-controller.svelte';
import type { VenueChartSchema } from '$lib/api/generated/types.gen';

/** Minimal fake — only the shape `CartSeatHoldRegistry` actually reads. */
function fakeController(
	myHoldsExpireAt: string | null | undefined,
	chartData: VenueChartSchema | undefined = undefined,
	myHolds: string[] = []
): SeatHoldController {
	return {
		availabilityQuery: { data: { my_holds_expire_at: myHoldsExpireAt } },
		chartQuery: { data: chartData },
		myHolds
	} as unknown as SeatHoldController;
}

/** A minimal-but-distinguishable stand-in venue chart for identity checks. */
function fakeChart(id: string): VenueChartSchema {
	return { id, sectors: [] } as unknown as VenueChartSchema;
}

describe('CartSeatHoldRegistry', () => {
	it('get returns undefined for an unregistered tier', () => {
		const registry = new CartSeatHoldRegistry();
		expect(registry.get('tier-1')).toBeUndefined();
	});

	it('set then get returns the same controller instance', () => {
		const registry = new CartSeatHoldRegistry();
		const controller = fakeController(null);
		registry.set('tier-1', controller);
		expect(registry.get('tier-1')).toBe(controller);
	});

	it('delete removes a registered controller', () => {
		const registry = new CartSeatHoldRegistry();
		registry.set('tier-1', fakeController(null));
		registry.delete('tier-1');
		expect(registry.get('tier-1')).toBeUndefined();
	});

	it('set overwrites an existing entry for the same tier id', () => {
		const registry = new CartSeatHoldRegistry();
		const first = fakeController(null);
		const second = fakeController(null);
		registry.set('tier-1', first);
		registry.set('tier-1', second);
		expect(registry.get('tier-1')).toBe(second);
	});

	it('expiresAt is null when nothing is registered', () => {
		const registry = new CartSeatHoldRegistry();
		expect(registry.expiresAt).toBeNull();
	});

	it('expiresAt is null when registered controllers have no expiry', () => {
		const registry = new CartSeatHoldRegistry();
		registry.set('tier-1', fakeController(null));
		registry.set('tier-2', fakeController(undefined));
		expect(registry.expiresAt).toBeNull();
	});

	it('expiresAt is the single expiry when only one controller has one', () => {
		const registry = new CartSeatHoldRegistry();
		registry.set('tier-1', fakeController('2026-08-20T12:00:00Z'));
		expect(registry.expiresAt).toBe('2026-08-20T12:00:00Z');
	});

	it('expiresAt is the EARLIEST expiry across multiple controllers', () => {
		const registry = new CartSeatHoldRegistry();
		registry.set('tier-1', fakeController('2026-08-20T12:05:00Z'));
		registry.set('tier-2', fakeController('2026-08-20T12:00:00Z'));
		registry.set('tier-3', fakeController('2026-08-20T12:10:00Z'));
		expect(registry.expiresAt).toBe('2026-08-20T12:00:00Z');
	});

	it('expiresAt ignores controllers with no expiry when others have one', () => {
		const registry = new CartSeatHoldRegistry();
		registry.set('tier-1', fakeController(null));
		registry.set('tier-2', fakeController('2026-08-20T12:00:00Z'));
		expect(registry.expiresAt).toBe('2026-08-20T12:00:00Z');
	});

	it('expiresAt recomputes after a delete removes the earliest holder', () => {
		const registry = new CartSeatHoldRegistry();
		registry.set('tier-1', fakeController('2026-08-20T12:00:00Z'));
		registry.set('tier-2', fakeController('2026-08-20T12:10:00Z'));
		registry.delete('tier-1');
		expect(registry.expiresAt).toBe('2026-08-20T12:10:00Z');
	});

	it('handedOffToCheckout defaults to false', () => {
		const registry = new CartSeatHoldRegistry();
		expect(registry.handedOffToCheckout).toBe(false);
	});

	it('handedOffToCheckout is writable', () => {
		const registry = new CartSeatHoldRegistry();
		registry.handedOffToCheckout = true;
		expect(registry.handedOffToCheckout).toBe(true);
	});

	it('chart is null when nothing is registered', () => {
		const registry = new CartSeatHoldRegistry();
		expect(registry.chart).toBeNull();
	});

	it('chart is null when no registered controller has chart data yet', () => {
		const registry = new CartSeatHoldRegistry();
		registry.set('tier-1', fakeController(null));
		registry.set('tier-2', fakeController(null));
		expect(registry.chart).toBeNull();
	});

	it('chart returns the single loaded controller’s chart', () => {
		const registry = new CartSeatHoldRegistry();
		const chart = fakeChart('venue-1');
		registry.set('tier-1', fakeController(null, chart));
		expect(registry.chart).toBe(chart);
	});

	it('chart returns SOME controller’s chart when only one has loaded', () => {
		const registry = new CartSeatHoldRegistry();
		const chart = fakeChart('venue-1');
		registry.set('tier-1', fakeController(null)); // chart still in flight
		registry.set('tier-2', fakeController(null, chart));
		expect(registry.chart).toBe(chart);
	});

	it('chart becomes null again after the loaded controller is deleted', () => {
		const registry = new CartSeatHoldRegistry();
		registry.set('tier-1', fakeController(null, fakeChart('venue-1')));
		registry.delete('tier-1');
		expect(registry.chart).toBeNull();
	});

	describe('otherHolds', () => {
		it('is empty when nothing is registered', () => {
			const registry = new CartSeatHoldRegistry();
			expect(registry.otherHolds('tier-1')).toEqual(new Set());
		});

		it('is empty when the only registered controller is the excluded one', () => {
			const registry = new CartSeatHoldRegistry();
			registry.set('tier-1', fakeController(null, undefined, ['s1', 's2']));
			expect(registry.otherHolds('tier-1')).toEqual(new Set());
		});

		it('unions holds from every OTHER registered controller', () => {
			const registry = new CartSeatHoldRegistry();
			registry.set('tier-a', fakeController(null, undefined, ['s1']));
			registry.set('tier-b', fakeController(null, undefined, ['s2', 's3']));
			registry.set('tier-c', fakeController(null, undefined, ['s4']));
			expect(registry.otherHolds('tier-b')).toEqual(new Set(['s1', 's4']));
		});

		it('excludes the given tier even when it has holds too', () => {
			const registry = new CartSeatHoldRegistry();
			registry.set('tier-a', fakeController(null, undefined, ['s1']));
			registry.set('tier-b', fakeController(null, undefined, ['s2']));
			expect(registry.otherHolds('tier-a')).toEqual(new Set(['s2']));
			expect(registry.otherHolds('tier-a')).not.toContain('s1');
		});

		it('an unregistered excludeTierId still unions every controller', () => {
			const registry = new CartSeatHoldRegistry();
			registry.set('tier-a', fakeController(null, undefined, ['s1']));
			expect(registry.otherHolds('tier-nonexistent')).toEqual(new Set(['s1']));
		});
	});
});
