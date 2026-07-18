/**
 * Pure join layer between the seating chart (seat geometry/labels) and the
 * sparse availability map (seat statuses + the caller's holds).
 *
 * The backend availability map is SPARSE: a seat id absent from
 * `availability.seats` is available; present values are 'sold' | 'held' |
 * 'blocked'. The caller's own holds and in-flight (pending) seats take
 * precedence over the map: pending > mine > sold/held/blocked > available.
 *
 * No runes here — plain functions so this stays unit-testable.
 */
import type {
	ChartSeatSchema,
	SeatingAvailabilitySchema,
	VenueChartSchema
} from '$lib/api/generated/types.gen';
import * as m from '$lib/paraglide/messages.js';

export type SeatStatus = 'available' | 'sold' | 'held' | 'blocked' | 'mine' | 'pending';

export interface SeatView {
	id: string;
	label: string;
	rowLabel: string;
	rowOrder: number;
	number: number | null;
	adjacencyIndex: number;
	isAccessible: boolean;
	isObstructedView: boolean;
	status: SeatStatus;
}

export interface SeatRow {
	rowLabel: string;
	rowOrder: number;
	seats: SeatView[];
}

export interface BuildSeatViewsOptions {
	/** Restrict to a single sector; when absent, all seated sectors are included.
	 * Standing sectors are always excluded (their spots can never be held). */
	sectorId?: string | null;
	/** Seat ids currently held by the caller (rendered as selected). */
	myHolds: string[];
	/** Seat ids with an in-flight hold/release request (rendered busy). */
	pending: string[];
}

/** Map a sparse-availability value to a SeatStatus (defensive: unknown → blocked). */
function statusFromAvailability(value: string | undefined): SeatStatus {
	if (value === undefined) return 'available';
	if (value === 'sold' || value === 'held' || value === 'blocked') return value;
	return 'blocked';
}

function toSeatView(seat: ChartSeatSchema, status: SeatStatus): SeatView {
	return {
		id: seat.id,
		label: seat.label,
		rowLabel: seat.row_label ?? '?',
		rowOrder: seat.row_order ?? 0,
		number: seat.number ?? null,
		adjacencyIndex: seat.adjacency_index ?? 0,
		isAccessible: seat.is_accessible ?? false,
		isObstructedView: seat.is_obstructed_view ?? false,
		status
	};
}

/**
 * Join chart seats with the sparse availability map into render-ready views.
 *
 * Filters to the given sector (all seated sectors when absent) and to active
 * seats only. Status precedence: pending > mine > sold/held/blocked > available.
 */
export function buildSeatViews(
	chart: VenueChartSchema,
	availability: SeatingAvailabilitySchema,
	opts: BuildSeatViewsOptions
): SeatView[] {
	const pending = new Set(opts.pending);
	const mine = new Set(opts.myHolds);
	const seatStatusMap = availability.seats ?? {};

	// Standing sectors are excluded even when explicitly targeted: their spots
	// can never be held (backend only holds seated-sector seats), so rendering
	// them would trap buyers in a permanent 409 loop.
	const sectors = (chart.sectors ?? []).filter(
		(sector) =>
			(sector.kind ?? 'seated') !== 'standing' &&
			(opts.sectorId ? sector.id === opts.sectorId : true)
	);

	const views: SeatView[] = [];
	for (const sector of sectors) {
		for (const seat of sector.seats ?? []) {
			if (seat.is_active === false) continue;
			let status: SeatStatus;
			if (pending.has(seat.id)) {
				status = 'pending';
			} else if (mine.has(seat.id)) {
				status = 'mine';
			} else {
				status = statusFromAvailability(seatStatusMap[seat.id]);
			}
			views.push(toSeatView(seat, status));
		}
	}
	return views;
}

/**
 * Group seat views into rows for grid rendering.
 *
 * Rows are sorted by rowOrder, then rowLabel; seats within a row by
 * adjacencyIndex, then number, then label (stable tiebreak).
 */
export function rowsFromSeatViews(seats: SeatView[]): SeatRow[] {
	const byLabel = new Map<string, SeatView[]>();
	for (const seat of seats) {
		const existing = byLabel.get(seat.rowLabel);
		if (existing) {
			existing.push(seat);
		} else {
			byLabel.set(seat.rowLabel, [seat]);
		}
	}

	const rows: SeatRow[] = [];
	for (const [rowLabel, rowSeats] of byLabel) {
		rowSeats.sort(
			(a, b) =>
				a.adjacencyIndex - b.adjacencyIndex ||
				(a.number ?? 0) - (b.number ?? 0) ||
				a.label.localeCompare(b.label, undefined, { numeric: true, sensitivity: 'base' })
		);
		rows.push({
			rowLabel,
			rowOrder: Math.min(...rowSeats.map((s) => s.rowOrder)),
			seats: rowSeats
		});
	}
	// Numeric-aware collation: rows "1", "2", ..., "10" (not 1, 10, 2) — every
	// seat written through the grid editor currently has row_order 0, so this
	// label tiebreak is the effective ordering for editor-built venues.
	rows.sort(
		(a, b) =>
			a.rowOrder - b.rowOrder ||
			a.rowLabel.localeCompare(b.rowLabel, undefined, { numeric: true, sensitivity: 'base' })
	);
	return rows;
}

/**
 * Localized status fragment for a seat's accessible name (null = no suffix
 * needed). Shared by SeatSelector (button grid) and SeatMap (SVG map) so the
 * a11y wording stays identical across both seat pickers.
 */
export function seatStatusLabel(seat: SeatView): string | null {
	switch (seat.status) {
		case 'sold':
			return m['seatSelector.statusSold']();
		case 'held':
			return m['seatSelector.statusHeld']();
		case 'blocked':
			return m['seatSelector.statusBlocked']();
		case 'pending':
			return m['seatSelector.statusPending']();
		default:
			return null;
	}
}

/** Full accessible name for a seat: label, attributes, then status. */
export function seatAriaLabel(seat: SeatView): string {
	let label = `${m['seatSelector.seat']()} ${seat.label}`;
	if (seat.isAccessible) {
		label += `, ${m['seatSelector.accessible']()}`;
	}
	if (seat.isObstructedView) {
		label += `, ${m['seatSelector.obstructedView']()}`;
	}
	const status = seatStatusLabel(seat);
	if (status) {
		label += `, ${status}`;
	}
	return label;
}
