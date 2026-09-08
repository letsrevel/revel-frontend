import * as m from '$lib/paraglide/messages.js';
import type { IntegrationErrorCode } from '$lib/api/generated/types.gen';
import { extractApiErrorDetail } from '$lib/utils/api-error-detail';

/**
 * Copy for every stable code the backend's `integrations` app can return
 * (`IntegrationErrorSchema.code`, `SyncReportEntry.code`, `?error=` on the
 * OAuth landing). The backend's `detail` is translated too, but on its own
 * locale and in its own words; these lines say what happened and what to do
 * next, and name the platform wherever the line is about it.
 *
 * Keyed as a full `Record` on purpose: a renamed or added backend code fails
 * `make types` here instead of silently falling through to the generic line.
 */
export type IntegrationErrorContext = 'landing' | 'action';

type Args = { platform: string; name: string };

const MESSAGES: Record<IntegrationErrorCode, (args: Args) => string> = {
	provider_unknown: () => m['integrations.error.provider_unknown'](),
	provider_not_connected: (a) => m['integrations.error.provider_not_connected'](a),
	already_connected: (a) => m['integrations.error.already_connected'](a),
	connection_pending: () => m['integrations.error.connection_pending'](),
	connection_revoked: (a) => m['integrations.error.connection_revoked'](a),
	provider_rate_limited: (a) => m['integrations.error.provider_rate_limited'](a),
	provider_rejected: (a) => m['integrations.error.provider_rejected'](a),
	state_invalid: () => m['integrations.error.state_invalid'](),
	account_unknown: (a) => m['integrations.error.account_unknown'](a),
	webhook_registration_failed: () => m['integrations.error.webhook_registration_failed'](),
	event_private: (a) => m['integrations.error.event_private'](a),
	event_open_ended: (a) => m['integrations.error.event_open_ended'](a),
	event_no_tickets: (a) => m['integrations.error.event_no_tickets'](a),
	tier_variable_price: () => m['integrations.error.tier_variable_price'](),
	tier_members_only: () => m['integrations.error.tier_members_only'](),
	tier_seated: () => m['integrations.error.tier_seated'](),
	tier_offline_payment: () => m['integrations.error.tier_offline_payment'](),
	tier_no_capacity: () => m['integrations.error.tier_no_capacity'](),
	tier_currency_mismatch: (a) => m['integrations.error.tier_currency_mismatch'](a),
	remote_event_missing: (a) => m['integrations.error.remote_event_missing'](a),
	remote_only_tier: (a) => m['integrations.error.remote_only_tier'](a),
	unpublish_refused: (a) => m['integrations.error.unpublish_refused'](a),
	image_missing: () => m['integrations.error.image_missing'](),
	pause_failed: (a) => m['integrations.error.pause_failed'](a),
	tier_not_linked: (a) => m['integrations.error.tier_not_linked'](a),
	stripe_not_connected: () => m['integrations.error.stripe_not_connected'](),
	import_failed: () => m['integrations.error.import_failed']()
};

/** Landing-page variants: the same code means something else mid-OAuth. */
const LANDING_MESSAGES: Partial<Record<IntegrationErrorCode, (args: Args) => string>> = {
	provider_rejected: (a) => m['integrations.error.provider_rejected.landing'](a)
};

function isKnownCode(code: string): code is IntegrationErrorCode {
	return Object.prototype.hasOwnProperty.call(MESSAGES, code);
}

/**
 * The line for a code, or `null` when the code is unknown (or absent) and the
 * caller should fall back to the backend's `detail`.
 */
export function integrationErrorMessage(
	code: string | null | undefined,
	platform: string,
	context: IntegrationErrorContext = 'action',
	name = ''
): string | null {
	if (!code || !isKnownCode(code)) return null;
	const args: Args = { platform, name };
	const landing = context === 'landing' ? LANDING_MESSAGES[code] : undefined;
	return (landing ?? MESSAGES[code])(args);
}

export interface IntegrationErrorInfo {
	code: IntegrationErrorCode | null;
	message: string;
	/** The platform's own words, rendered collapsed and never as the headline. */
	providerMessage: string | null;
}

function readEnvelope(error: unknown): {
	detail?: string;
	code?: string;
	provider_message: string | null;
} {
	if (typeof error !== 'object' || error === null) return { provider_message: null };
	const e = error as Record<string, unknown>;
	return {
		// Covers both `detail` shapes — the plain string and django-ninja's
		// request-validation 422 list (`api-error-detail.ts`).
		detail: extractApiErrorDetail(error) ?? undefined,
		code: typeof e.code === 'string' ? e.code : undefined,
		provider_message: typeof e.provider_message === 'string' ? e.provider_message : null
	};
}

/**
 * Turn a failed SDK call's `error` body (`{detail, code, provider_message}`)
 * into one line for the user plus the platform's own words.
 */
export function integrationErrorFromResponse(
	error: unknown,
	platform: string
): IntegrationErrorInfo {
	const { detail, code, provider_message } = readEnvelope(error);
	const mapped = integrationErrorMessage(code, platform);
	return {
		code: code && isKnownCode(code) ? code : null,
		message: mapped ?? detail ?? m['integrations.error.generic']({ platform }),
		providerMessage: provider_message
	};
}

export function isIntegrationErrorInfo(value: unknown): value is IntegrationErrorInfo {
	return (
		typeof value === 'object' &&
		value !== null &&
		typeof (value as IntegrationErrorInfo).message === 'string' &&
		'providerMessage' in value
	);
}

/**
 * What a mutation throws when the component renders the failure inline:
 * `silent: true` keeps the root layout's global "Action failed" toast quiet
 * (it reads that flag off the thrown error).
 */
export function silentIntegrationError(
	error: unknown,
	platform: string
): IntegrationErrorInfo & { silent: true } {
	return { ...integrationErrorFromResponse(error, platform), silent: true };
}
