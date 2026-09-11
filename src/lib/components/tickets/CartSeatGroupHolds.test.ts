import { render } from '@testing-library/svelte';
import { tick } from 'svelte';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { QueryClient } from '@tanstack/svelte-query';
import QueryClientTestWrapper from '$lib/test-utils/QueryClientTestWrapper.svelte';
import CartSeatGroupHolds from './CartSeatGroupHolds.svelte';
import { EventCart, type CartGroup } from './cart.svelte';
import { CartSeatHoldRegistry } from './cart-seat-registry.svelte';
import type { TierSchemaWithId } from '$lib/types/tickets';
import type { SeatingAvailabilitySchema, VenueChartSchema } from '$lib/api/generated/types.gen';
import {
	eventpublicseatingGetAvailability,
	eventpublicseatingGetChart,
	eventpublicseatingHoldBestAvailable,
	eventpublicseatingHoldSeats,
	eventpublicseatingReleaseSeats
} from '$lib/api/generated/sdk.gen';

// The controller behind this component reaches the backend only through the
// generated sdk (re-exported by `$lib/api`), so mocking sdk.gen intercepts
// every call it can make — including the fire-and-forget availability refetch
// this test deliberately leaves unresolved-until-late.
vi.mock('$lib/api/generated/sdk.gen', () => ({
	eventpublicseatingGetChart: vi.fn(),
	eventpublicseatingGetAvailability: vi.fn(),
	eventpublicseatingHoldSeats: vi.fn(),
	eventpublicseatingHoldBestAvailable: vi.fn(),
	eventpublicseatingReleaseSeats: vi.fn()
}));

const EVENT_ID = 'event-1';
const SECTOR_ID = 'sector-1';
const SEAT_ID = 'seat-1';

function mockResult<T extends (...args: never[]) => unknown>(
	op: T,
	result: { data?: unknown; error?: unknown; status?: number }
) {
	vi.mocked(op).mockResolvedValue({
		data: result.data,
		error: result.error,
		response: { status: result.status ?? (result.error === undefined ? 200 : 409) }
	} as never);
}

function chart(): VenueChartSchema {
	return {
		venue_id: 'venue-1',
		venue_name: 'Test Hall',
		price_categories: [],
		sectors: [
			{
				id: SECTOR_ID,
				name: 'Stalls',
				kind: 'seated',
				seats: [{ id: SEAT_ID, label: 'A1', row_label: 'A', number: 1, is_active: true }]
			}
		]
	} as unknown as VenueChartSchema;
}

function availability(myHolds: string[]): SeatingAvailabilitySchema {
	return {
		seats: {},
		standing: {},
		my_holds: myHolds,
		my_holds_expire_at: myHolds.length > 0 ? '2026-09-12T12:00:00Z' : null
	} as unknown as SeatingAvailabilitySchema;
}

function seatedTier(): TierSchemaWithId {
	return {
		id: 'tier-1',
		name: 'Seated',
		payment_method: 'offline',
		price_type: 'fixed',
		seat_assignment_mode: 'user_choice',
		currency: 'EUR',
		price: '20.00',
		total_available: 100,
		sector: { id: SECTOR_ID, name: 'Stalls' }
	} as unknown as TierSchemaWithId;
}

/**
 * Mount the host over a query cache that ALREADY holds a chart + availability
 * snapshot, exactly as the seat picker leaves it: both queries are warm, so a
 * freshly mounted controller gets them synchronously on its very first flush.
 */
function mountGroup(snapshotHolds: string[], groupSeatIds: string[]) {
	const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
	client.setQueryData(['seating-chart', EVENT_ID], chart());
	client.setQueryData(['seating-availability', EVENT_ID], availability(snapshotHolds));

	const cart = new EventCart({ remainingFor: () => undefined, eventRemaining: () => null });
	const tier = seatedTier();
	cart.setSeatIds(tier, groupSeatIds);
	const group = cart.groupFor(tier.id) as CartGroup;

	const registry = new CartSeatHoldRegistry();
	render(QueryClientTestWrapper, {
		props: {
			client,
			component: CartSeatGroupHolds,
			componentProps: { cart, registry, eventId: EVENT_ID, group }
		}
	});
	return { cart, tier, registry };
}

/** Let the mount's effects (seed → live-sync) and the refetch microtasks run. */
async function settle(): Promise<void> {
	await tick();
	await new Promise((resolve) => setTimeout(resolve, 0));
	await tick();
}

describe('CartSeatGroupHolds', () => {
	beforeEach(() => {
		vi.clearAllMocks();
		mockResult(eventpublicseatingGetChart, { data: chart() });
		mockResult(eventpublicseatingReleaseSeats, { data: null });
	});

	// #918 regression. The picker's Done writes the group and closes in the same
	// flush that mounts THIS component, whose fresh controller seeds from the
	// warm availability entry — which is routinely still the PRE-hold snapshot,
	// because the picker's post-tap refetch is fire-and-forget and the query has
	// no staleTime. Before the fix, that seed produced `myHolds === []`, the
	// live-sync effect wrote it through as `cart.setSeatIds(tier, [])` — which
	// DELETES the group — and the deletion unmounted the only component that
	// could have repaired it once the refetch landed.
	it('never deletes the group it was mounted for when the seeded snapshot is pre-hold', async () => {
		// The in-flight refetch is still returning the stale payload: the worst
		// case, where nothing arrives to repair a bad seed.
		mockResult(eventpublicseatingGetAvailability, { data: availability([]) });

		const { cart, tier, registry } = mountGroup([], [SEAT_ID]);
		await settle();

		expect(cart.groupFor(tier.id)?.seatIds).toEqual([SEAT_ID]);
		expect(cart.groupFor(tier.id)?.quantity).toBe(1);
		// Not a vacuous pass: the controller having adopted the group's known
		// seat proves the seed effect really ran during the flush above (a seed
		// that never ran would leave `myHolds` empty). It also proves the
		// controller now OWNS the seat, so its teardown releases it instead of
		// leaking the hold for the full server-side TTL.
		expect(registry.get(tier.id)?.myHolds).toEqual([SEAT_ID]);
	});

	// The residual the seed-side union CANNOT cover, so this pins the live-sync
	// gate on its own: the group's seat is absent from the chart this controller
	// mounted onto (a narrower/staler `['seating-chart', eventId]` entry), so it
	// is filtered out of `validSeatIds` and the union has nothing to keep. The
	// seed still produces `[]` — and the group must STILL survive it.
	it('never deletes the group when the warm chart does not list its seat either', async () => {
		mockResult(eventpublicseatingGetAvailability, { data: availability([]) });

		const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
		const narrowChart = chart();
		// Same sector, different seat — nothing the group claims is selectable.
		narrowChart.sectors = [
			{
				id: SECTOR_ID,
				name: 'Stalls',
				kind: 'seated',
				seats: [{ id: 'seat-other', label: 'A2', row_label: 'A', number: 2, is_active: true }]
			}
		] as unknown as VenueChartSchema['sectors'];
		client.setQueryData(['seating-chart', EVENT_ID], narrowChart);
		client.setQueryData(['seating-availability', EVENT_ID], availability([]));
		mockResult(eventpublicseatingGetChart, { data: narrowChart });

		const cart = new EventCart({ remainingFor: () => undefined, eventRemaining: () => null });
		const tier = seatedTier();
		cart.setSeatIds(tier, [SEAT_ID]);
		const registry = new CartSeatHoldRegistry();
		render(QueryClientTestWrapper, {
			props: {
				client,
				component: CartSeatGroupHolds,
				componentProps: {
					cart,
					registry,
					eventId: EVENT_ID,
					group: cart.groupFor(tier.id) as CartGroup
				}
			}
		});
		await settle();

		expect(cart.groupFor(tier.id)?.seatIds).toEqual([SEAT_ID]);
	});

	it('keeps the group and adopts the seat when the snapshot already reports the hold', async () => {
		mockResult(eventpublicseatingGetAvailability, { data: availability([SEAT_ID]) });

		const { cart, tier, registry } = mountGroup([SEAT_ID], [SEAT_ID]);
		await settle();

		expect(cart.groupFor(tier.id)?.seatIds).toEqual([SEAT_ID]);
		expect(registry.get(tier.id)?.myHolds).toEqual([SEAT_ID]);
	});

	it('does not invent seats for a group that carries none', async () => {
		mockResult(eventpublicseatingGetAvailability, { data: availability([]) });

		// A group with no seat ids can't be created through `setSeatIds`, so this
		// mounts the host directly against a hand-built group — the shape the
		// expiry sweep leaves behind before it drops the group.
		const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
		client.setQueryData(['seating-chart', EVENT_ID], chart());
		client.setQueryData(['seating-availability', EVENT_ID], availability([]));
		const cart = new EventCart({ remainingFor: () => undefined, eventRemaining: () => null });
		const tier = seatedTier();
		const group: CartGroup = {
			tier,
			quantity: 1,
			guestNames: [],
			pwycAmount: null,
			priceCategoryId: null,
			accessibleRequired: false,
			seatIds: []
		};
		const registry = new CartSeatHoldRegistry();
		render(QueryClientTestWrapper, {
			props: {
				client,
				component: CartSeatGroupHolds,
				componentProps: { cart, registry, eventId: EVENT_ID, group }
			}
		});
		await settle();

		expect(registry.get(tier.id)?.myHolds).toEqual([]);
		expect(cart.isEmpty).toBe(true);
	});
});

// Keeps the unused-import lint quiet for ops the component can reach but this
// suite never drives; they still need to exist on the mocked module.
void eventpublicseatingHoldSeats;
void eventpublicseatingHoldBestAvailable;
