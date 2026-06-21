import type { FeaturesSchema } from '$lib/api/generated/types.gen';

/** User-facing capability flags mirrored from the backend `GET /version`. */
export type Features = FeaturesSchema;

/**
 * Fail-open defaults. When `/version` is unreachable or a flag is absent we
 * treat the capability as ENABLED, preserving current behaviour. The backend
 * stays the source of truth (it still returns 403/404), so this hiding is
 * best-effort UX only. `google_sso` defaults to false to match the backend
 * default and because no SSO UI exists yet.
 */
export const DEFAULT_FEATURES: Features = {
	organization_creation: true,
	telegram: true,
	google_sso: false,
	llm_evaluation: true
};

export function resolveFeatures(raw?: Partial<Features> | null): Features {
	return { ...DEFAULT_FEATURES, ...(raw ?? {}) };
}
