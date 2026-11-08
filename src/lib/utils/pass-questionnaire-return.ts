import { page } from '$app/state';
import { replaceState } from '$app/navigation';
import {
	QUESTIONNAIRE_PASS_PARAM,
	QUESTIONNAIRE_RETURN_PARAM,
	currentPageReturnPath,
	withSearchParam
} from '$lib/utils/internal-return-url';

/** How the buyer left the questionnaire page: submitted and admitted, or sent to review. */
export type PassReturnSignal = 'done' | 'pending';

/**
 * The `returnUrl` a pass card hands to its questionnaire links: the page the
 * buyer is on, tagged with THIS pass's id so only this card reacts when they
 * come back. Login links keep using `currentPageReturnPath()` untagged.
 */
export function passQuestionnaireReturnPath(passId: string): string {
	return withSearchParam(currentPageReturnPath(), QUESTIONNAIRE_PASS_PARAM, passId);
}

let stripScheduled = false;

/**
 * Read the one-shot `?questionnaire=` signal for `passId` (`null` when absent or
 * aimed at another pass) and schedule removal of both return params, so a
 * refresh doesn't replay it. The removal is deferred one task so every card
 * mounted in the same flush reads the URL first.
 */
export function capturePassReturnSignal(passId: string): PassReturnSignal | null {
	const params = page.url.searchParams;
	const value = params.get(QUESTIONNAIRE_RETURN_PARAM);
	const target = params.get(QUESTIONNAIRE_PASS_PARAM);
	if (value === null && target === null) return null;
	if (!stripScheduled) {
		stripScheduled = true;
		setTimeout(() => {
			stripScheduled = false;
			try {
				const url = new URL(page.url);
				url.searchParams.delete(QUESTIONNAIRE_RETURN_PARAM);
				url.searchParams.delete(QUESTIONNAIRE_PASS_PARAM);
				// eslint-disable-next-line svelte/no-navigation-without-resolve -- same page, query only
				replaceState(url, page.state);
			} catch {
				// Router not initialised (tests, very early): the URL keeps the params.
			}
		}, 0);
	}
	if (target !== passId) return null;
	return value === 'done' || value === 'pending' ? value : null;
}
