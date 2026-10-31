/**
 * Builds a sync function that calls `apply` only when the incoming server value differs
 * from the last one it applied. Query data gets a new object reference on every refetch,
 * so effects keyed on the whole object would otherwise overwrite unsaved local edits
 * whenever an unrelated field changes.
 */
export function createSyncOnChange<T>(apply: (value: T) => void): (value: T) => boolean {
	let hasSynced = false;
	let last: T | undefined;
	return (value: T): boolean => {
		if (hasSynced && last === value) return false;
		hasSynced = true;
		last = value;
		apply(value);
		return true;
	};
}
