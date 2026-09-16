import type { FeaturesSchema } from '$lib/api/generated/types.gen';

/** User-facing capability flags mirrored from the backend `GET /version`. */
export type Features = FeaturesSchema;

/**
 * Fail-open defaults. When `/version` is unreachable or a flag is absent we
 * treat the capability as ENABLED, preserving current behaviour. The backend
 * stays the source of truth (it still returns 403/404), so this hiding is
 * best-effort UX only. SSO providers are NOT a flag here — they come from the
 * version payload's `sso_providers` list via `$lib/server/features`'s
 * `getSsoProviders()` and fail CLOSED (no providers → no SSO buttons).
 */
export const DEFAULT_FEATURES: Features = {
	organization_creation: true,
	telegram: true,
	llm_evaluation: true,
	/*
	 * The ONE fail-CLOSED flag. `referral_applications` gates a surface that
	 * does not exist when the flag is off: `/referral/apply` 404s server-side
	 * and the backend refuses `POST /referral/apply` with a 404 of its own. So
	 * the fail-open default would not "preserve current behaviour" here — it
	 * would render a footer link and an account CTA that both dead-end on a
	 * 404 page whenever `/version` is briefly unreachable. Hiding a working
	 * capability for the duration of a blip is the cheaper failure. (Only
	 * successful `/version` reads are cached, so a blip does not stick for the
	 * 5-minute TTL.)
	 */
	referral_applications: false
};

export function resolveFeatures(raw?: Partial<Features> | null): Features {
	return { ...DEFAULT_FEATURES, ...(raw ?? {}) };
}
