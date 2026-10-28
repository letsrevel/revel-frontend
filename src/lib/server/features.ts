import { z } from 'zod';
import { apiApiVersion } from '$lib/api/generated/sdk.gen';
import type { SsoProviderSchema } from '$lib/api/generated/types.gen';
import { resolveFeatures, DEFAULT_FEATURES, type Features } from '$lib/utils/features';
import {
	DEFAULT_PLATFORM_FEE_PERCENT,
	DEFAULT_PLATFORM_FEE_FIXED,
	STRIPE_FEE_PERCENT,
	STRIPE_FEE_FIXED,
	DEFAULT_PLATFORM_VAT_RATE_PERCENT,
	type PlatformFeeConfig
} from '$lib/utils/fees';

/*
 * Runtime guard for the provider list: entries feed the OIDC start URL and the
 * button label directly, so a malformed entry (missing/empty key or name)
 * would render a broken login link. Filtered per entry — one bad provider
 * must not take down the others.
 */
const ssoProviderSchema = z.object({ key: z.string().min(1), name: z.string().min(1) });

function parseSsoProviders(raw: unknown): SsoProviderSchema[] {
	if (!Array.isArray(raw)) {
		return [];
	}
	return raw.filter(
		(entry): entry is SsoProviderSchema => ssoProviderSchema.safeParse(entry).success
	);
}

/*
 * The booking URL renders as a link href, so only accept absolute http(s)
 * URLs — anything else (relative paths, javascript:, malformed admin input)
 * degrades to "no button" rather than a broken or dangerous link.
 */
function parseDemoBookingUrl(raw: unknown): string | null {
	return typeof raw === 'string' && /^https?:\/\//.test(raw) ? raw : null;
}

/*
 * The support address renders as a mailto: href, so accept only a plain
 * address — anything else degrades to "no address" (the copy then falls back
 * to a generic "contact us" without a link).
 */
function parseSupportEmail(raw: unknown): string | null {
	return typeof raw === 'string' &&
		/^[A-Za-z0-9._+-]+@[A-Za-z0-9-]+(\.[A-Za-z0-9-]+)+$/.test(raw.trim())
		? raw.trim()
		: null;
}

function parseTurnstileSiteKey(raw: unknown): string | null {
	return typeof raw === 'string' && raw.trim().length > 0 ? raw.trim() : null;
}

/*
 * Fee rates from `/version`, for the public landing-page calculator. The backend
 * serialises these as strings (Django Decimal), so parse them rather than
 * casting — a malformed value must degrade to the static default instead of
 * poisoning the arithmetic with NaN. Every field falls back independently, so a
 * partial payload still supplies the rates it does carry.
 */
const feeNumberSchema = z.number().finite().nonnegative();

const DEFAULT_FEE_CONFIG: PlatformFeeConfig = {
	stripeFeePercent: STRIPE_FEE_PERCENT,
	stripeFeeFixed: STRIPE_FEE_FIXED,
	platformFeePercent: DEFAULT_PLATFORM_FEE_PERCENT,
	platformFeeFixed: DEFAULT_PLATFORM_FEE_FIXED,
	vatRate: DEFAULT_PLATFORM_VAT_RATE_PERCENT
};

function parseFeeRates(raw: unknown): PlatformFeeConfig {
	if (typeof raw !== 'object' || raw === null) return DEFAULT_FEE_CONFIG;
	const record = raw as Record<string, unknown>;
	// The wire values are strings; Number('') is 0, so require non-empty first.
	const num = (value: unknown): number | undefined => {
		const parsed = typeof value === 'string' && value.trim() !== '' ? Number(value) : value;
		const check = feeNumberSchema.safeParse(parsed);
		return check.success ? check.data : undefined;
	};
	return {
		stripeFeePercent: num(record.stripe_fee_percent) ?? DEFAULT_FEE_CONFIG.stripeFeePercent,
		stripeFeeFixed: num(record.stripe_fee_fixed) ?? DEFAULT_FEE_CONFIG.stripeFeeFixed,
		platformFeePercent:
			num(record.default_platform_fee_percent) ?? DEFAULT_FEE_CONFIG.platformFeePercent,
		platformFeeFixed: num(record.default_platform_fee_fixed) ?? DEFAULT_FEE_CONFIG.platformFeeFixed,
		vatRate: num(record.vat_rate) ?? DEFAULT_FEE_CONFIG.vatRate
	};
}

const TTL_MS = 5 * 60 * 1000;

interface VersionInfo {
	features: Features;
	demo: boolean;
	ssoProviders: SsoProviderSchema[];
	demoBookingUrl: string | null;
	supportEmail: string | null;
	turnstileSiteKey: string | null;
	fees: PlatformFeeConfig;
}

const FALLBACK: VersionInfo = {
	features: DEFAULT_FEATURES,
	demo: false,
	ssoProviders: [],
	demoBookingUrl: null,
	supportEmail: null,
	turnstileSiteKey: null,
	fees: DEFAULT_FEE_CONFIG
};

let cache: { value: VersionInfo; expiry: number } | null = null;

/** Test-only: clear the in-memory cache between cases. */
export function __resetFeaturesCache(): void {
	cache = null;
}

/**
 * Fetch `GET /version` (feature flags + demo mode), cached for ~5 minutes.
 * `/version` is anonymous and identical for every user, so a shared cache is
 * safe. Any failure yields DEFAULT_FEATURES and `demo: false` (render the
 * normal UI rather than the demo variant). That is fail-OPEN for most flags —
 * never hide a capability that is actually enabled — but not all of them:
 * `referral_applications` defaults to `false` because its surfaces 404 when
 * the flag is off, so the reasoning is inverted there. See
 * `$lib/utils/features`. Only SUCCESSFUL reads are cached, so a blip does not
 * stick for the TTL either way.
 */
async function getVersionInfo(fetch: typeof globalThis.fetch): Promise<VersionInfo> {
	if (cache && cache.expiry > Date.now()) {
		return cache.value;
	}

	try {
		const { data, error } = await apiApiVersion({ fetch });
		if (error || !data) {
			return FALLBACK;
		}
		const value: VersionInfo = {
			features: resolveFeatures(data.features),
			demo: data.demo ?? false,
			ssoProviders: parseSsoProviders(data.sso_providers),
			demoBookingUrl: parseDemoBookingUrl(data.demo_booking_url),
			supportEmail: parseSupportEmail(data.support_email),
			turnstileSiteKey: parseTurnstileSiteKey(data.turnstile_site_key),
			fees: parseFeeRates(data.fees)
		};
		cache = { value, expiry: Date.now() + TTL_MS };
		return value;
	} catch {
		return FALLBACK;
	}
}

/** Backend feature flags (cached, fail-open). */
export async function getFeatures(fetch: typeof globalThis.fetch): Promise<Features> {
	return (await getVersionInfo(fetch)).features;
}

/**
 * Whether the backend runs in DEMO mode (cached, defaults to false). Lets
 * SSR render the right variant immediately — e.g. the login page's
 * demo-account dropdown — instead of swapping it in client-side after the
 * app store learns `demo: true` (a swap that eats typed credentials, #596).
 */
export async function getDemoMode(fetch: typeof globalThis.fetch): Promise<boolean> {
	return (await getVersionInfo(fetch)).demo;
}

/**
 * Configured OIDC login providers from `/version` (cached). Fail-CLOSED: any
 * failure yields [] — no providers, no SSO buttons. Unlike the feature flags,
 * showing a button for an unconfigured provider would be a dead link.
 */
export async function getSsoProviders(
	fetch: typeof globalThis.fetch
): Promise<SsoProviderSchema[]> {
	return (await getVersionInfo(fetch)).ssoProviders;
}

/**
 * Public demo-booking link from `/version` (cached). Fail-CLOSED: any failure
 * or unset/invalid URL yields null — the landing page simply omits its
 * "Book a call" CTA rather than rendering a dead link.
 */
export async function getDemoBookingUrl(fetch: typeof globalThis.fetch): Promise<string | null> {
	return (await getVersionInfo(fetch)).demoBookingUrl;
}

/**
 * Customer support address from `/version` (cached). Fail-CLOSED: any failure
 * or unset/invalid address yields null — callers then render generic
 * "contact us" copy rather than a dead mailto link.
 */
export async function getSupportEmail(fetch: typeof globalThis.fetch): Promise<string | null> {
	return (await getVersionInfo(fetch)).supportEmail;
}

/**
 * Cloudflare Turnstile site key from `/version` (cached). Null when the
 * backend has bot protection off — the register page then renders no widget.
 * A failed read also yields null (not cached); the backend still enforces the
 * check, so the submit fails and the register page re-runs its load to pick
 * the key up for the retry.
 */
export async function getTurnstileSiteKey(fetch: typeof globalThis.fetch): Promise<string | null> {
	return (await getVersionInfo(fetch)).turnstileSiteKey;
}

/**
 * Fee rates for the public landing-page calculator (cached, fail-safe to the
 * static defaults). These are ESTIMATES, not settlement figures: the Stripe pair
 * mirrors published card pricing that varies by card country/type, and the VAT
 * rate is the platform's domestic rate — real charges are computed server-side
 * per organization at invoicing time, where reverse charge may zero the VAT.
 * Falls back per-field, so a partial or malformed payload still supplies the
 * rates it does carry rather than blanking the whole calculator.
 */
export async function getPlatformFeeConfig(
	fetch: typeof globalThis.fetch
): Promise<PlatformFeeConfig> {
	return (await getVersionInfo(fetch)).fees;
}
