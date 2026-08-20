import { describe, it, expect } from 'vitest';
import { CartSeatHoldRegistry } from './cart-seat-registry.svelte';
import type { SeatHoldController } from './seat-hold-controller.svelte';

/** Minimal fake — only the shape `CartSeatHoldRegistry` actually reads. */
function fakeController(myHoldsExpireAt: string | null | undefined): SeatHoldController {
	return {
		availabilityQuery: { data: { my_holds_expire_at: myHoldsExpireAt } }
	} as unknown as SeatHoldController;
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
});
