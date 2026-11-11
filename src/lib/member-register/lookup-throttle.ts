/**
 * Client-side lockout after a 429 on the account lookup, kept as a DEADLINE per
 * organization so closing and reopening the dialog (or remounting it) within
 * the same page cannot dodge the advised wait.
 */
const deadlines = new Map<string, number>();

export function setLookupThrottle(slug: string, seconds: number | null): void {
	deadlines.set(slug, Date.now() + (seconds ?? 60) * 1000);
}

/** Milliseconds of lockout left (0 when none). */
export function lookupThrottleRemaining(slug: string): number {
	return Math.max(0, (deadlines.get(slug) ?? 0) - Date.now());
}

export function clearLookupThrottles(): void {
	deadlines.clear();
}
