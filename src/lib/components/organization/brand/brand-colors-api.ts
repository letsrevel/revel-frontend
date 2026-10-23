/**
 * API adapter for the org brand-color settings (#1054): the only place the card
 * touches the generated SDK. The server owns all contrast math; nothing here
 * adjusts a color.
 */
import {
	organizationadmincoreBrandThemePreview,
	organizationadmincoreUpdateOrganization
} from '$lib/api/generated/sdk.gen';
import type { BrandTheme, Visibility } from '$lib/api/generated/types.gen';

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

/** Persist both colors (null clears), echoing the org's current visibility. Throws `BrandColorsApiError` on failure. */
export async function saveBrandColors(
	slug: string,
	primary: string | null,
	accent: string | null,
	visibility: Visibility
): Promise<void> {
	const res = await organizationadmincoreUpdateOrganization({
		path: { slug },
		// `visibility` is the one required field on OrganizationEditSchema; echoing the
		// current value changes nothing. Every other field is left unset, so the
		// server's exclude_unset update leaves it alone.
		body: { visibility, brand_primary_color: primary, brand_accent_color: accent }
	});
	if (res.error !== undefined) throw toError(res.error, res.response?.status);
}
