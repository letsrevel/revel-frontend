/**
 * Pure state/payload helpers for the box-office seat-overrides admin UI (#658).
 *
 * No runes here — plain functions so payload building, selection math and
 * rejection mapping stay unit-testable without rendering the panel.
 *
 * Backend contract (PUT /event-admin/{event_id}/seating/overrides):
 * - `set` items upsert an override (status 'held' | 'killed' + free-text reason).
 * - `release_seat_ids` delete the override for those seats.
 * - If a seat appears in both, THE RELEASE WINS (backend rule; the UI only ever
 *   sends one action at a time, but the copy mirrors the rule).
 * - Seats with a live ticket are rejected PER-SEAT into `rejected`
 *   (seat_id -> 'ticketed' | 'unknown_seat'), never as a whole-batch failure.
 */
import type {
	SeatOverridesRequest,
	SeatingAvailabilitySchema,
	VenueChartSchema
} from '$lib/api/generated/types.gen';
import {
	buildSeatViews,
	rowsFromSeatViews,
	type SeatRow,
	type SeatView
} from '$lib/components/tickets/seating-view';
import * as m from '$lib/paraglide/messages.js';

export type OverrideAction = 'hold' | 'kill' | 'release';
export type HoldKind = 'house' | 'tech' | 'promoter';

/** Backend `EventSeatOverride.reason` is a CharField(max_length=255). */
const REASON_MAX_LENGTH = 255;

export const HOLD_KINDS: readonly HoldKind[] = ['house', 'tech', 'promoter'];

/** Localized label for a hold kind (used by the kind select). */
export function holdKindLabel(kind: HoldKind): string {
	switch (kind) {
		case 'house':
			return m['orgAdmin.seating.holdKindHouse']();
		case 'tech':
			return m['orgAdmin.seating.holdKindTech']();
		case 'promoter':
			return m['orgAdmin.seating.holdKindPromoter']();
	}
}

/**
 * Compose the stored reason for a hold: the kind is prefixed so it survives the
 * round trip (the backend stores a single free-text reason per override).
 */
export function composeHoldReason(kind: HoldKind, reason: string): string {
	return `[${kind}] ${reason.trim()}`.slice(0, REASON_MAX_LENGTH);
}

export interface BuildOverridesArgs {
	action: OverrideAction;
	/** Only meaningful when action === 'hold'. */
	holdKind: HoldKind;
	/** Free-text reason; required (non-blank) for hold/kill. */
	reason: string;
	/** Seat ids currently checked, in selection order. */
	selectedSeatIds: string[];
	/** Seat ids currently 'blocked' in availability (release targets only these). */
	blockedSeatIds: ReadonlySet<string>;
}

/**
 * Build the PUT body for the current form state, or null when the state is not
 * submittable (empty selection, blank reason on hold/kill, or a release with
 * no currently-blocked seats selected).
 */
export function buildOverridesRequest(args: BuildOverridesArgs): SeatOverridesRequest | null {
	const ids = [...new Set(args.selectedSeatIds)];
	if (ids.length === 0) return null;

	if (args.action === 'release') {
		const releasable = ids.filter((id) => args.blockedSeatIds.has(id));
		if (releasable.length === 0) return null;
		return { release_seat_ids: releasable };
	}

	const trimmed = args.reason.trim();
	if (trimmed.length === 0) return null;

	if (args.action === 'hold') {
		return {
			set: ids.map((id) => ({
				seat_id: id,
				status: 'held' as const,
				reason: composeHoldReason(args.holdKind, args.reason)
			}))
		};
	}

	return {
		set: ids.map((id) => ({
			seat_id: id,
			status: 'killed' as const,
			reason: trimmed.slice(0, REASON_MAX_LENGTH)
		}))
	};
}

export type SelectionState = 'none' | 'some' | 'all';

/** Tri-state for a row/sector select-all checkbox over the given seat ids. */
export function selectionStateFor(
	selected: ReadonlySet<string>,
	seatIds: readonly string[]
): SelectionState {
	if (seatIds.length === 0) return 'none';
	let count = 0;
	for (const id of seatIds) {
		if (selected.has(id)) count += 1;
	}
	if (count === 0) return 'none';
	return count === seatIds.length ? 'all' : 'some';
}

/** Localized human label for a per-seat rejection code from the response map. */
export function rejectionReasonLabel(code: string): string {
	switch (code) {
		case 'ticketed':
			return m['orgAdmin.seating.rejectedTicketed']();
		case 'unknown_seat':
			return m['orgAdmin.seating.rejectedUnknownSeat']();
		default:
			return code;
	}
}

export interface SectorSeatGroup {
	id: string;
	name: string;
	rows: SeatRow[];
	/** All (active) seat ids in this sector, for select-all. */
	seatIds: string[];
}

/**
 * Group the chart into seated sectors -> rows -> seat views joined with the
 * sparse availability map. Standing sectors and decommissioned
 * (is_active=false) seats are excluded by buildSeatViews, so 'blocked' seats
 * shown here are event overrides (decommissioned seats never appear).
 */
export function sectorGroupsFrom(
	chart: VenueChartSchema,
	availability: SeatingAvailabilitySchema
): SectorSeatGroup[] {
	const sectors = (chart.sectors ?? [])
		.filter((sector) => (sector.kind ?? 'seated') !== 'standing')
		.sort((a, b) => (a.display_order ?? 0) - (b.display_order ?? 0));
	return sectors.map((sector) => {
		const views = buildSeatViews(chart, availability, {
			sectorId: sector.id,
			myHolds: [],
			pending: []
		});
		return {
			id: sector.id,
			name: sector.name,
			rows: rowsFromSeatViews(views),
			seatIds: views.map((seat) => seat.id)
		};
	});
}

/** All seat views across the given groups (flattened, row order). */
export function seatViewsFrom(groups: readonly SectorSeatGroup[]): SeatView[] {
	return groups.flatMap((group) => group.rows.flatMap((row) => row.seats));
}

/** Ids of seats currently shown as 'blocked' (override view; see sectorGroupsFrom). */
export function blockedSeatIdsFrom(seats: readonly SeatView[]): Set<string> {
	return new Set(seats.filter((seat) => seat.status === 'blocked').map((seat) => seat.id));
}

export interface RejectedEntry {
	seatId: string;
	/** Chart label when known, else the raw seat id (defensive). */
	seatLabel: string;
	/** Localized reason, ready to render. */
	reason: string;
}

/**
 * Join the response `rejected` map (seat_id -> code) with chart labels into
 * render-ready entries, sorted by seat label (numeric-aware).
 */
export function rejectedEntriesFrom(
	rejected: Record<string, string> | undefined,
	labelBySeatId: ReadonlyMap<string, string>
): RejectedEntry[] {
	if (!rejected) return [];
	const entries = Object.entries(rejected).map(([seatId, code]) => ({
		seatId,
		seatLabel: labelBySeatId.get(seatId) ?? seatId,
		reason: rejectionReasonLabel(code)
	}));
	entries.sort((a, b) =>
		a.seatLabel.localeCompare(b.seatLabel, undefined, { numeric: true, sensitivity: 'base' })
	);
	return entries;
}
