import { describe, it, expect, vi } from 'vitest';
import { holdBestAvailableGroups } from './cart-ba-holds';
import type { CartGroup } from './cart.svelte';
import type { TierSchemaWithId } from '$lib/types/tickets';
import type { SeatHoldController } from './seat-hold-controller.svelte';
import type { BestAvailableHoldResult } from './seat-hold-controller.svelte';
import { CartSeatHoldRegistry } from './cart-seat-registry.svelte';

function makeTier(overrides: Partial<TierSchemaWithId> = {}): TierSchemaWithId {
	return {
		id: overrides.id ?? crypto.randomUUID(),
		name: 'GA',
		payment_method: 'online',
		price_type: 'fixed',
		seat_assignment_mode: 'best_available',
		currency: 'EUR',
		price: '25.00',
		total_available: 100,
		...overrides
	} as TierSchemaWithId;
}

function makeGroup(overrides: Partial<CartGroup> = {}): CartGroup {
	return {
		tier: makeTier(),
		quantity: 2,
		guestNames: [],
		pwycAmount: null,
		priceCategoryId: 'zone-a',
		accessibleRequired: false,
		seatIds: [],
		...overrides
	};
}

/** Minimal fake — only the shape `holdBestAvailableGroups` actually reads. */
function fakeController(
	holdResult: BestAvailableHoldResult,
	opts: { myHolds?: string[] } = {}
): SeatHoldController & { releaseCalls: string[][]; holdCalls: unknown[][] } {
	const releaseCalls: string[][] = [];
	const holdCalls: unknown[][] = [];
	return {
		myHolds: opts.myHolds ?? [],
		release: vi.fn(async (seatIds: string[]) => {
			releaseCalls.push(seatIds);
		}),
		holdBestAvailable: vi.fn(async (...args: unknown[]) => {
			holdCalls.push(args);
			return holdResult;
		}),
		releaseCalls,
		holdCalls
	} as unknown as SeatHoldController & { releaseCalls: string[][]; holdCalls: unknown[][] };
}

describe('holdBestAvailableGroups', () => {
	it('holds every best_available group in order, releasing each controller’s own stale holds first', async () => {
		const groupA = makeGroup({ tier: makeTier({ id: 'tier-a' }), priceCategoryId: 'zone-a' });
		const groupB = makeGroup({ tier: makeTier({ id: 'tier-b' }), priceCategoryId: 'zone-b' });

		const controllerA = fakeController(
			{ ok: true, heldSeatIds: ['s1', 's2'] },
			{ myHolds: ['stale-1'] }
		);
		const controllerB = fakeController({ ok: true, heldSeatIds: ['s3', 's4'] }, { myHolds: [] });

		const registry = new CartSeatHoldRegistry();
		registry.set('tier-a', controllerA);
		registry.set('tier-b', controllerB);

		const result = await holdBestAvailableGroups([groupA, groupB], registry, false);

		expect(result).toEqual({ ok: true });
		expect(controllerA.release).toHaveBeenCalledWith(['stale-1']);
		expect(controllerA.holdBestAvailable).toHaveBeenCalledWith('tier-a', 2, false, 'zone-a');
		expect(controllerB.release).toHaveBeenCalledWith([]);
		expect(controllerB.holdBestAvailable).toHaveBeenCalledWith('tier-b', 2, false, 'zone-b');

		// Order: A fully processed (release + hold) before B starts.
		expect(controllerA.releaseCalls.length).toBe(1);
		expect(controllerA.holdCalls.length).toBe(1);
		expect(controllerB.releaseCalls.length).toBe(1);
	});

	it('uses each group’s CURRENT priceCategoryId for the hold — the same value buildCartItems sends', async () => {
		const group = makeGroup({ tier: makeTier({ id: 'tier-a' }), priceCategoryId: 'zone-changed' });
		const controller = fakeController({ ok: true, heldSeatIds: ['s1'] });
		const registry = new CartSeatHoldRegistry();
		registry.set('tier-a', controller);

		await holdBestAvailableGroups([group], registry, false);

		expect(controller.holdBestAvailable).toHaveBeenCalledWith('tier-a', 2, false, 'zone-changed');
	});

	it('short-circuits with a failure message when a hold fails, and does not process later groups', async () => {
		const groupA = makeGroup({ tier: makeTier({ id: 'tier-a' }) });
		const groupB = makeGroup({ tier: makeTier({ id: 'tier-b' }) });

		const controllerA = fakeController({
			ok: false,
			heldSeatIds: [],
			reason: 'no_block'
		});
		const controllerB = fakeController({ ok: true, heldSeatIds: ['s1'] });

		const registry = new CartSeatHoldRegistry();
		registry.set('tier-a', controllerA);
		registry.set('tier-b', controllerB);

		const result = await holdBestAvailableGroups([groupA, groupB], registry, false);

		expect(result.ok).toBe(false);
		if (!result.ok) {
			expect(result.tierId).toBe('tier-a');
			expect(result.message).toBe('Not enough adjacent seats available — try a smaller quantity.');
		}
		expect(controllerB.release).not.toHaveBeenCalled();
		expect(controllerB.holdBestAvailable).not.toHaveBeenCalled();
	});

	it('maps a capacity conflict to the hold-limit message', async () => {
		const group = makeGroup({ tier: makeTier({ id: 'tier-a' }) });
		const controller = fakeController({ ok: false, heldSeatIds: [], reason: 'capacity' });
		const registry = new CartSeatHoldRegistry();
		registry.set('tier-a', controller);

		const result = await holdBestAvailableGroups([group], registry, false);

		expect(result).toEqual({
			ok: false,
			tierId: 'tier-a',
			message: "You've reached the seat hold limit for this event — try a smaller quantity."
		});
	});

	it('skips ALL holding when wouldSkip is true (resume case) — the reservation already owns its holds', async () => {
		const groupA = makeGroup({ tier: makeTier({ id: 'tier-a' }) });
		const controllerA = fakeController({ ok: true, heldSeatIds: ['s1'] });
		const registry = new CartSeatHoldRegistry();
		registry.set('tier-a', controllerA);

		const result = await holdBestAvailableGroups([groupA], registry, true);

		expect(result).toEqual({ ok: true });
		expect(controllerA.release).not.toHaveBeenCalled();
		expect(controllerA.holdBestAvailable).not.toHaveBeenCalled();
	});

	it('returns ok true and does nothing for an empty group list', async () => {
		const registry = new CartSeatHoldRegistry();
		const result = await holdBestAvailableGroups([], registry, false);
		expect(result).toEqual({ ok: true });
	});

	it('treats a best_available group with no registered controller as a bug and fails honestly', async () => {
		const group = makeGroup({ tier: makeTier({ id: 'tier-orphan' }) });
		const registry = new CartSeatHoldRegistry();
		// Nothing registered for 'tier-orphan'.

		const result = await holdBestAvailableGroups([group], registry, false);

		expect(result.ok).toBe(false);
		if (!result.ok) {
			expect(result.tierId).toBe('tier-orphan');
			expect(result.message.length).toBeGreaterThan(0);
		}
	});
});
