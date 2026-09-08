/**
 * First-party purchase attribution (#880 / BE #922).
 *
 * The four `utm_*` tags travel in the URL only — zero storage on the visitor's
 * device (no cookie, no local/sessionStorage, no referrer). The sanitiser is
 * byte-compatible with `revel-backend/src/events/schema/attribution.py`, which
 * re-sanitises at the boundary anyway (malformed values are dropped, never a 400).
 */
import type { TicketAttribution } from '$lib/api/generated/types.gen';

export const UTM_KEYS = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content'] as const;
export type UtmKey = (typeof UTM_KEYS)[number];

const MAX_LEN = 100;
const ALLOWED_VALUE = /^[A-Za-z0-9._:-]+$/;

/** Trim, cap at 100 chars, allow-list charset; `null` when nothing survives. */
export function sanitizeUtmValue(raw: string | null | undefined): string | null {
	if (!raw) return null;
	const trimmed = raw.trim().slice(0, MAX_LEN);
	return ALLOWED_VALUE.test(trimmed) ? trimmed : null;
}

/** The sanitised campaign tags on `url`, or `null` when none survive. */
export function readAttributionFromUrl(url: URL): TicketAttribution | null {
	const attribution: TicketAttribution = {};
	for (const key of UTM_KEYS) {
		const value = sanitizeUtmValue(url.searchParams.get(key));
		if (value !== null) attribution[key] = value;
	}
	return Object.keys(attribution).length > 0 ? attribution : null;
}

/**
 * Browser-only convenience over `readAttributionFromUrl` for checkout
 * mutations, which run client-side at reserve time. Kept here (plain .ts)
 * so `.svelte.ts` controllers don't construct a transient URL themselves.
 */
export function readAttributionFromCurrentUrl(): TicketAttribution | null {
	return readAttributionFromUrl(new URL(window.location.href));
}

/**
 * Carry the current page's campaign tags onto an internal href (the public-surface
 * "UTM carry", spec §4). Returns `href` untouched when the current URL has no tags;
 * never overwrites a `utm_*` key the href already carries. Accepts path-absolute
 * and `?`-only hrefs; always returns a path-relative href (path + search + hash).
 */
export function withUtmParams(href: string, currentUrl: URL): string {
	const tags = readAttributionFromUrl(currentUrl);
	if (!tags) return href;
	const url = new URL(href, currentUrl);
	for (const key of UTM_KEYS) {
		const value = tags[key];
		if (value !== undefined && !url.searchParams.has(key)) url.searchParams.set(key, value);
	}
	return url.pathname + url.search + url.hash;
}

/**
 * Short "source · campaign" line for an admin ticket row (#880 follow-up).
 * Falls back to "medium · content" when neither source nor campaign is
 * present; `null` when the ticket carries no attribution at all (renders
 * nothing — the values are raw tags, never i18n'd).
 */
export function formatTicketAttributionLine(
	attribution: TicketAttribution | null | undefined
): string | null {
	if (!attribution) return null;
	const primary = [attribution.utm_source, attribution.utm_campaign].filter(
		(v): v is string => !!v
	);
	const parts =
		primary.length > 0
			? primary
			: [attribution.utm_medium, attribution.utm_content].filter((v): v is string => !!v);
	return parts.length > 0 ? parts.join(' · ') : null;
}
