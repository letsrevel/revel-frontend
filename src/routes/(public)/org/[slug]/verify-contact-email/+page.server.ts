import * as m from '$lib/paraglide/messages.js';
import { redirect } from '@sveltejs/kit';
import { organizationadmincoreVerifyContactEmail } from '$lib/api/generated/sdk.gen';
import type { PageServerLoad } from './$types';
import { loginHref } from '$lib/utils/safe-redirect';
import { extractErrorMessage } from '$lib/utils/errors';

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
		const { data, error: apiError } = await organizationadmincoreVerifyContactEmail({
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

		if (apiError || !data) {
			// Extract user-friendly error message from API error
			const errorMessage = extractErrorMessage(
				apiError,
				m['serverErrors.public.verificationTokenInvalid']()
			);

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
