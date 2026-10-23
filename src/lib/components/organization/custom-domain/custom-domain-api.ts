/**
 * API adapter for the org custom-domain settings (#1058): the only place the
 * UI touches the generated SDK. hey-api's `error` IS the parsed response body,
 * so failures are classified by status and by the FIELD NAME in the body, never
 * by message text (the messages are translated server-side and shown as-is).
 */
import {
	organizationadmincustomdomainDeleteCustomDomain,
	organizationadmincustomdomainGetCustomDomain,
	organizationadmincustomdomainRefreshCustomDomain,
	organizationadmincustomdomainRequestCustomDomain
} from '$lib/api/generated/sdk.gen';
import type { CustomDomainSchema } from '$lib/api/generated/types.gen';
import type { Tone } from '$lib/components/common/tones';

export type CustomDomain = CustomDomainSchema;

/** A failed custom-domain call; `fieldErrors` / `detail` carry what can be shown. */
export class CustomDomainApiError extends Error {
	readonly status: number | undefined;
	/** 400 `{"errors": {"hostname": [...]}}`: translated messages for the hostname field. */
	readonly fieldErrors: string[];
	/** 409 / 502 / 404 `{"detail": "..."}`. */
	readonly detail: string | null;

	constructor(
		message: string,
		status: number | undefined,
		fieldErrors: string[] = [],
		detail: string | null = null
	) {
		super(message);
		this.name = 'CustomDomainApiError';
		this.status = status;
		this.fieldErrors = fieldErrors;
		this.detail = detail;
	}
}

function detailOf(error: unknown): string | null {
	if (error && typeof error === 'object' && 'detail' in error) {
		const detail = (error as { detail: unknown }).detail;
		if (typeof detail === 'string') return detail;
	}
	return null;
}

function hostnameErrorsOf(error: unknown): string[] {
	if (!error || typeof error !== 'object' || !('errors' in error)) return [];
	const errors = (error as { errors: unknown }).errors;
	if (!errors || typeof errors !== 'object' || !('hostname' in errors)) return [];
	const value = (errors as { hostname: unknown }).hostname;
	if (typeof value === 'string') return [value];
	if (Array.isArray(value)) return value.filter((v): v is string => typeof v === 'string');
	return [];
}

function toError(error: unknown, status: number | undefined): CustomDomainApiError {
	const detail = detailOf(error);
	return new CustomDomainApiError(
		detail ?? 'Request failed',
		status,
		status === 400 ? hostnameErrorsOf(error) : [],
		detail
	);
}

/**
 * What an organizer typically pastes: surrounding spaces, capitals, a scheme,
 * a trailing slash. The backend validates strictly (no ports, paths, IPs), so
 * this only removes the cosmetic noise.
 */
export function normalizeHostname(input: string): string {
	return input
		.trim()
		.toLowerCase()
		.replace(/^[a-z][a-z0-9+.-]*:\/\//, '')
		.replace(/\/+$/, '');
}

/** The latest non-removed domain, or null when the org has none. */
export async function getCustomDomain(slug: string): Promise<CustomDomain | null> {
	const res = await organizationadmincustomdomainGetCustomDomain({ path: { slug } });
	if (res.error !== undefined) throw toError(res.error, res.response?.status);
	return res.data ?? null;
}

export async function requestCustomDomain(slug: string, hostname: string): Promise<CustomDomain> {
	const res = await organizationadmincustomdomainRequestCustomDomain({
		path: { slug },
		body: { hostname }
	});
	if (res.error !== undefined || !res.data) throw toError(res.error, res.response?.status);
	return res.data;
}

export async function refreshCustomDomain(slug: string): Promise<CustomDomain> {
	const res = await organizationadmincustomdomainRefreshCustomDomain({ path: { slug } });
	if (res.error !== undefined || !res.data) throw toError(res.error, res.response?.status);
	return res.data;
}

export async function deleteCustomDomain(slug: string): Promise<void> {
	const res = await organizationadmincustomdomainDeleteCustomDomain({ path: { slug } });
	if (res.error !== undefined) throw toError(res.error, res.response?.status);
}

/** Thin domain mapper for `StatusBadge`: pending warns, active succeeds, failed is danger. */
export function domainStatusTone(status: CustomDomain['status']): Tone {
	switch (status) {
		case 'active':
			return 'success';
		case 'failed':
			return 'danger';
		default:
			return 'warning';
	}
}

/** How often the page re-reads a pending domain (the server also syncs every 15 min). */
export const PENDING_POLL_MS = 45_000;
