// The parametric row-geometry recipe stored in sector.metadata.rowLayout.
// ADMIN-ONLY: buyers never receive this key (it is not in the public chart
// metadata whitelist) — they render the baked seat positions instead. The
// recipe exists solely so the editor can re-edit; persistence truth is the
// baked per-seat position (see seat-layout-bake.ts).

export const CURVE_MIN = -30;
export const CURVE_MAX = 30;
export const CURVE_STEP = 0.2;
export const STAGGER_MIN = -1;
export const STAGGER_MAX = 1;
/** Per-row dx/dy shifts are clamped to this many units either way. */
export const ROW_SHIFT_LIMIT = 20;

export interface RowOverride {
	/** Row identified by its row_order rank (dense, front row = 0). */
	row: number;
	curve?: number;
	stagger?: number;
	dx?: number;
	dy?: number;
}

/**
 * Sparse per-seat position/rotation DELTA — never an absolute. Identity is
 * (0,0,0); a nudge composes with (and survives) later curve/spacing edits
 * because the bake applies it last, on top of whatever the generator placed.
 *
 * Addressed by (row_order rank, adjacency_index) — the same logical coordinate
 * space as `RowOverride.row`, NOT physical grid row/col. `seat` is the raw
 * column index (adjacency_index is identity over columns, see
 * `deriveAdjacencyIndex`).
 */
export interface SeatNudge {
	/** row_order rank (dense, front row = 0) — same space as RowOverride.row. */
	row: number;
	/** adjacency_index (raw column index). */
	seat: number;
	dx?: number;
	dy?: number;
	/** Degrees clockwise, normalized to [-180, 180). Never affects position. */
	rot?: number;
}

export interface RowLayoutRecipe {
	version: 1;
	kind: 'rows';
	/** Signed Bézier sag: 0 = straight, positive bows away from the stage. */
	curve: number;
	/** Row offset as a fraction of seat pitch (0.5 = brick pattern), odd rows. */
	stagger: number;
	align: 'left' | 'center' | 'right';
	rowOverrides: RowOverride[];
	seatNudges: SeatNudge[];
}

export type RowLayoutParse =
	| { status: 'absent' }
	| { status: 'unsupported' }
	| { status: 'ok'; recipe: RowLayoutRecipe; raw: Record<string, unknown> };

export function defaultRowLayout(): RowLayoutRecipe {
	return {
		version: 1,
		kind: 'rows',
		curve: 0,
		stagger: 0,
		align: 'left',
		rowOverrides: [],
		seatNudges: []
	};
}

function clamp(value: number, min: number, max: number): number {
	return Math.min(max, Math.max(min, value));
}

function asNumber(value: unknown): number | undefined {
	return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
}

/** Wraps degrees into [-180, 180) (e.g. 200 -> -160, 180 -> -180). */
function normalizeRotation(value: number): number {
	const wrapped = ((value % 360) + 360) % 360; // [0, 360)
	return wrapped >= 180 ? wrapped - 360 : wrapped;
}

function parseOverride(value: unknown): RowOverride | null {
	if (typeof value !== 'object' || value === null) return null;
	const record = value as Record<string, unknown>;
	const row = asNumber(record.row);
	if (row === undefined || !Number.isInteger(row) || row < 0) return null;
	const override: RowOverride = { row };
	const curve = asNumber(record.curve);
	if (curve !== undefined) override.curve = clamp(curve, CURVE_MIN, CURVE_MAX);
	const stagger = asNumber(record.stagger);
	if (stagger !== undefined) override.stagger = clamp(stagger, STAGGER_MIN, STAGGER_MAX);
	const dx = asNumber(record.dx);
	if (dx !== undefined) override.dx = clamp(dx, -ROW_SHIFT_LIMIT, ROW_SHIFT_LIMIT);
	const dy = asNumber(record.dy);
	if (dy !== undefined) override.dy = clamp(dy, -ROW_SHIFT_LIMIT, ROW_SHIFT_LIMIT);
	return override;
}

/**
 * Parse one seatNudges[] entry. Drops malformed entries (non-integer/negative
 * row or seat, non-object) and entries left with no effective field once
 * non-finite dx/dy/rot are stripped — such an entry is indistinguishable from
 * absent and would just be dead weight in the persisted recipe.
 */
function parseNudge(value: unknown): SeatNudge | null {
	if (typeof value !== 'object' || value === null) return null;
	const record = value as Record<string, unknown>;
	const row = asNumber(record.row);
	if (row === undefined || !Number.isInteger(row) || row < 0) return null;
	const seat = asNumber(record.seat);
	if (seat === undefined || !Number.isInteger(seat) || seat < 0) return null;
	const nudge: SeatNudge = { row, seat };
	const dx = asNumber(record.dx);
	if (dx !== undefined) nudge.dx = clamp(dx, -ROW_SHIFT_LIMIT, ROW_SHIFT_LIMIT);
	const dy = asNumber(record.dy);
	if (dy !== undefined) nudge.dy = clamp(dy, -ROW_SHIFT_LIMIT, ROW_SHIFT_LIMIT);
	const rot = asNumber(record.rot);
	if (rot !== undefined) nudge.rot = normalizeRotation(rot);
	if (nudge.dx === undefined && nudge.dy === undefined && nudge.rot === undefined) return null;
	return nudge;
}

/** Defensive parse of sector.metadata.rowLayout (unknown-shaped JSON). */
export function parseRowLayout(
	metadata: Record<string, unknown> | null | undefined
): RowLayoutParse {
	const raw = metadata?.rowLayout;
	if (raw === undefined || raw === null) return { status: 'absent' };
	if (typeof raw !== 'object' || Array.isArray(raw)) return { status: 'unsupported' };
	const record = raw as Record<string, unknown>;
	if (record.version !== 1 || record.kind !== 'rows') return { status: 'unsupported' };

	const defaults = defaultRowLayout();
	const align = record.align;
	const recipe: RowLayoutRecipe = {
		version: 1,
		kind: 'rows',
		curve: clamp(asNumber(record.curve) ?? defaults.curve, CURVE_MIN, CURVE_MAX),
		stagger: clamp(asNumber(record.stagger) ?? defaults.stagger, STAGGER_MIN, STAGGER_MAX),
		align: align === 'center' || align === 'right' ? align : 'left',
		rowOverrides: Array.isArray(record.rowOverrides)
			? record.rowOverrides
					.map(parseOverride)
					.filter((override): override is RowOverride => override !== null)
			: [],
		seatNudges: Array.isArray(record.seatNudges)
			? record.seatNudges.map(parseNudge).filter((nudge): nudge is SeatNudge => nudge !== null)
			: []
	};
	return { status: 'ok', recipe, raw: record };
}

/** The only field the desync check reads off a persisted seat. */
export interface PositionedSeat {
	position?: { x: number; y: number } | null;
}

/**
 * True when any seat carries a position the plain grid generator could not have
 * produced — i.e. a non-integer x or y. Grid positions are whole cell indices
 * (plus whole-unit aisle shifts); every curve/stagger/fractional-shift recipe
 * lands seats off the integer lattice.
 *
 * Used to detect the seats-ok/metadata-failed seam: a save whose seat writes
 * committed but whose sector-metadata write did not leaves curved seats with no
 * stored recipe, and the panel would silently hydrate to default and re-bake the
 * room straight on the NEXT save. Pairing this with `parseRowLayout` returning
 * 'absent' is what warns the admin before that happens.
 *
 * Deliberately cheap and one-directional: a recipe made only of integer dx/dy
 * shifts (or of `align` alone) bakes back onto the lattice and is not detected.
 * False negatives just mean no banner; there are no false positives from a grid
 * this editor wrote. NaN/Infinity count as custom — such a seat is not on the
 * lattice either.
 */
export function hasCustomSeatPositions(seats: readonly PositionedSeat[]): boolean {
	return seats.some(
		(seat) =>
			seat.position != null &&
			(!Number.isInteger(seat.position.x) || !Number.isInteger(seat.position.y))
	);
}

export function isDefaultRowLayout(recipe: RowLayoutRecipe): boolean {
	return (
		recipe.curve === 0 &&
		recipe.stagger === 0 &&
		recipe.align === 'left' &&
		recipe.rowOverrides.length === 0 &&
		recipe.seatNudges.length === 0
	);
}

/**
 * Serialize for persistence: undefined when the recipe is pure default (the
 * metadata key is REMOVED — a plain grid stays byte-identical to today), else
 * the recipe merged over the previously stored raw object so unknown sibling
 * keys written by future phases survive an edit made by this build.
 */
export function serializeRowLayout(
	recipe: RowLayoutRecipe,
	raw?: Record<string, unknown>
): Record<string, unknown> | undefined {
	if (isDefaultRowLayout(recipe)) return undefined;
	const out: Record<string, unknown> = {
		...(raw ?? {}),
		version: recipe.version,
		kind: recipe.kind,
		curve: recipe.curve,
		stagger: recipe.stagger,
		align: recipe.align,
		rowOverrides: recipe.rowOverrides.map((override) => ({ ...override }))
	};
	// seatNudges rides sparse: omit the key entirely when empty (rather than
	// writing `[]`), and drop any stale key a prior `raw` blob carried once the
	// recipe no longer has nudges — `raw` is spread first, so an explicit
	// `delete` is needed to actually clear it.
	if (recipe.seatNudges.length > 0) {
		out.seatNudges = recipe.seatNudges.map((nudge) => ({ ...nudge }));
	} else {
		delete out.seatNudges;
	}
	return out;
}

/**
 * Decide what to write to sector.metadata.rowLayout on save. Wraps
 * `serializeRowLayout` with one extra case: an 'unsupported' blob (a
 * newer-format recipe this build can't parse) that the admin never actually
 * edited — the on-screen recipe is still exactly `defaultRowLayout()` — must
 * be written back byte-for-byte instead of being collapsed to `undefined` by
 * `serializeRowLayout`'s "default recipe deletes the key" rule, which would
 * silently destroy the newer blob on ANY save (painting a seat, adding an
 * aisle, never touching geometry at all).
 *
 * Once the admin actually moves a control away from default, the unsupported
 * blob IS meant to be overwritten — that falls through to the normal
 * `serializeRowLayout` path below.
 */
export function resolveRowLayoutForSave(
	recipe: RowLayoutRecipe,
	raw: Record<string, unknown> | undefined,
	unsupported: boolean,
	unsupportedRaw: unknown
): unknown {
	if (unsupported && isDefaultRowLayout(recipe)) {
		return unsupportedRaw;
	}
	return serializeRowLayout(recipe, raw);
}

/**
 * Build the buyer-facing rotation mirror `{ seat label: degrees }` from the
 * admin-only nudge recipe — written into `sector.metadata.seatRotations` on
 * save (Task C) so the buyer map can render a rotated seat notch without ever
 * reading `rowLayout`. Skips rot 0/absent (nothing to announce) and any nudge
 * whose (row, seat) does not resolve to a live seat label.
 */
export function rotationsByLabel(
	nudges: readonly SeatNudge[],
	labelFor: (row: number, seat: number) => string | null
): Record<string, number> {
	const result: Record<string, number> = {};
	for (const nudge of nudges) {
		if (!nudge.rot) continue;
		const label = labelFor(nudge.row, nudge.seat);
		if (label === null) continue;
		result[label] = nudge.rot;
	}
	return result;
}
