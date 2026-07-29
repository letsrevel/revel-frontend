/**
 * Shared constants for the `/embed` surface (issue #689).
 *
 * Embeds are public, read-only, anonymous renderings of Revel content that
 * organizers iframe into their own websites. Everything here is deliberately
 * framework-free so it can be shared between server loads, Svelte components
 * and the plain-JS loader script contract.
 */

/** Root path of the embed surface. */
export const EMBED_PATH_PREFIX = '/embed';

/**
 * Is this pathname part of the embed surface?
 *
 * Lives here rather than in `$lib/server/embed.ts` because `$lib/server/**` is
 * server-only to SvelteKit: importing it from `$lib/i18n.ts` (which re-exports
 * client-usable Paraglide helpers) would make that module unimportable from the
 * browser.
 */
export function isEmbedPath(pathname: string): boolean {
	return pathname === EMBED_PATH_PREFIX || pathname.startsWith(`${EMBED_PATH_PREFIX}/`);
}

/** Kinds of embed surface. Doubles as the `utm_medium` value. */
export const EMBED_MEDIUMS = ['list', 'event', 'series', 'oembed'] as const;
export type EmbedMedium = (typeof EMBED_MEDIUMS)[number];

/** Theme modes accepted by `?theme=`. */
export const EMBED_THEMES = ['light', 'dark', 'auto'] as const;
export type EmbedTheme = (typeof EMBED_THEMES)[number];

/**
 * Cache policy for embed documents.
 *
 * Embeds are anonymous and identical for every viewer of a given URL, so they
 * are safe to cache in shared caches. The infra side (letsrevel/infra#37) is
 * responsible for actually honouring / passing this through.
 */
export const EMBED_CACHE_CONTROL = 'public, max-age=3600, stale-while-revalidate=300';

/** Number of events rendered by a list embed when `page_size` is not given. */
export const EMBED_DEFAULT_PAGE_SIZE = 6;

/**
 * Hard ceiling on `page_size`. Each rendered event may cost one extra
 * ticket-tier request during SSR (for the "from €X" hint), so an unbounded
 * page size would let a third-party page amplify load on our backend.
 */
export const EMBED_MAX_PAGE_SIZE = 24;

/**
 * Per-request budget for the optional "from €X" tier lookups.
 *
 * These calls are decorative: their result only adds a price line to a card.
 * `Promise.allSettled` keeps a failure from rejecting the batch, but it still
 * WAITS for every request to settle — so without a deadline one hanging upstream
 * call would stall the whole embed's SSR response. Time-boxing them means a slow
 * backend costs the price hint, not the page.
 */
export const EMBED_PRICE_TIMEOUT_MS = 2000;

/** Default iframe dimensions advertised through oEmbed, per surface. */
export const EMBED_DEFAULT_DIMENSIONS: Record<Exclude<EmbedMedium, 'oembed'>, [number, number]> = {
	event: [600, 460],
	list: [600, 820],
	series: [600, 820]
};
