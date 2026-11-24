import type { EventInListSchema } from '$lib/api/generated/types.gen';

/** Upcoming first, then past; an event present in both lists appears once. */
export function mergeEvents(
	upcoming: EventInListSchema[] | undefined,
	past: EventInListSchema[] | undefined
): EventInListSchema[] {
	const seen = new Set<string>();
	return [...(upcoming ?? []), ...(past ?? [])].filter((e) => {
		if (seen.has(e.id)) return false;
		seen.add(e.id);
		return true;
	});
}
