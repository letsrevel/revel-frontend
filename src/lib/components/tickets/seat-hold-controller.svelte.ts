/**
 * Rune-based seat-hold controller for the purchase dialogs (#657, seating phase 1).
 *
 * Owns the seating chart + availability queries and the caller's server-side
 * TTL seat holds ("selection state IS the server hold"). Must be instantiated
 * during component initialization (it calls `createQuery`/`useQueryClient`).
 *
 * Identity: hold/release calls go through the shared SDK client, so they carry
 * the Bearer token when authenticated, or the signed httpOnly guest cookie when
 * anonymous (minted automatically by the backend on the first hold;
 * `credentials: 'include'` is global in src/lib/api/client.ts). Anonymous holds
 * are tracked via the seat-holds registry so login can release them.
 */
import {
	createQuery,
	useQueryClient,
	type CreateQueryResult,
	type QueryClient
} from '@tanstack/svelte-query';
import {
	eventpublicseatingGetAvailability,
	eventpublicseatingGetChart,
	eventpublicseatingHoldBestAvailable,
	eventpublicseatingHoldSeats,
	eventpublicseatingReleaseSeats
} from '$lib/api';
import type {
	HoldConflictReason,
	HoldResponseSchema,
	SeatingAvailabilitySchema,
	VenueChartSchema
} from '$lib/api/generated/types.gen';
import { clearAnonymousHoldRecord, recordAnonymousHold } from '$lib/utils/seat-holds';

export interface SeatHoldControllerOptions {
	/** The event whose seating is being sold. */
	eventId: string;
	/** Current desired ticket quantity (the counter the taps drive). */
	getQuantity: () => number;
	/** Hard purchase ceiling (tier/user/event limits) — taps never grow past it. */
	getMaxQuantity: () => number;
	/**
	 * Selecting seats DRIVES the counter: called when a tap (or a seeded
	 * reload selection) needs the quantity raised to `next` (≤ max). The
	 * consumer must update the state `getQuantity` reads — synchronously.
	 */
	onAutoGrowQuantity: (next: number) => void;
	/** Whether the buyer is authenticated (anon holds are registry-tracked). */
	isAuthenticated: () => boolean;
	/** Called with the conflicting seat ids after a 409 (availability already refetching). */
	onConflict?: (seatIds: string[], reason: HoldConflictReason) => void;
}

/**
 * Why a hold 409'd (unified HoldResponseSchema.conflict_reason): 'capacity' =
 * the caller already holds too many seats for this event (per-identity cap),
 * 'unavailable' = seats taken/blocked/invalid, 'no_block' = best-available
 * found no adjacent block that fits the request. Re-exported from the
 * generated client so value drift is a compile error, not a silent fallback.
 */
export type { HoldConflictReason };

/**
 * Every generated conflict reason, as a Record so adding a value to the
 * backend enum fails compilation here until the handling is reviewed.
 */
const KNOWN_CONFLICT_REASONS: Record<HoldConflictReason, true> = {
	capacity: true,
	unavailable: true,
	no_block: true
};

export interface BestAvailableHoldResult {
	ok: boolean;
	heldSeatIds: string[];
	/** Backend `detail`, kept defensively (the unified 409 body carries none). */
	message?: string;
	/** Failure discriminator from the unified 409 body's conflict_reason. */
	reason?: HoldConflictReason;
}

const CHART_STALE_TIME_MS = 5 * 60 * 1000;

/**
 * Read a string `detail` off an unknown error body. Kept defensively: the
 * unified hold 409s carry conflict_reason instead of a plain detail now.
 */
function detailFrom(error: unknown): string | undefined {
	if (typeof error === 'object' && error !== null && 'detail' in error) {
		const { detail } = error as { detail: unknown };
		if (typeof detail === 'string' && detail) return detail;
	}
	return undefined;
}

/** Read the conflicts list off an unknown 409 body, defensively. */
function conflictsFrom(error: unknown): string[] {
	if (typeof error === 'object' && error !== null && 'conflicts' in error) {
		const { conflicts } = error as HoldResponseSchema;
		if (Array.isArray(conflicts)) {
			return conflicts.filter((id): id is string => typeof id === 'string');
		}
	}
	return [];
}

/** Read conflict_reason off an unknown 409 body; unknown/absent means unavailable. */
function conflictReasonFrom(error: unknown): HoldConflictReason {
	if (typeof error === 'object' && error !== null && 'conflict_reason' in error) {
		const { conflict_reason } = error as HoldResponseSchema;
		if (conflict_reason && conflict_reason in KNOWN_CONFLICT_REASONS) {
			return conflict_reason;
		}
	}
	return 'unavailable';
}

export class SeatHoldController {
	/** Seat geometry/labels/price categories — changes rarely, cached 5 min. */
	readonly chartQuery: CreateQueryResult<VenueChartSchema, Error>;
	/** Sparse seat statuses + the caller's own holds — refetched after every mutation. */
	readonly availabilityQuery: CreateQueryResult<SeatingAvailabilitySchema, Error>;

	/** Seat ids currently held by the caller (selection order preserved). */
	myHolds = $state<string[]>([]);
	/** Seat ids with an in-flight hold/release request. */
	pendingSeatIds = $state<string[]>([]);
	/** Expiry of the caller's holds (ISO string from the backend), if any. */
	holdExpiresAt = $state<string | null>(null);

	#opts: SeatHoldControllerOptions;
	#queryClient: QueryClient;
	/** Seat ids the consumer considers selectable (set by seedFromAvailability). */
	#validSeatIds: Set<string> | null = null;

	constructor(opts: SeatHoldControllerOptions) {
		this.#opts = opts;
		this.#queryClient = useQueryClient();

		this.chartQuery = createQuery<VenueChartSchema, Error>(() => ({
			queryKey: ['seating-chart', opts.eventId],
			staleTime: CHART_STALE_TIME_MS,
			queryFn: async () => {
				const response = await eventpublicseatingGetChart({
					path: { event_id: opts.eventId }
				});
				if (response.error !== undefined || !response.data) {
					throw new Error('Failed to load seating chart');
				}
				return response.data;
			}
		}));

		this.availabilityQuery = createQuery<SeatingAvailabilitySchema, Error>(() => ({
			queryKey: ['seating-availability', opts.eventId],
			queryFn: async () => {
				const response = await eventpublicseatingGetAvailability({
					path: { event_id: opts.eventId }
				});
				if (response.error !== undefined || !response.data) {
					throw new Error('Failed to load seat availability');
				}
				this.#refetchChartIfStale(response.data.chart_updated_at);
				return response.data;
			}
		}));
	}

	/**
	 * Adopt the server's list of held seats, preserving local selection order
	 * for seats that were already held and appending new ones.
	 */
	#reconcileHolds(heldSeatIds: string[], expiresAt: string | null | undefined): void {
		const held = this.#validSeatIds
			? heldSeatIds.filter((id) => this.#validSeatIds?.has(id))
			: heldSeatIds;
		// eslint-disable-next-line svelte/prefer-svelte-reactivity -- not reactive state: local lookup set built and consumed synchronously within this method
		const heldSet = new Set(held);
		const kept = this.myHolds.filter((id) => heldSet.has(id));
		const added = held.filter((id) => !this.myHolds.includes(id));
		this.myHolds = [...kept, ...added];
		this.holdExpiresAt = this.myHolds.length > 0 ? (expiresAt ?? null) : null;
	}

	/**
	 * Availability echoes the chart's `updated_at` (#668): a stale chart used to
	 * mean wrong colours, with per-seat-category pricing it means wrong PRICES.
	 * When the echo moves past the cached chart, invalidate it — TanStack
	 * refetches the active chart query immediately, bypassing its staleTime.
	 */
	#refetchChartIfStale(chartUpdatedAt: string | null | undefined): void {
		if (!chartUpdatedAt) return;
		const chart = this.#queryClient.getQueryData<VenueChartSchema>([
			'seating-chart',
			this.#opts.eventId
		]);
		if (!chart?.updated_at || chart.updated_at === chartUpdatedAt) return;
		void this.#queryClient.invalidateQueries({
			queryKey: ['seating-chart', this.#opts.eventId]
		});
	}

	#recordAnonymousHoldIfNeeded(): void {
		if (!this.#opts.isAuthenticated()) {
			recordAnonymousHold(this.#opts.eventId);
		}
	}

	#refetchAvailability(): void {
		void this.availabilityQuery.refetch();
	}

	/**
	 * Adopt the caller's server-side holds after an availability (re)load.
	 * Restricted to the consumer's selectable seats and capped to the MAX
	 * purchasable quantity — NOT the current counter, which resets to 1 on a
	 * page reload: capping there rendered the buyer's own surviving holds as
	 * foreign "held by someone else" seats. The counter is grown to match the
	 * adopted selection instead (taps drive the counter, and so does a
	 * restored selection). Holds beyond the max are left to expire server-side.
	 */
	seedFromAvailability = (validSeatIds: Set<string>): void => {
		this.#validSeatIds = validSeatIds;
		const availability = this.availabilityQuery.data;
		if (!availability) return;
		const max = Math.max(1, this.#opts.getMaxQuantity());
		const mine = (availability.my_holds ?? []).filter((id) => validSeatIds.has(id)).slice(0, max);
		this.myHolds = mine;
		this.holdExpiresAt = this.myHolds.length > 0 ? (availability.my_holds_expire_at ?? null) : null;
		if (mine.length > this.#opts.getQuantity()) {
			this.#opts.onAutoGrowQuantity(mine.length);
		}
	};

	/**
	 * Hold-on-tap toggle. Selecting POSTs a hold (all-or-nothing; a 409 calls
	 * onConflict with the conflicting seat ids); deselecting releases the hold.
	 * Serialized per seat: taps on a pending seat are ignored. Selecting past
	 * the current counter GROWS it (taps drive the counter) — only the max
	 * purchasable quantity is a hard stop.
	 */
	toggleSeat = async (seatId: string): Promise<void> => {
		if (this.pendingSeatIds.includes(seatId)) return;
		const isMine = this.myHolds.includes(seatId);
		if (!isMine && this.myHolds.length >= this.#opts.getQuantity()) {
			if (this.myHolds.length >= this.#opts.getMaxQuantity()) return;
			this.#opts.onAutoGrowQuantity(this.myHolds.length + 1);
		}

		this.pendingSeatIds = [...this.pendingSeatIds, seatId];
		try {
			if (isMine) {
				const response = await eventpublicseatingReleaseSeats({
					path: { event_id: this.#opts.eventId },
					body: { seat_ids: [seatId] }
				});
				// On an HTTP error the server kept the hold — keep the seat 'mine'
				// (still re-tappable) instead of stranding it as held-by-other.
				if (response.error === undefined) {
					this.myHolds = this.myHolds.filter((id) => id !== seatId);
					if (this.myHolds.length === 0) this.holdExpiresAt = null;
				}
			} else {
				const response = await eventpublicseatingHoldSeats({
					path: { event_id: this.#opts.eventId },
					body: { seat_ids: [seatId] }
				});
				if (response.data !== undefined && response.error === undefined) {
					// held_seat_ids lists ALL of the caller's live holds, including
					// stale ones leaked from a previous session. Adopt only the tapped
					// seat plus seats already selected locally (prune semantics kept);
					// stale holds stay server-side to expire, like seedFromAvailability.
					const serverHeld = response.data.held_seat_ids ?? [seatId];
					this.#reconcileHolds(
						serverHeld.filter((id) => id === seatId || this.myHolds.includes(id)),
						response.data.expires_at
					);
					this.#recordAnonymousHoldIfNeeded();
				} else {
					const conflicts = conflictsFrom(response.error);
					this.#opts.onConflict?.(
						conflicts.length > 0 ? conflicts : [seatId],
						conflictReasonFrom(response.error)
					);
				}
			}
		} catch {
			// Network failure: leave state as-is; the refetch below reconciles.
		} finally {
			this.pendingSeatIds = this.pendingSeatIds.filter((id) => id !== seatId);
			this.#refetchAvailability();
		}
	};

	/**
	 * Hold the best adjacent block for a tier (best_available mode). The held
	 * seats are adopted as the caller's selection, but consumers must NOT send
	 * seat_ids at purchase — the backend consumes the buyer's live holds.
	 *
	 * `priceCategoryId` is the buyer's chosen zone: MANDATORY on a mapped tier
	 * (non-empty `category_prices`, single-zone included), must stay null on an
	 * unmapped one — the backend 400s on a missing, unknown, or uninvited zone
	 * rather than guessing.
	 */
	holdBestAvailable = async (
		tierId: string,
		quantity: number,
		accessibleRequired: boolean,
		priceCategoryId: string | null
	): Promise<BestAvailableHoldResult> => {
		try {
			const response = await eventpublicseatingHoldBestAvailable({
				path: { event_id: this.#opts.eventId },
				body: {
					tier_id: tierId,
					quantity,
					accessible_required: accessibleRequired,
					price_category_id: priceCategoryId
				}
			});
			if (response.data !== undefined && response.error === undefined) {
				const held = response.data.held_seat_ids ?? [];
				// Server-picked block: bypass the consumer's selectable-seat filter.
				this.myHolds = held;
				this.holdExpiresAt = held.length > 0 ? (response.data.expires_at ?? null) : null;
				this.#recordAnonymousHoldIfNeeded();
				return { ok: true, heldSeatIds: held };
			}
			return {
				ok: false,
				heldSeatIds: [],
				message: detailFrom(response.error),
				reason: conflictReasonFrom(response.error)
			};
		} catch {
			return { ok: false, heldSeatIds: [] };
		} finally {
			this.#refetchAvailability();
		}
	};

	/**
	 * Release ALL of the caller's holds for this event (no seat_ids = release
	 * everything server-side). Local state is cleared even if the request fails
	 * (holds expire server-side anyway).
	 */
	releaseAll = async (): Promise<void> => {
		try {
			await eventpublicseatingReleaseSeats({ path: { event_id: this.#opts.eventId } });
		} catch {
			// Best-effort: unreleased holds expire within minutes.
		}
		this.myHolds = [];
		this.pendingSeatIds = [];
		this.holdExpiresAt = null;
		// Patch the cached availability synchronously so a dialog reopen can't
		// seed phantom selections from pre-release my_holds while the refetch
		// is still in flight.
		this.#queryClient.setQueryData<SeatingAvailabilitySchema>(
			['seating-availability', this.#opts.eventId],
			(old) => (old ? { ...old, my_holds: [], my_holds_expire_at: null } : old)
		);
		if (!this.#opts.isAuthenticated()) {
			clearAnonymousHoldRecord(this.#opts.eventId);
		}
		this.#refetchAvailability();
	};

	/** Release the newest holds beyond the given quantity (quantity decreased). */
	trimTo = async (quantity: number): Promise<void> => {
		const keep = Math.max(0, quantity);
		const excess = this.myHolds.slice(keep);
		if (excess.length === 0) return;
		// Block taps on the seats being trimmed while the release is in flight.
		this.pendingSeatIds = [...this.pendingSeatIds, ...excess];
		try {
			await eventpublicseatingReleaseSeats({
				path: { event_id: this.#opts.eventId },
				body: { seat_ids: excess }
			});
		} catch {
			// Best-effort; the refetch below reconciles.
		} finally {
			this.pendingSeatIds = this.pendingSeatIds.filter((id) => !excess.includes(id));
		}
		// Drop the released ids from the CURRENT holds — a concurrent untap may
		// have changed them during the await, so an index slice could resurrect
		// a just-released seat.
		this.myHolds = this.myHolds.filter((id) => !excess.includes(id));
		if (this.myHolds.length === 0) this.holdExpiresAt = null;
		this.#refetchAvailability();
	};
}
