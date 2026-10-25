/** Everything the editor can change that a save would persist. */
export interface DirtySnapshotInput {
	formData: unknown;
	scheduleRows: unknown;
	resourceIds: readonly string[];
	logoFile: File | null;
	coverArtFile: File | null;
	deleteLogo: boolean;
	deleteCoverArt: boolean;
}

/** JSON with recursively sorted keys, so key order never reads as a change. */
function stableStringify(value: unknown): string {
	return JSON.stringify(value, (_key, v: unknown) => {
		if (v && typeof v === 'object' && !Array.isArray(v)) {
			const sorted: Record<string, unknown> = {};
			for (const k of Object.keys(v).sort()) {
				sorted[k] = (v as Record<string, unknown>)[k];
			}
			return sorted;
		}
		return v;
	});
}

/**
 * Serialise the editable state to a stable string. Compare two snapshots to
 * decide whether there are unsaved changes. Pending image uploads count by
 * presence only (a File is not serialisable); resource ids are order-insensitive.
 */
export function buildDirtySnapshot(input: DirtySnapshotInput): string {
	return stableStringify({
		formData: input.formData,
		scheduleRows: input.scheduleRows,
		resourceIds: [...input.resourceIds].sort(),
		logoFile: input.logoFile !== null,
		coverArtFile: input.coverArtFile !== null,
		deleteLogo: input.deleteLogo,
		deleteCoverArt: input.deleteCoverArt
	});
}
