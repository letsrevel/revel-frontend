import { error, fail } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { referralApply } from '$lib/api/generated/sdk.gen';
import { getFeatures } from '$lib/server/features';
import { log } from '$lib/server/logger';
import { buildSeo } from '$lib/seo';
import { resolveLang } from '$lib/seo/server';
import {
	classifyReferralConflict,
	referralApplicationSchema,
	trimApplicationInput,
	type ReferralApplicationInput,
	type ReferralApplicationIssue
} from '$lib/schemas/referral';
import { extractErrorMessage } from '$lib/utils/errors';

/**
 * Public referral-program application (FE #938, BE #987).
 *
 * SSR + a form action rather than a client-side fetch, for three reasons:
 *  - the feature flag has to 404 the ROUTE, not merely hide a button;
 *  - `POST /referral/apply` is throttled 10/day/IP, and the SSR path carries
 *    the visitor's real IP to the backend (`handleFetch` sets X-Real-IP /
 *    X-Forwarded-For), so the throttle still counts the right party;
 *  - it works with JavaScript off.
 */

/**
 * What went wrong, as a stable key. The action never returns prose: the page
 * owns the copy so it can be translated. Field keys land on the field they
 * blame, `form` keys render as the banner above the form.
 */
export type ReferralApplyErrorKey =
	ReferralApplicationIssue | 'code_taken' | 'pending' | 'throttled' | 'generic';

export interface ReferralApplyErrors {
	email?: ReferralApplyErrorKey;
	code?: ReferralApplyErrorKey;
	note?: ReferralApplyErrorKey;
	form?: ReferralApplyErrorKey;
}

/**
 * Every failure answers with the SAME shape, through this one helper.
 * Returning object literals per branch made SvelteKit infer a union of narrow
 * shapes (`{ form: 'throttled' }` has no `email` key), and the page then could
 * not read `errors.email` without a cast.
 */
interface ReferralApplyFailure {
	errors: ReferralApplyErrors;
	values: ReferralApplicationInput;
}

function applyFailure(status: number, failure: ReferralApplyFailure) {
	return fail(status, failure);
}

export const load: PageServerLoad = async ({ fetch, url, request }) => {
	const features = await getFeatures(fetch);
	if (!features.referral_applications) {
		// The same answer the backend gives while applications are closed. Not a
		// redirect: there is nothing at this URL to redirect to.
		error(404, 'Not found');
	}

	const lang = resolveLang(request);
	// No email prefill here: `locals.user` is the MINIMAL JWT-derived variant on
	// most requests (the backend's access token carries no email claim), so the
	// page fills the field from the in-memory auth store once it hydrates.
	return { seo: buildSeo({ kind: 'referral-apply', url, lang }) };
};

export const actions = {
	default: async ({ request, fetch }) => {
		const formData = await request.formData();
		const values = trimApplicationInput({
			email: (formData.get('email') as string) ?? '',
			code: (formData.get('code') as string) ?? '',
			note: (formData.get('note') as string) ?? ''
		});

		const validation = referralApplicationSchema.safeParse(values);
		if (!validation.success) {
			const errors: ReferralApplyErrors = {};
			for (const issue of validation.error.issues) {
				const field = issue.path[0];
				// The zod message IS the error key (see `$lib/schemas/referral`).
				// First issue per field wins.
				if ((field === 'email' || field === 'code' || field === 'note') && !errors[field]) {
					errors[field] = issue.message as ReferralApplyErrorKey;
				}
			}
			return applyFailure(400, { errors, values });
		}

		const response = await referralApply({ body: validation.data, fetch });
		const status = response.response?.status;

		// 202 is the only success code — and the backend deliberately answers 202
		// for blocked and already-enrolled emails too. Nothing here may branch in
		// a way that lets a caller tell those apart (BE #987).
		if (status === 202) {
			return { success: true };
		}

		if (status === 404) {
			// The flag was switched off between rendering the form and this POST.
			error(404, 'Not found');
		}

		if (status === 409) {
			const conflict = classifyReferralConflict(extractErrorMessage(response.error, ''));
			// Logged unclassified so a backend rewording shows up as a spike here
			// rather than only as vaguer copy for users.
			log.info('referral_apply_conflict', { classified: conflict ?? 'unknown' });
			const errors: ReferralApplyErrors =
				conflict === 'code_taken'
					? { code: 'code_taken' }
					: { form: conflict === 'pending' ? 'pending' : 'generic' };
			return applyFailure(409, { errors, values });
		}

		if (status === 422) {
			/*
			 * Two different 422s share this status, and the body tells them apart:
			 * ninja's own request validation answers with `detail` as a LIST of
			 * per-field objects, while the service's `HttpError(422, …)` answers
			 * with `detail` as a STRING. Our zod schema mirrors the backend's
			 * field rules, so the string one is the single check only the backend
			 * does — `sanitize_note` strips tags, and a note that is nothing BUT
			 * tags reduces to empty. Blame the note for that, and fall back to the
			 * generic banner for a schema mismatch we did not anticipate rather
			 * than pointing the user at a field that may be fine.
			 */
			const detail = (response.error as { detail?: unknown } | undefined)?.detail;
			return applyFailure(422, {
				errors: typeof detail === 'string' ? { note: 'note_required' } : { form: 'generic' },
				values
			});
		}

		if (status === 429) {
			return applyFailure(429, { errors: { form: 'throttled' }, values });
		}

		log.warning('referral_apply_failed', { status });
		return applyFailure(status && status >= 400 ? status : 500, {
			errors: { form: 'generic' },
			values
		});
	}
} satisfies Actions;
