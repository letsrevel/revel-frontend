import * as m from '$lib/paraglide/messages.js';
import { backendMessage } from '$lib/utils/api-error-detail';
import { RegisterApiError } from './api';

export type RegisterAction = 'save' | 'end' | 'delete' | 'export';

export interface DescribedError {
	/** 409: the entry changed since the page loaded; callers refetch. */
	stale: boolean;
	/** Our translated lead sentence. */
	message: string;
	/** The server's own (translated) detail, when it adds something. */
	detail: string | null;
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
			message:
				action === 'export'
					? m['memberRegister.errorExportThrottled']()
					: m['memberRegister.errorThrottled'](),
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
