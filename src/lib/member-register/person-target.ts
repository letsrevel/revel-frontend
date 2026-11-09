import type { MembershipRecordSchema } from '$lib/api/generated/types.gen';

/**
 * What the person sheet is about. A linked person is followed by their USER id
 * (a tier change closes one entry and opens another, so an entry id would go
 * stale); an account-less entry has nobody else to be keyed on, and a merged
 * entry opened from the periods list is a specific record by definition.
 */
export type SheetTarget = { kind: 'user'; userId: string } | { kind: 'record'; recordId: string };

export interface SheetState {
	target: SheetTarget;
	/** The row as it was opened: shown until the live data resolves. */
	seed: MembershipRecordSchema;
}

/** The sheet state for a row clicked in the list. */
export function sheetStateFor(record: MembershipRecordSchema): SheetState {
	return {
		seed: record,
		target:
			record.user_id && !record.merged_into_id
				? { kind: 'user', userId: record.user_id }
				: { kind: 'record', recordId: record.id as string }
	};
}

/** The sheet state for one specific entry (a merged period opened from the list). */
export function sheetStateForRecord(record: MembershipRecordSchema): SheetState {
	return { seed: record, target: { kind: 'record', recordId: record.id as string } };
}

/**
 * A person's CURRENT entry among all their periods: merged entries live on
 * another person and never count; a current one wins (preferring the kind the
 * sheet was opened on, so a day pass does not displace the standard entry);
 * otherwise the latest start. Null when there is nothing to pick.
 */
export function pickCurrentEntry(
	periods: readonly MembershipRecordSchema[],
	preferKind?: MembershipRecordSchema['kind']
): MembershipRecordSchema | null {
	const own = periods.filter((p) => !p.merged_into_id);
	if (own.length === 0) return null;
	const latest = (rows: MembershipRecordSchema[]) =>
		[...rows].sort((a, b) => Date.parse(b.valid_from) - Date.parse(a.valid_from))[0];
	const current = own.filter((p) => p.is_current === true);
	if (current.length > 0) {
		const same = preferKind ? current.filter((p) => p.kind === preferKind) : [];
		return latest(same.length > 0 ? same : current);
	}
	const same = preferKind ? own.filter((p) => p.kind === preferKind) : [];
	return latest(same.length > 0 ? same : own);
}
