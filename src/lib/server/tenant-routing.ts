import type { Handle } from '@sveltejs/kit';
import { env } from '$env/dynamic/private';

/**
 * Route scoping for tenant hosts (#1056).
 *
 * A tenant host serves ONE organization. Everything that belongs to the
 * platform (discovery, other orgs, admin, marketing) must not render there:
 * it is redirected to the tenant root, or (for platform-only tools) to the
 * same path on the platform origin.
 *
 * Every top-level path segment that exists under `src/routes` has an explicit
 * entry in {@link SEGMENT_RULES}; a unit test walks the real route list and
 * fails when a new segment has no decision. An unknown segment falls through
 * to "redirect home", never to "allow".
 *
 * Hook order (hooks.server.ts): `handleTenant` (resolves `locals.tenant`) runs
 * first, then `handleTenantRouting` (this module) before anything else touches
 * the request. On platform hosts it only post-processes the response (see
 * {@link capCanonicalRedirectCache}).
 */

export type TenantRouteDecision =
	{ action: 'allow' } | { action: 'redirect'; status: 302; location: string };

/**
 * - `open`      any subpath is allowed on a tenant host
 * - `org`       `/org/{tenant}/…` (never `/admin`); legacy `/org/{uuid}/membership`
 * - `events`    bare `/events` (the tenant's own list; its loader forces the
 *               organization filter), `/events/{tenant}/…`, `/events/confirm-action`,
 *               and the exact legacy UUID route shapes (see {@link tenantRouteDecision})
 * - `account`   open, except the platform/OAuth settings pages in
 *               {@link PLATFORM_ACCOUNT_PAGES}, which go to the platform origin
 * - `embed`     `/embed/{tenant}…`
 * - `platform`  platform-only: 302 to the same path on the platform origin
 * - `home`      not part of a tenant site: 302 to `/`
 */
export type SegmentRule = 'open' | 'org' | 'events' | 'account' | 'embed' | 'platform' | 'home';

/** `/account/*` pages that are platform/OAuth settings, not part of a tenant site. */
export const PLATFORM_ACCOUNT_PAGES: readonly string[] = [
	'referral',
	'developer-apps',
	'connected-apps'
];

const LOCALIZED_LANDING_PREFIXES = ['de', 'es', 'fr', 'it', 'pt'] as const;

const MARKETING_PAGES = [
	'club-membership-management',
	'community-first-event-platform',
	'eventbrite-alternative',
	'kink-event-ticketing',
	'privacy-focused-events',
	'queer-event-management',
	'self-hosted-event-platform'
] as const;

/** Explicit decision per top-level segment (and per prefix where noted below). */
export const SEGMENT_RULES: Readonly<Record<string, SegmentRule>> = {
	// Tenant-scoped content
	org: 'org',
	events: 'events',
	embed: 'embed',
	// Attendee-facing: auth, account, legal, tokens
	login: 'open',
	logout: 'open',
	register: 'open',
	'password-reset': 'open',
	verify: 'open',
	account: 'account',
	dashboard: 'open',
	legal: 'open',
	unsubscribe: 'open',
	join: 'open', // /join/event/{token}, /join/org/{token}: invitation links; slug re-checked after their redirect
	// Plumbing: API proxies, OIDC callback, framework assets
	api: 'open',
	auth: 'open', // OIDC callback; the provider buttons are hidden elsewhere
	_app: 'open',
	'.well-known': 'open',
	// SEO / asset endpoints (tenant-aware since #1057)
	'robots.txt': 'open',
	'feed.xml': 'open',
	'opensearch.xml': 'open',
	oembed: 'open',
	// Platform-only tools
	'create-org': 'platform',
	oauth: 'platform',
	impersonate: 'platform',
	// Platform discovery, referral program and marketing: not a tenant site
	organizations: 'home',
	referral: 'home',
	...Object.fromEntries(MARKETING_PAGES.map((p) => [p, 'home' as const])),
	...Object.fromEntries(LOCALIZED_LANDING_PREFIXES.map((p) => [p, 'home' as const]))
};

/** Segments matched by prefix (`sitemap.xml`, `sitemap-events-1.xml`, `favicon.png`, `manifest.json`). */
export const PREFIX_RULES: Readonly<Record<string, SegmentRule>> = {
	sitemap: 'open',
	favicon: 'open',
	manifest: 'open'
};

export function ruleForSegment(segment: string): SegmentRule | undefined {
	const exact = Object.prototype.hasOwnProperty.call(SEGMENT_RULES, segment)
		? SEGMENT_RULES[segment]
		: undefined;
	if (exact) return exact;
	for (const [prefix, rule] of Object.entries(PREFIX_RULES)) {
		if (segment.startsWith(prefix)) return rule;
	}
	return undefined;
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

export interface TenantRouteInput {
	pathname: string;
	search: string;
	/** Slug of the organization served on this host. */
	tenantSlug: string;
	/** `https://platform.example` (no path), or null when unknown. */
	platformOrigin: string | null;
}

const ALLOW: TenantRouteDecision = { action: 'allow' };
const HOME: TenantRouteDecision = { action: 'redirect', status: 302, location: '/' };

/** Decode each path segment; null when any segment is malformed or smuggles a separator. */
function decodeSegments(pathname: string): string[] | null {
	const out: string[] = [];
	for (const raw of pathname.split('/')) {
		if (raw === '') continue; // leading, trailing and doubled slashes
		let seg: string;
		try {
			seg = decodeURIComponent(raw);
		} catch {
			return null;
		}
		if (seg.includes('/') || seg.includes('\\') || seg === '.' || seg === '..') return null;
		out.push(seg);
	}
	return out;
}

function platformRedirect(input: TenantRouteInput): TenantRouteDecision {
	if (!input.platformOrigin) return HOME;
	const path = input.pathname.startsWith('/') ? input.pathname : `/${input.pathname}`;
	return {
		action: 'redirect',
		status: 302,
		location: `${input.platformOrigin.replace(/\/+$/, '')}${path}${input.search}`
	};
}

/**
 * Decide whether a request on a tenant host is served, redirected to the
 * platform, or redirected to the tenant root. Pure.
 */
export function tenantRouteDecision(input: TenantRouteInput): TenantRouteDecision {
	const segments = decodeSegments(input.pathname);
	if (segments === null) return HOME;
	if (segments.length === 0) return ALLOW;

	const [first, second, third] = segments;
	const rule = ruleForSegment(first);
	const tenant = input.tenantSlug;

	switch (rule) {
		case 'open':
			return ALLOW;
		case 'platform':
			return platformRedirect(input);
		case 'embed':
			return second === tenant ? ALLOW : HOME;
		case 'account':
			return second !== undefined && PLATFORM_ACCOUNT_PAGES.includes(second)
				? platformRedirect(input)
				: ALLOW;
		case 'org':
			if (third === 'admin') return platformRedirect(input);
			if (second === tenant) return ALLOW;
			// Legacy /org/{uuid}/membership (exactly) redirects to the slug URL, which is re-checked.
			if (
				segments.length === 3 &&
				second !== undefined &&
				UUID_RE.test(second) &&
				third === 'membership'
			)
				return ALLOW;
			return HOME;
		case 'events':
			// Bare /events is the tenant's own event list: its loader forces the organization filter.
			if (second === undefined) return ALLOW;
			if (second === 'confirm-action' && third === undefined) return ALLOW;
			if (second === tenant) return ALLOW;
			// Legacy UUID routes redirect to slug URLs, which are re-checked (events/[id]
			// renders on the platform but 303s to its slug URL on a tenant host). Only the
			// exact shapes of the real routes: /events/{uuid} (events/[id]),
			// /events/{uuid}/{uuid} and /events/{uuid}/series/{uuid}.
			if (UUID_RE.test(second)) {
				if (segments.length === 2) return ALLOW;
				if (segments.length === 3 && UUID_RE.test(third)) return ALLOW;
				if (segments.length === 4 && third === 'series' && UUID_RE.test(segments[3])) return ALLOW;
			}
			return HOME;
		default:
			return HOME;
	}
}

/** `PLATFORM_ORIGIN`, else `https://` + the first `PLATFORM_HOSTS` entry. Null when neither is usable. */
export function platformOrigin(): string | null {
	const candidates: string[] = [];
	const explicit = env.PLATFORM_ORIGIN?.trim();
	if (explicit) candidates.push(explicit);
	const firstHost = (env.PLATFORM_HOSTS ?? '').split(',')[0]?.trim();
	if (firstHost) candidates.push(`https://${firstHost}`);
	for (const candidate of candidates) {
		try {
			const url = new URL(candidate);
			if (url.protocol === 'https:' || url.protocol === 'http:') return url.origin;
		} catch {
			// try the next candidate
		}
	}
	return null;
}

/**
 * The canonical org redirect is a 301 (product decision), which browsers cache
 * indefinitely: an org that drops or changes its custom domain would stay
 * redirected. When a 301 points at another origin and the response sets no
 * cache policy of its own, mark it `no-store`: the platform admin's kill
 * switch, a removed domain or a failed certificate must stop the redirect at
 * once, and the redirect can depend on the caller's session (members-only
 * orgs) and carry refreshed session cookies, so neither a shared cache nor
 * the browser may reuse it after a logout or account switch. SvelteKit's redirect
 * responses have mutable headers; if a response ever does not (e.g. one built
 * by `Response.redirect()`), a copy is returned instead.
 */
export function capCanonicalRedirectCache(response: Response, requestUrl: URL): Response {
	if (response.status !== 301 || response.headers.has('cache-control')) return response;
	const location = response.headers.get('location');
	if (!location || !/^https?:\/\//i.test(location)) return response;
	try {
		if (new URL(location).origin === requestUrl.origin) return response;
	} catch {
		return response;
	}
	const value = 'no-store';
	try {
		response.headers.set('cache-control', value);
		return response;
	} catch {
		const headers = new Headers(response.headers);
		headers.set('cache-control', value);
		return new Response(response.body, {
			status: response.status,
			statusText: response.statusText,
			headers
		});
	}
}

/**
 * Applies {@link tenantRouteDecision} on tenant hosts. Must run right after
 * `handleTenant`. On platform hosts it passes requests through, capping the
 * cache of canonical redirects to custom domains.
 */
export const handleTenantRouting: Handle = async ({ event, resolve }) => {
	const tenant = event.locals.tenant;
	if (!tenant) return capCanonicalRedirectCache(await resolve(event), event.url);

	const decision = tenantRouteDecision({
		pathname: event.url.pathname,
		search: event.url.search,
		tenantSlug: tenant.slug,
		platformOrigin: platformOrigin()
	});
	if (decision.action === 'allow') return resolve(event);

	return new Response(null, {
		status: decision.status,
		headers: { location: decision.location, 'cache-control': 'no-store' }
	});
};
