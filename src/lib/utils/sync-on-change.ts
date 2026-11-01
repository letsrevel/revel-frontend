export interface SyncOnChangeOptions<T> {
	/** Reads the local (possibly edited) value; enables the unsaved-draft guard. */
	current?: () => T;
	/** Equality used for the draft comparisons (default `===`). */
	equals?: (a: T, b: T) => boolean;
}

/**
 * Builds a sync function that calls `apply` only when the incoming server value differs
 * from the last one it saw. Query data gets a new object reference on every refetch,
 * so effects keyed on the whole object would otherwise overwrite unsaved local edits
 * whenever an unrelated field changes.
 *
 * With `current`, a changed server value is also withheld when the local value is a
 * deliberate draft: neither equal to the last applied value (untouched) nor to the
 * incoming one (already matches). The incoming value is still recorded, so it is not
 * re-offered later. The first call always applies.
 */
export function createSyncOnChange<T>(
	apply: (value: T) => void,
	options: SyncOnChangeOptions<T> = {}
): (value: T) => boolean {
	const { current, equals = (a: T, b: T): boolean => a === b } = options;
	let hasSynced = false;
	let last: T | undefined;
	return (value: T): boolean => {
		if (hasSynced && last === value) return false;
		const previous = last as T;
		const hadSynced = hasSynced;
		hasSynced = true;
		last = value;
		if (hadSynced && current) {
			const draft = current();
			if (!equals(draft, previous) && !equals(draft, value)) return false;
		}
		apply(value);
		return true;
	};
}
