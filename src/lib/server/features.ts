import { apiApiVersion } from '$lib/api/generated/sdk.gen';
import { resolveFeatures, DEFAULT_FEATURES, type Features } from '$lib/utils/features';

const TTL_MS = 5 * 60 * 1000;

let cache: { value: Features; expiry: number } | null = null;

/** Test-only: clear the in-memory cache between cases. */
export function __resetFeaturesCache(): void {
	cache = null;
}

/**
 * Fetch the backend feature flags from `GET /version`, cached for ~5 minutes.
 * `/version` is anonymous and identical for every user, so a shared cache is
 * safe. Fail-open: any failure yields DEFAULT_FEATURES so we never hide a
 * capability that is actually enabled.
 */
export async function getFeatures(fetch: typeof globalThis.fetch): Promise<Features> {
	if (cache && cache.expiry > Date.now()) {
		return cache.value;
	}

	try {
		const { data, error } = await apiApiVersion({ fetch });
		if (error || !data) {
			return DEFAULT_FEATURES;
		}
		const value = resolveFeatures(data.features);
		cache = { value, expiry: Date.now() + TTL_MS };
		return value;
	} catch {
		return DEFAULT_FEATURES;
	}
}
