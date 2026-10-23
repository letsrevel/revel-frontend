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
 */

export type TenantRouteDecision =
	{ action: 'allow' } | { action: 'redirect'; status: 302; location: string };

/**
 * - `open`      any subpath is allowed on a tenant host
 * - `org`       `/org/{tenant}/…` (never `/admin`); legacy `/org/{uuid}/membership`
 * - `events`    `/events/{tenant}/…`, `/events/confirm-action`, legacy UUID routes
 * - `embed`     `/embed/{tenant}…`
 * - `platform`  platform-only: 302 to the same path on the platform origin
 * - `home`      not part of a tenant site: 302 to `/`
 */
export type SegmentRule = 'open' | 'org' | 'events' | 'embed' | 'platform' | 'home';

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
	account: 'open',
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
		case 'org':
			if (third === 'admin') return platformRedirect(input);
			if (second === tenant) return ALLOW;
			// Legacy /org/{uuid}/membership redirects to the slug URL, which is re-checked.
			if (second !== undefined && UUID_RE.test(second) && third === 'membership') return ALLOW;
			return HOME;
		case 'events':
			if (second === 'confirm-action' && third === undefined) return ALLOW;
			if (second === tenant) return ALLOW;
			// Legacy UUID routes redirect to slug URLs, which are re-checked.
			if (second !== undefined && UUID_RE.test(second)) return ALLOW;
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

/** Applies {@link tenantRouteDecision} on tenant hosts. Must run right after `handleTenant`. */
export const handleTenantRouting: Handle = async ({ event, resolve }) => {
	const tenant = event.locals.tenant;
	if (!tenant) return resolve(event);

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
