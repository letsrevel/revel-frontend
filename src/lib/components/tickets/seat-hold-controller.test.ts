import { render, waitFor } from '@testing-library/svelte';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { QueryClient } from '@tanstack/svelte-query';
import QueryClientTestWrapper from '$lib/test-utils/QueryClientTestWrapper.svelte';
import SeatHoldControllerTestHost from './SeatHoldControllerTestHost.svelte';
import type { SeatHoldController, SeatHoldControllerOptions } from './seat-hold-controller.svelte';
import {
	eventpublicseatingGetAvailability,
	eventpublicseatingGetChart,
	eventpublicseatingHoldBestAvailable,
	eventpublicseatingHoldSeats,
	eventpublicseatingReleaseSeats
} from '$lib/api/generated/sdk.gen';

// The controller imports its five ops via `$lib/api` (a re-export of the
// generated sdk), so mocking sdk.gen intercepts them all. It has no other
// sdk-touching transitive imports (seat-holds.ts uses raw fetch by design).
vi.mock('$lib/api/generated/sdk.gen', () => ({
	eventpublicseatingGetChart: vi.fn(),
	eventpublicseatingGetAvailability: vi.fn(),
	eventpublicseatingHoldSeats: vi.fn(),
	eventpublicseatingHoldBestAvailable: vi.fn(),
	eventpublicseatingReleaseSeats: vi.fn()
}));

const ANON_HOLDS_KEY = 'revel:anon-seat-holds';
const EXPIRES_AT = '2026-07-18T12:00:00Z';

/** Typed helper over the generated ops' {data, error, response} envelope. */
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

function emptyAvailability() {
	return { seats: {}, standing: {}, my_holds: [], my_holds_expire_at: null };
}

function setup(
	overrides: Partial<SeatHoldControllerOptions> = {},
	client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
): SeatHoldController {
	let controller: SeatHoldController | undefined;
	render(QueryClientTestWrapper, {
		props: {
			client,
			component: SeatHoldControllerTestHost,
			props: {
				options: {
					eventId: 'event-1',
					getQuantity: () => 2,
					isAuthenticated: () => true,
					...overrides
				} satisfies SeatHoldControllerOptions,
				onReady: (c: SeatHoldController) => {
					controller = c;
				}
			}
		}
	});
	if (!controller) throw new Error('SeatHoldController was not created during init');
	return controller;
}

describe('SeatHoldController', () => {
	beforeEach(() => {
		vi.clearAllMocks();
		window.sessionStorage.clear();
		mockResult(eventpublicseatingGetChart, {
			data: {
				venue_id: 'venue-1',
				venue_name: 'Test Hall',
				price_categories: [],
				sectors: []
			}
		});
		mockResult(eventpublicseatingGetAvailability, { data: emptyAvailability() });
		mockResult(eventpublicseatingReleaseSeats, { data: null });
	});

	it('fetches chart and availability for the event on mount', async () => {
		setup();
		await waitFor(() => {
			expect(eventpublicseatingGetChart).toHaveBeenCalledWith({
				path: { event_id: 'event-1' }
			});
			expect(eventpublicseatingGetAvailability).toHaveBeenCalledWith({
				path: { event_id: 'event-1' }
			});
		});
	});

	describe('toggleSeat', () => {
		it('holds an unheld seat and adopts the server response, then refetches availability', async () => {
			mockResult(eventpublicseatingHoldSeats, {
				data: { held_seat_ids: ['s1'], conflicts: [], expires_at: EXPIRES_AT }
			});
			const controller = setup();
			// Let the initial availability fetch settle first — a refetch issued
			// while it is in flight dedupes into it instead of calling again.
			await waitFor(() => {
				expect(controller.availabilityQuery.data).toBeDefined();
			});
			const availabilityCalls = vi.mocked(eventpublicseatingGetAvailability).mock.calls.length;

			await controller.toggleSeat('s1');

			expect(eventpublicseatingHoldSeats).toHaveBeenCalledExactlyOnceWith({
				path: { event_id: 'event-1' },
				body: { seat_ids: ['s1'] }
			});
			expect(controller.myHolds).toEqual(['s1']);
			expect(controller.holdExpiresAt).toBe(EXPIRES_AT);
			expect(controller.pendingSeatIds).toEqual([]);
			await waitFor(() => {
				expect(vi.mocked(eventpublicseatingGetAvailability).mock.calls.length).toBeGreaterThan(
					availabilityCalls
				);
			});
		});

		it('releases a held seat on the second toggle', async () => {
			mockResult(eventpublicseatingHoldSeats, {
				data: { held_seat_ids: ['s1'], conflicts: [], expires_at: EXPIRES_AT }
			});
			const controller = setup();
			await controller.toggleSeat('s1');

			await controller.toggleSeat('s1');

			expect(eventpublicseatingReleaseSeats).toHaveBeenCalledWith({
				path: { event_id: 'event-1' },
				body: { seat_ids: ['s1'] }
			});
			expect(controller.myHolds).toEqual([]);
			expect(controller.holdExpiresAt).toBeNull();
		});

		it('adopts only the tapped and already-selected seats when the server reports stale holds', async () => {
			mockResult(eventpublicseatingHoldSeats, {
				data: { held_seat_ids: ['s1'], conflicts: [], expires_at: EXPIRES_AT }
			});
			const controller = setup();
			await controller.toggleSeat('s1');

			// held_seat_ids lists ALL of the caller's live holds — including one
			// leaked from a previous session ('stale'), which must not be adopted.
			mockResult(eventpublicseatingHoldSeats, {
				data: { held_seat_ids: ['stale', 's1', 's2'], conflicts: [], expires_at: EXPIRES_AT }
			});
			await controller.toggleSeat('s2');

			expect(controller.myHolds).toEqual(['s1', 's2']);
		});

		it('keeps the seat selected when the release request fails with an HTTP error', async () => {
			mockResult(eventpublicseatingHoldSeats, {
				data: { held_seat_ids: ['s1'], conflicts: [], expires_at: EXPIRES_AT }
			});
			const controller = setup();
			await controller.toggleSeat('s1');
			mockResult(eventpublicseatingReleaseSeats, { error: { detail: 'throttled' }, status: 429 });

			await controller.toggleSeat('s1');

			// The server kept the hold, so the seat stays selected and re-tappable.
			expect(controller.myHolds).toEqual(['s1']);
			expect(controller.holdExpiresAt).toBe(EXPIRES_AT);
			expect(controller.pendingSeatIds).toEqual([]);
		});

		it('reports the conflicting seats via onConflict on a 409 and keeps the selection unchanged', async () => {
			mockResult(eventpublicseatingHoldSeats, {
				error: { held_seat_ids: [], conflicts: ['s1'], expires_at: null },
				status: 409
			});
			const onConflict = vi.fn();
			const controller = setup({ onConflict });

			await controller.toggleSeat('s1');

			expect(onConflict).toHaveBeenCalledExactlyOnceWith(['s1'], 'unavailable');
			expect(controller.myHolds).toEqual([]);
			expect(controller.pendingSeatIds).toEqual([]);
		});

		it('falls back to the tapped seat id when a 409 body carries no conflicts list', async () => {
			mockResult(eventpublicseatingHoldSeats, { error: { detail: 'conflict' }, status: 409 });
			const onConflict = vi.fn();
			const controller = setup({ onConflict });

			await controller.toggleSeat('s2');

			expect(onConflict).toHaveBeenCalledExactlyOnceWith(['s2'], 'unavailable');
		});

		it("reports reason 'capacity' when the 409 body says the hold cap was exceeded", async () => {
			mockResult(eventpublicseatingHoldSeats, {
				error: {
					held_seat_ids: [],
					conflicts: ['s1'],
					conflict_reason: 'capacity',
					expires_at: null
				},
				status: 409
			});
			const onConflict = vi.fn();
			const controller = setup({ onConflict });

			await controller.toggleSeat('s1');

			expect(onConflict).toHaveBeenCalledExactlyOnceWith(['s1'], 'capacity');
			expect(controller.myHolds).toEqual([]);
		});

		it('ignores selects beyond the current quantity', async () => {
			mockResult(eventpublicseatingHoldSeats, {
				data: { held_seat_ids: ['s1'], conflicts: [], expires_at: EXPIRES_AT }
			});
			const controller = setup({ getQuantity: () => 1 });
			await controller.toggleSeat('s1');

			await controller.toggleSeat('s2');

			expect(eventpublicseatingHoldSeats).toHaveBeenCalledTimes(1);
			expect(controller.myHolds).toEqual(['s1']);
		});

		it('survives a network failure and leaves no pending seat behind', async () => {
			vi.mocked(eventpublicseatingHoldSeats).mockRejectedValue(new TypeError('Failed to fetch'));
			const controller = setup();

			await expect(controller.toggleSeat('s1')).resolves.toBeUndefined();

			expect(controller.myHolds).toEqual([]);
			expect(controller.pendingSeatIds).toEqual([]);
		});
	});

	describe('holdBestAvailable', () => {
		it('adopts the server-picked block on success', async () => {
			mockResult(eventpublicseatingHoldBestAvailable, {
				data: { held_seat_ids: ['s1', 's2'], conflicts: [], expires_at: EXPIRES_AT }
			});
			const controller = setup();

			const result = await controller.holdBestAvailable('tier-1', 2, false);

			expect(eventpublicseatingHoldBestAvailable).toHaveBeenCalledExactlyOnceWith({
				path: { event_id: 'event-1' },
				body: { tier_id: 'tier-1', quantity: 2, accessible_required: false }
			});
			expect(result).toEqual({ ok: true, heldSeatIds: ['s1', 's2'] });
			expect(controller.myHolds).toEqual(['s1', 's2']);
			expect(controller.holdExpiresAt).toBe(EXPIRES_AT);
		});

		it('passes accessible_required through', async () => {
			mockResult(eventpublicseatingHoldBestAvailable, {
				data: { held_seat_ids: ['s9'], conflicts: [], expires_at: EXPIRES_AT }
			});
			const controller = setup();

			await controller.holdBestAvailable('tier-1', 1, true);

			expect(eventpublicseatingHoldBestAvailable).toHaveBeenCalledWith({
				path: { event_id: 'event-1' },
				body: { tier_id: 'tier-1', quantity: 1, accessible_required: true }
			});
		});

		it('surfaces the backend detail when no adjacent block fits (plain 409)', async () => {
			mockResult(eventpublicseatingHoldBestAvailable, {
				error: { detail: 'Not enough adjacent seats available for this request.' },
				status: 409
			});
			const controller = setup();

			const result = await controller.holdBestAvailable('tier-1', 4, false);

			expect(result).toEqual({
				ok: false,
				heldSeatIds: [],
				message: 'Not enough adjacent seats available for this request.',
				reason: 'unavailable'
			});
			expect(controller.myHolds).toEqual([]);
		});

		it("reports reason 'capacity' when the best-available 409 is the hold cap", async () => {
			mockResult(eventpublicseatingHoldBestAvailable, {
				error: {
					held_seat_ids: [],
					conflicts: ['s1', 's2'],
					conflict_reason: 'capacity',
					expires_at: null
				},
				status: 409
			});
			const controller = setup();

			const result = await controller.holdBestAvailable('tier-1', 4, false);

			expect(result).toEqual({
				ok: false,
				heldSeatIds: [],
				message: undefined,
				reason: 'capacity'
			});
		});

		it('fails without a message on a network error', async () => {
			vi.mocked(eventpublicseatingHoldBestAvailable).mockRejectedValue(
				new TypeError('Failed to fetch')
			);
			const controller = setup();

			const result = await controller.holdBestAvailable('tier-1', 2, false);

			expect(result).toEqual({ ok: false, heldSeatIds: [] });
		});
	});

	describe('trimTo / releaseAll', () => {
		it('trimTo releases only the newest holds beyond the kept quantity', async () => {
			mockResult(eventpublicseatingHoldBestAvailable, {
				data: { held_seat_ids: ['s1', 's2', 's3'], conflicts: [], expires_at: EXPIRES_AT }
			});
			const controller = setup({ getQuantity: () => 3 });
			await controller.holdBestAvailable('tier-1', 3, false);

			await controller.trimTo(1);

			expect(eventpublicseatingReleaseSeats).toHaveBeenCalledWith({
				path: { event_id: 'event-1' },
				body: { seat_ids: ['s2', 's3'] }
			});
			expect(controller.myHolds).toEqual(['s1']);
			expect(controller.holdExpiresAt).toBe(EXPIRES_AT);
		});

		it('trimTo removes only the released ids when holds change during the flight', async () => {
			mockResult(eventpublicseatingHoldBestAvailable, {
				data: { held_seat_ids: ['s1', 's2', 's3'], conflicts: [], expires_at: EXPIRES_AT }
			});
			// First release call (the trim's) stays in flight until we resolve it;
			// later calls fall back to the beforeEach default mock.
			let resolveTrim!: () => void;
			const deferredRelease = new Promise((resolve) => {
				resolveTrim = () => resolve({ data: null, error: undefined, response: { status: 200 } });
			});
			vi.mocked(eventpublicseatingReleaseSeats).mockImplementationOnce(
				() => deferredRelease as never
			);
			const controller = setup({ getQuantity: () => 3 });
			await controller.holdBestAvailable('tier-1', 3, false);

			const trimPromise = controller.trimTo(2); // excess = ['s3'], release in flight
			expect(controller.pendingSeatIds).toEqual(['s3']);
			await controller.toggleSeat('s1'); // concurrent untap during the trim flight
			resolveTrim();
			await trimPromise;

			// s3 was released by the trim — an index slice over the mutated holds
			// would have resurrected it.
			expect(controller.myHolds).toEqual(['s2']);
			expect(controller.pendingSeatIds).toEqual([]);
		});

		it('trimTo is a no-op when nothing exceeds the quantity', async () => {
			const controller = setup();
			await controller.trimTo(2);
			expect(eventpublicseatingReleaseSeats).not.toHaveBeenCalled();
		});

		it('releaseAll releases without seat_ids (everything server-side) and clears local state', async () => {
			mockResult(eventpublicseatingHoldSeats, {
				data: { held_seat_ids: ['s1'], conflicts: [], expires_at: EXPIRES_AT }
			});
			const controller = setup();
			await controller.toggleSeat('s1');

			await controller.releaseAll();

			expect(eventpublicseatingReleaseSeats).toHaveBeenCalledWith({
				path: { event_id: 'event-1' }
			});
			expect(controller.myHolds).toEqual([]);
			expect(controller.holdExpiresAt).toBeNull();
		});

		it('releaseAll patches the cached availability so a reopen cannot seed stale my_holds', async () => {
			mockResult(eventpublicseatingGetAvailability, {
				data: {
					seats: { s1: 'held' },
					standing: {},
					my_holds: ['s1'],
					my_holds_expire_at: EXPIRES_AT
				}
			});
			const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
			const controller = setup({}, client);
			await waitFor(() => {
				expect(controller.availabilityQuery.data).toBeDefined();
			});
			// Keep the post-release refetch in flight — the cache patch must be
			// synchronous, not dependent on the refetch landing.
			vi.mocked(eventpublicseatingGetAvailability).mockImplementation(
				// eslint-disable-next-line @typescript-eslint/no-empty-function -- never-resolving promise
				() => new Promise(() => {}) as never
			);

			await controller.releaseAll();

			const cached = client.getQueryData<{
				my_holds: string[];
				my_holds_expire_at: string | null;
			}>(['seating-availability', 'event-1']);
			expect(cached?.my_holds).toEqual([]);
			expect(cached?.my_holds_expire_at).toBeNull();
		});
	});

	describe('anonymous hold registry', () => {
		it('records the event on hold and clears it on releaseAll when anonymous', async () => {
			mockResult(eventpublicseatingHoldSeats, {
				data: { held_seat_ids: ['s1'], conflicts: [], expires_at: EXPIRES_AT }
			});
			const controller = setup({ isAuthenticated: () => false });

			await controller.toggleSeat('s1');
			expect(window.sessionStorage.getItem(ANON_HOLDS_KEY)).toContain('event-1');

			await controller.releaseAll();
			expect(window.sessionStorage.getItem(ANON_HOLDS_KEY) ?? '[]').not.toContain('event-1');
		});

		it('does not record authenticated holds', async () => {
			mockResult(eventpublicseatingHoldSeats, {
				data: { held_seat_ids: ['s1'], conflicts: [], expires_at: EXPIRES_AT }
			});
			const controller = setup({ isAuthenticated: () => true });

			await controller.toggleSeat('s1');

			expect(window.sessionStorage.getItem(ANON_HOLDS_KEY)).toBeNull();
		});
	});

	describe('seedFromAvailability', () => {
		it('adopts my_holds restricted to valid seats and capped to quantity', async () => {
			mockResult(eventpublicseatingGetAvailability, {
				data: {
					seats: { s1: 'held', s2: 'held', s3: 'held', foreign: 'held' },
					standing: {},
					my_holds: ['s1', 's2', 's3', 'other-sector'],
					my_holds_expire_at: EXPIRES_AT
				}
			});
			const controller = setup({ getQuantity: () => 2 });
			await waitFor(() => {
				expect(controller.availabilityQuery.data).toBeDefined();
			});

			controller.seedFromAvailability(new Set(['s1', 's2', 's3']));

			// 'other-sector' filtered out, then capped to quantity 2.
			expect(controller.myHolds).toEqual(['s1', 's2']);
			expect(controller.holdExpiresAt).toBe(EXPIRES_AT);
		});
	});
});
