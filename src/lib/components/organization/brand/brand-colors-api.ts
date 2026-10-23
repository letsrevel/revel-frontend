/**
 * API adapter for the org brand-color settings (#1054): the only place the card
 * touches the generated SDK. The server owns all contrast math; nothing here
 * adjusts a color.
 */
import {
	organizationadmincoreBrandThemePreview,
	organizationadmincoreUpdateBranding
} from '$lib/api/generated/sdk.gen';
import type { BrandTheme, OrganizationBrandingResponse } from '$lib/api/generated/types.gen';

/** A failed preview or save; `detail` / `fieldErrors` carry what can be shown inline. */
export class BrandColorsApiError extends Error {
	readonly detail: string | null;
	readonly status: number | undefined;
	/** Save-time 422s: `{"detail": [{"loc": [..., "primary_color"], "msg"}]}`, keyed by `loc[-1]`. */
	readonly fieldErrors: Partial<Record<'primary' | 'accent', string>>;

	constructor(
		message: string,
		detail: string | null,
		status?: number,
		fieldErrors: Partial<Record<'primary' | 'accent', string>> = {}
	) {
		super(message);
		this.name = 'BrandColorsApiError';
		this.detail = detail;
		this.status = status;
		this.fieldErrors = fieldErrors;
	}
}

/** Preview 400s carry `{"detail": "<translated string>"}`. */
function detailOf(error: unknown): string | null {
	if (error && typeof error === 'object' && 'detail' in error) {
		const detail = (error as { detail: unknown }).detail;
		if (typeof detail === 'string') return detail;
	}
	return null;
}

/**
 * Save 422s: `{"detail": [{"type": "invalid_hex_color", "loc": ["body", "payload",
 * "primary_color"], "msg": "<translated>"}]}`. Keyed by the last `loc` segment;
 * the message is shown as-is and never inspected. Anything else yields no field
 * errors, so the caller falls back to its generic toast.
 */
function fieldErrorsOf(
	error: unknown,
	status: number | undefined
): Partial<Record<'primary' | 'accent', string>> {
	const out: Partial<Record<'primary' | 'accent', string>> = {};
	if (status !== 422 || !error || typeof error !== 'object' || !('detail' in error)) return out;
	const detail = (error as { detail: unknown }).detail;
	if (!Array.isArray(detail)) return out;
	for (const item of detail) {
		if (!item || typeof item !== 'object') continue;
		const { type, loc, msg } = item as { type?: unknown; loc?: unknown; msg?: unknown };
		if (type === 'extra_forbidden' || typeof msg !== 'string' || !Array.isArray(loc)) continue;
		const key = loc[loc.length - 1];
		if (key === 'primary_color') out.primary = msg;
		else if (key === 'accent_color') out.accent = msg;
	}
	return out;
}

function toError(error: unknown, status: number | undefined): BrandColorsApiError {
	const detail = detailOf(error);
	return new BrandColorsApiError(
		detail ?? 'Request failed',
		detail,
		status,
		fieldErrorsOf(error, status)
	);
}

/** Server-resolved per-mode theme for the given colors; null when no primary. */
export async function previewBrandTheme(
	slug: string,
	primary: string | null,
	accent: string | null,
	signal?: AbortSignal
): Promise<BrandTheme | null> {
	if (!primary) return null;
	const res = await organizationadmincoreBrandThemePreview({
		path: { slug },
		query: { primary, accent },
		signal
	});
	// hey-api's `error` IS the parsed response body.
	if (res.error !== undefined) throw toError(res.error, res.response?.status);
	return res.data ?? null;
}

/**
 * Persist both colors (null clears; never ""). Resolves with the saved branding
 * and the server-resolved theme. Throws `BrandColorsApiError` on failure.
 */
export async function saveBrandColors(
	slug: string,
	primary: string | null,
	accent: string | null
): Promise<OrganizationBrandingResponse> {
	const res = await organizationadmincoreUpdateBranding({
		path: { slug },
		body: { primary_color: primary, accent_color: accent }
	});
	if (res.error !== undefined || !res.data) throw toError(res.error, res.response?.status);
	return res.data;
}
