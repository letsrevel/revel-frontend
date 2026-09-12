/**
 * Guards for numeric `<input>` fields whose value is written back into the state
 * that feeds their `value=`.
 *
 * Normalizing or clamping such a field on every keystroke makes it impossible to
 * edit: backspacing the last digit is immediately overwritten, leaving a caret
 * after a digit that can never be deleted (issues #922 / #924). The fix is to let
 * the bound string be a free-text buffer while the field has focus — commit only
 * values that are already valid, and settle whatever is left on blur.
 *
 * The empty string is the trap these helpers exist to close: `Number('')` is `0`,
 * `parseFloat('') || 0` is `0`, and `Number.isFinite(0)` is `true`, so "empty"
 * sails through a naive validity check and gets clamped up to the minimum.
 */

export interface NumericBounds {
	/** Smallest committable value, inclusive. */
	min?: number;
	/** Largest committable value, inclusive. */
	max?: number;
	/** Accept fractional values. Whole numbers only by default. */
	decimal?: boolean;
}

/** A whole number, optionally signed. Deliberately rejects `1e2` and `1.` alike. */
const WHOLE_NUMBER = /^-?\d+$/;
/** A plain decimal literal. Also rejects exponent notation and a trailing dot. */
const DECIMAL_NUMBER = /^-?\d+(?:\.\d+)?$/;

/**
 * Parse a value that is worth committing while the user is still typing.
 *
 * Returns `null` for anything incomplete or out of range — empty, a lone `-`, a
 * trailing `.`, or a number past the bounds — so the last valid value stands
 * until {@link settleNumber} runs on blur. Nothing here rewrites the buffer.
 *
 * `type="number"` hands the page the raw text of anything that parses as a
 * floating-point literal, so `1.5` and `1e2` arrive verbatim: `parseInt` would
 * silently commit `1` for either, which is why the shape is matched first.
 */
export function parseCommittableNumber(raw: string, bounds: NumericBounds = {}): number | null {
	const trimmed = raw.trim();
	const shape = bounds.decimal ? DECIMAL_NUMBER : WHOLE_NUMBER;
	if (!shape.test(trimmed)) return null;

	const value = Number(trimmed);
	if (!Number.isFinite(value)) return null;
	if (!bounds.decimal && !Number.isSafeInteger(value)) return null;
	if (bounds.min !== undefined && value < bounds.min) return null;
	if (bounds.max !== undefined && value > bounds.max) return null;
	return value;
}

/** Pull a value inside the bounds. Bounds that aren't given don't constrain. */
export function clampNumber(value: number, bounds: NumericBounds = {}): number {
	const lowered = bounds.min !== undefined ? Math.max(value, bounds.min) : value;
	return bounds.max !== undefined ? Math.min(lowered, bounds.max) : lowered;
}

/**
 * Settle a buffer on blur: clamp the number the user actually entered into range
 * (`05` → `5`, `10.5` → `10`, `1e2` → `100`, `99` → the maximum).
 *
 * Empty and unparseable buffers settle to `fallback` rather than to `Number('')`.
 * Pass `fallback: null` for a field where empty is itself a legal value.
 *
 * Whole-number fields floor rather than truncate a prefix, matching the event
 * max-tickets field this sweep generalizes (#923).
 */
export function settleNumber<F extends number | null>(
	raw: string,
	options: NumericBounds & { fallback: F }
): number | F {
	const trimmed = raw.trim();
	if (trimmed === '') return options.fallback;

	const value = Number(trimmed);
	if (!Number.isFinite(value)) return options.fallback;

	const settled = clampNumber(options.decimal ? value : Math.floor(value), options);

	// A bounded field is already safe — the clamp pulled it back to its maximum.
	// An unbounded one is not: twenty typed digits reach `Number` as 1e20, which
	// `parseCommittableNumber` refuses while typing, so blur must refuse it too
	// rather than committing a value the backend can't round-trip.
	if (!options.decimal && !Number.isSafeInteger(settled)) return options.fallback;

	return settled;
}
