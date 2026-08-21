import { describe, it, expect, vi } from 'vitest';
import {
	holdBestAvailableGroups,
	releaseJoinBlockedHolds,
	joinBlockMessage,
	submitCart,
	type CartSubmitController,
	type SubmitCartHandlers
} from './cart-ba-holds';
import { EventCart } from './cart.svelte';
import type { CartGroup } from './cart.svelte';
import type { TierSchemaWithId } from '$lib/types/tickets';
import type { SeatHoldController } from './seat-hold-controller.svelte';
import type { BestAvailableHoldResult } from './seat-hold-controller.svelte';
import { releaseOrphanedSeatHolds } from './seat-hold-controller.svelte';
import { CartSeatHoldRegistry } from './cart-seat-registry.svelte';

// `releaseJoinBlockedHolds` fires a one-shot network call via this module —
// mock it to assert on WHAT gets released without touching the SDK.
vi.mock('./seat-hold-controller.svelte', () => ({
	releaseOrphanedSeatHolds: vi.fn()
}));

const noLimits = { remainingFor: () => undefined, eventRemaining: () => null };

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

describe('releaseJoinBlockedHolds', () => {
	it('returns null and releases nothing when heldSeatIds is empty', () => {
		const cart = new EventCart(noLimits);
		const tier = makeTier();
		expect(releaseJoinBlockedHolds(cart, tier, [], 'event-1')).toBeNull();
		expect(releaseOrphanedSeatHolds).not.toHaveBeenCalled();
	});

	it('returns null and releases nothing when the group was created fine', () => {
		const cart = new EventCart(noLimits);
		const tier = makeTier({ seat_assignment_mode: 'user_choice' });
		cart.setSeatIds(tier, ['s1', 's2']); // no join-block: first group in an empty cart
		expect(releaseJoinBlockedHolds(cart, tier, ['s1', 's2'], 'event-1')).toBeNull();
		expect(releaseOrphanedSeatHolds).not.toHaveBeenCalled();
	});

	it('returns the block reason and releases the leaked holds on a currency mismatch', () => {
		const cart = new EventCart(noLimits);
		cart.setQuantity(makeTier({ currency: 'USD' }), 1); // seeds the cart's currency
		const tier = makeTier({ seat_assignment_mode: 'user_choice', currency: 'EUR' });

		cart.setSeatIds(tier, ['s1']); // no-ops: joinBlock refuses the group
		expect(cart.groupFor(tier.id)).toBeUndefined();

		const block = releaseJoinBlockedHolds(cart, tier, ['s1'], 'event-1');

		expect(block).toBe('currency');
		expect(releaseOrphanedSeatHolds).toHaveBeenCalledWith('event-1', ['s1']);
	});

	it('returns the block reason and releases the leaked holds on a payment-method mismatch', () => {
		const cart = new EventCart(noLimits);
		cart.setQuantity(makeTier({ payment_method: 'online' }), 1);
		const tier = makeTier({ seat_assignment_mode: 'user_choice', payment_method: 'at_the_door' });

		cart.setSeatIds(tier, ['s1']);

		const block = releaseJoinBlockedHolds(cart, tier, ['s1'], 'event-1');

		expect(block).toBe('payment_method');
		expect(releaseOrphanedSeatHolds).toHaveBeenCalledWith('event-1', ['s1']);
	});
});

describe('joinBlockMessage', () => {
	it('has distinct text for currency vs payment_method', () => {
		const currency = joinBlockMessage('currency');
		const paymentMethod = joinBlockMessage('payment_method');
		expect(currency.length).toBeGreaterThan(0);
		expect(paymentMethod.length).toBeGreaterThan(0);
		expect(currency).not.toBe(paymentMethod);
	});
});

describe('submitCart', () => {
	function fakeSubmitController(
		overrides: Partial<CartSubmitController> = {}
	): CartSubmitController & { checkoutCart: ReturnType<typeof vi.fn> } {
		return {
			wouldResume: vi.fn(() => false),
			checkoutCart: vi.fn(async () => undefined),
			isPending: false,
			...overrides
		} as CartSubmitController & { checkoutCart: ReturnType<typeof vi.fn> };
	}

	function fakeDeps(overrides: { cart?: EventCart; controller?: CartSubmitController } = {}) {
		let holding = false;
		return {
			cart: overrides.cart ?? new EventCart(noLimits),
			registry: new CartSeatHoldRegistry(),
			controller: overrides.controller ?? fakeSubmitController(),
			isHolding: () => holding,
			setHolding: (value: boolean) => {
				holding = value;
			}
		};
	}

	const noopHandlers: SubmitCartHandlers = { onHoldFailure: vi.fn() };

	it('short-circuits (false) when already holding, without touching the controller', async () => {
		const controller = fakeSubmitController();
		const deps = fakeDeps({ controller });
		deps.setHolding(true);

		const result = await submitCart({ items: [] }, deps, noopHandlers);

		expect(result).toBe(false);
		expect(controller.checkoutCart).not.toHaveBeenCalled();
	});

	it('short-circuits (false) when the controller mutation is already pending', async () => {
		const controller = fakeSubmitController({ isPending: true });
		const deps = fakeDeps({ controller });

		const result = await submitCart({ items: [] }, deps, noopHandlers);

		expect(result).toBe(false);
		expect(controller.checkoutCart).not.toHaveBeenCalled();
	});

	it('holds every best_available group, checks out, and returns true on success', async () => {
		const controller = fakeSubmitController();
		const cart = new EventCart(noLimits);
		const tier = makeTier({ id: 'tier-ba', seat_assignment_mode: 'best_available' });
		cart.setQuantity(tier, 2);
		const deps = fakeDeps({ cart, controller });
		const baController = {
			myHolds: [],
			release: vi.fn(async () => undefined),
			holdBestAvailable: vi.fn(async () => ({ ok: true, heldSeatIds: ['s1', 's2'] }))
		} as unknown as SeatHoldController;
		deps.registry.set('tier-ba', baController);

		const result = await submitCart({ items: [] }, deps, noopHandlers);

		expect(result).toBe(true);
		expect(baController.holdBestAvailable).toHaveBeenCalled();
		expect(controller.checkoutCart).toHaveBeenCalledWith({ items: [] });
		expect(deps.isHolding()).toBe(false); // reset in `finally`
	});

	it('skips re-holding when the controller would resume, and still checks out', async () => {
		const controller = fakeSubmitController({ wouldResume: vi.fn(() => true) });
		const cart = new EventCart(noLimits);
		const tier = makeTier({ id: 'tier-ba', seat_assignment_mode: 'best_available' });
		cart.setQuantity(tier, 2);
		const deps = fakeDeps({ cart, controller });
		const baController = {
			myHolds: [],
			release: vi.fn(async () => undefined),
			holdBestAvailable: vi.fn(async () => ({ ok: true, heldSeatIds: [] }))
		} as unknown as SeatHoldController;
		deps.registry.set('tier-ba', baController);

		const result = await submitCart({ items: [] }, deps, noopHandlers);

		expect(result).toBe(true);
		expect(baController.holdBestAvailable).not.toHaveBeenCalled();
		expect(controller.checkoutCart).toHaveBeenCalled();
	});

	it('reports a hold failure via onHoldFailure, resets holding, and never checks out', async () => {
		const controller = fakeSubmitController();
		const cart = new EventCart(noLimits);
		const tier = makeTier({ id: 'tier-ba', seat_assignment_mode: 'best_available' });
		cart.setQuantity(tier, 2);
		const deps = fakeDeps({ cart, controller });
		const baController = {
			myHolds: [],
			release: vi.fn(async () => undefined),
			holdBestAvailable: vi.fn(async () => ({ ok: false, heldSeatIds: [], reason: 'no_block' }))
		} as unknown as SeatHoldController;
		deps.registry.set('tier-ba', baController);
		const onHoldFailure = vi.fn();

		const result = await submitCart({ items: [] }, deps, { onHoldFailure });

		expect(result).toBe(false);
		expect(onHoldFailure).toHaveBeenCalledWith(expect.any(String));
		expect(controller.checkoutCart).not.toHaveBeenCalled();
		expect(deps.isHolding()).toBe(false);
	});

	it('reports a checkoutCart error via onError, resets holding, and returns false', async () => {
		const controller = fakeSubmitController({
			checkoutCart: vi.fn(async () => {
				throw new Error('network down');
			})
		});
		const deps = fakeDeps({ controller });
		const onError = vi.fn();

		const result = await submitCart({ items: [] }, deps, { onHoldFailure: vi.fn(), onError });

		expect(result).toBe(false);
		expect(onError).toHaveBeenCalledWith(expect.any(Error));
		expect(deps.isHolding()).toBe(false);
	});

	it('swallows a checkoutCart error silently when onError is omitted', async () => {
		const controller = fakeSubmitController({
			checkoutCart: vi.fn(async () => {
				throw new Error('network down');
			})
		});
		const deps = fakeDeps({ controller });

		const result = await submitCart({ items: [] }, deps, { onHoldFailure: vi.fn() });

		expect(result).toBe(false);
		expect(deps.isHolding()).toBe(false);
	});
});
