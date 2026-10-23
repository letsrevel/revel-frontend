/**
 * API adapter for the org brand-color settings (#1054).
 *
 * TODO(#1054): switch to generated SDK fns after regen. The backend contract
 * (brand_primary_color / brand_accent_color on OrganizationEditSchema and
 * GET .../brand-theme-preview) is not in the generated client yet. Until
 * `pnpm generate:api` picks it up, both calls go through the shared generated
 * `client` (so auth headers, Accept-Language and the 401 refresh interceptor
 * still apply) and are typed against `BrandThemeInput`. After regen, replace the
 * bodies with `organizationadmincoreUpdateOrganization` and the new preview SDK
 * function; nothing outside this file needs to change.
 *
 * The server owns all contrast math. This module never adjusts a color.
 */
import { client } from '$lib/api/client';
import type { BrandThemeInput } from '$lib/utils/brand-theme';

/** A 400 (or other API failure) whose `detail` can be shown next to a field. */
export class BrandColorsApiError extends Error {
	readonly detail: string | null;
	readonly status: number | undefined;
	/** Save-time 400s: `{"errors": {"brand_primary_color": ["..."]}}`, keyed by form field. */
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

function detailOf(error: unknown): string | null {
	if (error && typeof error === 'object' && 'detail' in error) {
		const detail = (error as { detail: unknown }).detail;
		if (typeof detail === 'string') return detail;
		if (Array.isArray(detail)) {
			const msgs = detail
				.map((d) => (d && typeof d === 'object' && 'msg' in d ? String(d.msg) : null))
				.filter((s): s is string => Boolean(s));
			if (msgs.length) return msgs.join(' ');
		}
	}
	return null;
}

function fieldErrorsOf(error: unknown): Partial<Record<'primary' | 'accent', string>> {
	const out: Partial<Record<'primary' | 'accent', string>> = {};
	if (!error || typeof error !== 'object' || !('errors' in error)) return out;
	const errors = (error as { errors: unknown }).errors;
	if (!errors || typeof errors !== 'object') return out;
	const read = (key: string): string | undefined => {
		const value = (errors as Record<string, unknown>)[key];
		if (typeof value === 'string') return value;
		if (Array.isArray(value)) return value.map(String).join(' ') || undefined;
		return undefined;
	};
	const primary = read('brand_primary_color');
	const accent = read('brand_accent_color');
	if (primary) out.primary = primary;
	if (accent) out.accent = accent;
	return out;
}

function toError(error: unknown, status: number | undefined): BrandColorsApiError {
	const detail = detailOf(error);
	return new BrandColorsApiError(detail ?? 'Request failed', detail, status, fieldErrorsOf(error));
}

const SECURITY = [{ key: 'ScopedJWTAuth', scheme: 'bearer', type: 'http' }] as const;

/** Server-resolved per-mode theme for the given colors; null when no primary. */
export async function previewBrandTheme(
	slug: string,
	primary: string | null,
	accent: string | null,
	signal?: AbortSignal
): Promise<BrandThemeInput | null> {
	if (!primary) return null;
	const query: Record<string, string> = { primary };
	if (accent) query.accent = accent;
	const result = await client.get({
		url: '/api/organization-admin/{slug}/brand-theme-preview',
		path: { slug },
		query,
		signal,
		security: [...SECURITY]
	});
	if (result.error !== undefined) throw toError(result.error, result.response?.status);
	return (result.data as BrandThemeInput | null | undefined) ?? null;
}

/** Persist both colors (null clears). Throws `BrandColorsApiError` on failure. */
export async function saveBrandColors(
	slug: string,
	primary: string | null,
	accent: string | null
): Promise<void> {
	const result = await client.put({
		url: '/api/organization-admin/{slug}',
		path: { slug },
		body: { brand_primary_color: primary, brand_accent_color: accent },
		headers: { 'Content-Type': 'application/json' },
		security: [...SECURITY]
	});
	if (result.error !== undefined) throw toError(result.error, result.response?.status);
}
