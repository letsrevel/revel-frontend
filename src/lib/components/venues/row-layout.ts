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

export interface RowLayoutRecipe {
	version: 1;
	kind: 'rows';
	/** Signed Bézier sag: 0 = straight, positive bows away from the stage. */
	curve: number;
	/** Row offset as a fraction of seat pitch (0.5 = brick pattern), odd rows. */
	stagger: number;
	align: 'left' | 'center' | 'right';
	rowOverrides: RowOverride[];
}

export type RowLayoutParse =
	| { status: 'absent' }
	| { status: 'unsupported' }
	| { status: 'ok'; recipe: RowLayoutRecipe; raw: Record<string, unknown> };

export function defaultRowLayout(): RowLayoutRecipe {
	return { version: 1, kind: 'rows', curve: 0, stagger: 0, align: 'left', rowOverrides: [] };
}

function clamp(value: number, min: number, max: number): number {
	return Math.min(max, Math.max(min, value));
}

function asNumber(value: unknown): number | undefined {
	return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
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
			: []
	};
	return { status: 'ok', recipe, raw: record };
}

export function isDefaultRowLayout(recipe: RowLayoutRecipe): boolean {
	return (
		recipe.curve === 0 &&
		recipe.stagger === 0 &&
		recipe.align === 'left' &&
		recipe.rowOverrides.length === 0
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
	return {
		...(raw ?? {}),
		version: recipe.version,
		kind: recipe.kind,
		curve: recipe.curve,
		stagger: recipe.stagger,
		align: recipe.align,
		rowOverrides: recipe.rowOverrides.map((override) => ({ ...override }))
	};
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
