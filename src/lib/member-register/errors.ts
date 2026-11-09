import * as m from '$lib/paraglide/messages.js';
import { getDateLocale } from '$lib/utils/date';
import { backendMessage } from '$lib/utils/api-error-detail';
import { RegisterApiError } from './api';

export type RegisterAction = 'save' | 'end' | 'delete' | 'export' | 'invite' | 'invite-all';

export interface DescribedError {
	/** 409: the entry changed since the page loaded; callers refetch. */
	stale: boolean;
	/** 429: rate-limited; retrying right away cannot succeed. */
	throttled?: boolean;
	/** Our translated lead sentence. */
	message: string;
	/** The server's own (translated) detail, when it adds something. */
	detail: string | null;
}

/** "3 hours" / "20 minutes" in the UI language; rounds up so it never undersells the wait. */
export function formatWait(seconds: number): string {
	const hours = seconds >= 3600;
	const value = hours ? Math.ceil(seconds / 3600) : Math.max(1, Math.ceil(seconds / 60));
	return new Intl.NumberFormat(getDateLocale(), {
		style: 'unit',
		unit: hours ? 'hour' : 'minute',
		unitDisplay: 'long'
	}).format(value);
}

function throttledMessage(action: RegisterAction, retryAfter: number | null): string {
	if (action === 'export') return m['memberRegister.errorExportThrottled']();
	if (action === 'invite-all') {
		// Retry-After tells a burst throttle (seconds) from the rolling 5-per-24h one (hours).
		return retryAfter
			? m['memberRegister.errorInviteAllThrottledIn']({ time: formatWait(retryAfter) })
			: m['memberRegister.errorInviteAllThrottled']();
	}
	return m['memberRegister.errorThrottled']();
}

/**
 * Turn a failed register call into UI copy. Status drives the lead sentence;
 * the backend `detail` (already localized server-side) rides along as a second
 * line so the specific refusal is never lost.
 */
export function describeRegisterError(error: unknown, action: RegisterAction): DescribedError {
	const status = error instanceof RegisterApiError ? error.status : 0;
	const server = error instanceof RegisterApiError ? backendMessage(error.body) : null;

	if (status === 429) {
		return {
			stale: false,
			throttled: true,
			message: throttledMessage(
				action,
				error instanceof RegisterApiError ? error.retryAfterSeconds : null
			),
			detail: null
		};
	}
	if (status === 409) {
		const message =
			action === 'delete'
				? m['memberRegister.errorDeleteLinked']()
				: m['memberRegister.errorStale']();
		return { stale: action !== 'delete', message, detail: server };
	}
	if (status === 404) {
		return { stale: true, message: m['memberRegister.errorNotFound'](), detail: null };
	}
	if (status === 400 || status === 422) {
		return { stale: false, message: server ?? m['memberRegister.errorInvalid'](), detail: null };
	}
	return { stale: false, message: m['memberRegister.errorGeneric'](), detail: null };
}
