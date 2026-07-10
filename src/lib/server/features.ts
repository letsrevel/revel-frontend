import { apiApiVersion } from '$lib/api/generated/sdk.gen';
import { resolveFeatures, DEFAULT_FEATURES, type Features } from '$lib/utils/features';

const TTL_MS = 5 * 60 * 1000;

interface VersionInfo {
	features: Features;
	demo: boolean;
}

const FALLBACK: VersionInfo = { features: DEFAULT_FEATURES, demo: false };

let cache: { value: VersionInfo; expiry: number } | null = null;

/** Test-only: clear the in-memory cache between cases. */
export function __resetFeaturesCache(): void {
	cache = null;
}

/**
 * Fetch `GET /version` (feature flags + demo mode), cached for ~5 minutes.
 * `/version` is anonymous and identical for every user, so a shared cache is
 * safe. Fail-open: any failure yields DEFAULT_FEATURES (never hide a
 * capability that is actually enabled) and `demo: false` (render the normal
 * UI rather than the demo variant).
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
			demo: data.demo ?? false
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
