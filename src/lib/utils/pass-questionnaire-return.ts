import { page } from '$app/state';
import { replaceState } from '$app/navigation';
import { QUESTIONNAIRE_RETURN_PARAM } from '$lib/utils/internal-return-url';

/** How the buyer left the questionnaire page: submitted and admitted, or sent to review. */
export type PassReturnSignal = 'done' | 'pending';

let stripScheduled = false;

/**
 * Read the one-shot `?questionnaire=` signal on the current URL (`null` when
 * absent) and schedule its removal, so a refresh doesn't replay it. The removal
 * is deferred one task so every card mounted in the same flush reads it first.
 */
export function capturePassReturnSignal(): PassReturnSignal | null {
	const value = page.url.searchParams.get(QUESTIONNAIRE_RETURN_PARAM);
	if (value !== 'done' && value !== 'pending') return null;
	if (!stripScheduled) {
		stripScheduled = true;
		setTimeout(() => {
			stripScheduled = false;
			try {
				const url = new URL(page.url);
				url.searchParams.delete(QUESTIONNAIRE_RETURN_PARAM);
				// eslint-disable-next-line svelte/no-navigation-without-resolve -- same page, query only
				replaceState(url, page.state);
			} catch {
				// Router not initialised (tests, very early): the URL keeps the param.
			}
		}, 0);
	}
	return value;
}
