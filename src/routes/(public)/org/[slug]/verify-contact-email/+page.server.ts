import * as m from '$lib/paraglide/messages.js';
import { redirect } from '@sveltejs/kit';
import { organizationadmincoreVerifyContactEmail } from '$lib/api/generated/sdk.gen';
import type { PageServerLoad } from './$types';
import { loginHref } from '$lib/utils/safe-redirect';
import { extractErrorMessage } from '$lib/utils/errors';
import { getApiFailure, linkTokenFailureMessage } from '$lib/server/api-result';

export const load: PageServerLoad = async ({ params, url, locals, cookies }) => {
	const { slug } = params;
	const token = url.searchParams.get('token');

	// Token is required
	if (!token) {
		return {
			success: false,
			error: m['serverErrors.public.verificationTokenMissing'](),
			isVerifying: false,
			organizationSlug: slug,
			organizationName: null
		};
	}

	// Authentication required for verification
	if (!locals.user) {
		// Redirect to login with return URL
		const redirectUrl = `/org/${slug}/verify-contact-email?token=${token}`;
		throw redirect(303, loginHref(redirectUrl));
	}

	const accessToken = cookies.get('access_token');
	if (!accessToken) {
		// Redirect to login if no access token
		const redirectUrl = `/org/${slug}/verify-contact-email?token=${token}`;
		throw redirect(303, loginHref(redirectUrl));
	}

	try {
		// Call the verification endpoint with token in body
		const result = await organizationadmincoreVerifyContactEmail({
			headers: {
				Authorization: `Bearer ${accessToken}`
			},
			path: {
				slug
			},
			body: {
				token
			}
		});

		const { data } = result;
		const failure = getApiFailure(result);

		if (failure || !data) {
			// 400: typed link-token error (BE #1373), else the backend's own detail
			// (token issued for another organization). Every other status is about
			// the session or the organization, never the link. No response at all:
			// never show the transport error text.
			let errorMessage: string = m['serverErrors.public.unexpectedErrorRetry']();
			if (failure && !failure.network) {
				switch (failure.status) {
					case 400:
						errorMessage = linkTokenFailureMessage(failure.body, {
							invalid: m['serverErrors.public.verificationTokenInvalid'](),
							expired: m['serverErrors.public.verificationTokenExpired'](),
							fallback: m['serverErrors.public.verificationTokenInvalid']()
						}).message;
						break;
					case 401:
						errorMessage = m['serverErrors.common.mustBeLoggedIn']();
						break;
					case 403:
						errorMessage = m['serverErrors.common.organizationForbidden']();
						break;
					case 404:
						errorMessage = m['serverErrors.common.organizationNotFound']();
						break;
					case 429:
						errorMessage = m['serverErrors.public.tooManyAttempts']();
						break;
				}
			}

			return {
				success: false,
				error: errorMessage,
				isVerifying: false,
				organizationSlug: slug,
				organizationName: null
			};
		}

		// Success
		return {
			success: true,
			error: null,
			isVerifying: false,
			organizationSlug: slug,
			organizationName: data.name
		};
	} catch (err) {
		const errorMessage = extractErrorMessage(err, m['serverErrors.public.unexpectedErrorRetry']());

		return {
			success: false,
			error: errorMessage,
			isVerifying: false,
			organizationSlug: slug,
			organizationName: null
		};
	}
};
