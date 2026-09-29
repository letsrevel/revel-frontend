import { z } from 'zod';
import * as m from '$lib/paraglide/messages.js';
import type { OAuthAppSchema, OAuthAppUpdatePayload } from '$lib/api/generated/types.gen';
import { extractFieldErrors } from '$lib/utils/errors';

export type ClientType = OAuthAppSchema['client_type'];

export interface AppFormValues {
	name: string;
	description: string;
	client_type: ClientType;
	redirect_uris: string[];
	allowed_scopes: string[];
	homepage_url: string;
	privacy_policy_url: string;
}

export const NAME_MAX = 255;
export const DESCRIPTION_MAX = 2000;
export const REDIRECT_URIS_MAX = 10;

const LOOPBACK_HOSTS = new Set(['localhost', '127.0.0.1', '[::1]']);

export function isLoopbackHost(hostname: string): boolean {
	return LOOPBACK_HOSTS.has(hostname.toLowerCase());
}

/** Mirrors `OAuthApplication.clean()`: https everywhere, http only on loopback for public clients, no fragment. */
export function redirectUriError(uri: string, clientType: ClientType): string | null {
	// `new URL` percent-encodes inner whitespace instead of throwing, but the backend
	// stores the URIs space-joined and splits on whitespace, so one URI would become two.
	if (/\s/.test(uri)) return m['oauth.developer.validation.uriInvalid']();
	let url: URL;
	try {
		url = new URL(uri);
	} catch {
		return m['oauth.developer.validation.uriInvalid']();
	}
	if (url.hash) return m['oauth.developer.validation.uriFragment']();
	if (url.protocol === 'https:') return null;
	if (url.protocol === 'http:') {
		if (clientType !== 'public') return m['oauth.developer.validation.uriSchemeConfidential']();
		return isLoopbackHost(url.hostname) ? null : m['oauth.developer.validation.uriScheme']();
	}
	return clientType === 'public'
		? m['oauth.developer.validation.uriScheme']()
		: m['oauth.developer.validation.uriSchemeConfidential']();
}

function optionalUrl() {
	return z
		.string()
		.trim()
		.refine((v) => v === '' || (/^https?:\/\//i.test(v) && safeUrl(v)), {
			message: m['oauth.developer.validation.urlInvalid']()
		});
}

function safeUrl(v: string): boolean {
	try {
		new URL(v);
		return true;
	} catch {
		return false;
	}
}

export function appFormSchema(clientType: ClientType): z.ZodType<AppFormValues> {
	return z
		.object({
			name: z
				.string()
				.trim()
				.min(1, m['oauth.developer.validation.nameRequired']())
				.max(NAME_MAX, m['oauth.developer.validation.nameTooLong']()),
			description: z
				.string()
				.max(DESCRIPTION_MAX, m['oauth.developer.validation.descriptionTooLong']()),
			client_type: z.enum(['public', 'confidential']),
			redirect_uris: z
				.array(z.string().trim())
				.min(1, m['oauth.developer.validation.urisMin']())
				.max(REDIRECT_URIS_MAX, m['oauth.developer.validation.urisMax']())
				.superRefine((uris, ctx) => {
					uris.forEach((uri, index) => {
						const error = redirectUriError(uri, clientType);
						if (error) ctx.addIssue({ code: z.ZodIssueCode.custom, message: error, path: [index] });
						else if (uris.indexOf(uri) !== index) {
							ctx.addIssue({
								code: z.ZodIssueCode.custom,
								message: m['oauth.developer.validation.urisDuplicate'](),
								path: [index]
							});
						}
					});
				}),
			allowed_scopes: z
				.array(z.string())
				.refine(
					(scopes) =>
						!scopes.some((s) => s.startsWith('org:') && s !== 'org:read') ||
						scopes.includes('org:read'),
					{ message: m['oauth.developer.validation.orgReadRequired']() }
				),
			homepage_url: optionalUrl(),
			privacy_policy_url: optionalUrl()
		})
		.strict() as unknown as z.ZodType<AppFormValues>;
}

export function valuesFromApp(app: OAuthAppSchema): AppFormValues {
	return {
		name: app.name,
		description: app.description,
		client_type: app.client_type,
		redirect_uris: [...app.redirect_uris],
		allowed_scopes: [...app.allowed_scopes],
		homepage_url: app.homepage_url,
		privacy_policy_url: app.privacy_policy_url
	};
}

const sameSet = (a: readonly string[], b: readonly string[]) =>
	a.length === b.length && [...a].sort().every((v, i) => v === [...b].sort()[i]);

/** Only the keys that changed; `client_type` is never sent (switching it would invalidate the secret); no nulls. */
export function diffForPatch(initial: AppFormValues, next: AppFormValues): OAuthAppUpdatePayload {
	const body: OAuthAppUpdatePayload = {};
	if (next.name !== initial.name) body.name = next.name;
	if (next.description !== initial.description) body.description = next.description;
	if (next.redirect_uris.join('\n') !== initial.redirect_uris.join('\n'))
		body.redirect_uris = [...next.redirect_uris];
	if (!sameSet(next.allowed_scopes, initial.allowed_scopes))
		body.allowed_scopes = [...next.allowed_scopes];
	if (next.homepage_url !== initial.homepage_url) body.homepage_url = next.homepage_url;
	if (next.privacy_policy_url !== initial.privacy_policy_url)
		body.privacy_policy_url = next.privacy_policy_url;
	return body;
}

/** The backend revokes tokens for EVERY scope that disappears (current − next), not only for strict subsets. */
export function removedScopes(initial: readonly string[], next: readonly string[]): string[] {
	const keep = new Set(next);
	return initial.filter((scope) => !keep.has(scope));
}

/** Fields the developer-app form can render an error under; `redirect_uris.N` targets one row. */
const FORM_FIELD =
	/^(name|description|redirect_uris(\.\d+)?|allowed_scopes|homepage_url|privacy_policy_url)$/;

/**
 * Dotted error path -> form field key, or `null` when the form has nowhere to
 * show it (`__all__`, `_`, a bare `payload` model error, unknown keys), so the
 * caller routes it to the form-level message instead of dropping it.
 */
function formFieldKey(path: string): string | null {
	const key = path.startsWith('payload.') ? path.slice('payload.'.length) : path;
	return FORM_FIELD.test(key) ? key : null;
}

/**
 * Backend error body → form state. 400 `{errors}` and 422 `{detail: [...]}`
 * go through `extractFieldErrors`; `__all__`/unknown keys and everything else
 * become a form-level message. A 409 (the per-user cap) has its own copy; the
 * status rides on the thrown body as `__status` (see `queries/oauth.ts`).
 */
export function fieldErrorsFrom(error: unknown): {
	fields: Record<string, string>;
	form: string | null;
} {
	const fields: Record<string, string> = {};
	let form: string | null = null;
	const status =
		typeof error === 'object' && error !== null
			? (error as { __status?: number }).__status
			: undefined;
	if (status === 409) return { fields, form: m['oauth.developer.errors.limit']() };
	const place = (path: string, message: string) => {
		const key = formFieldKey(path);
		if (key) fields[key] ??= message;
		else form ??= message;
	};
	for (const { field, messages } of extractFieldErrors(error)) place(field, messages[0] ?? '');
	// A string-valued `{errors: {name: 'Too long'}}` is not an array; extractFieldErrors skips it.
	const raw =
		(typeof error === 'object' && error !== null
			? (error as { errors?: Record<string, unknown> }).errors
			: undefined) ?? {};
	for (const [key, value] of Object.entries(raw)) {
		if (typeof value === 'string') place(key, value);
	}
	if (!form && Object.keys(fields).length === 0) form = m['oauth.developer.errors.generic']();
	return { fields, form };
}
