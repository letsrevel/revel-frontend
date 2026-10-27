import * as m from '$lib/paraglide/messages.js';
import { organizationadmincoreStripeConnect } from '$lib/api/generated/sdk.gen';
import type { StripeReturnTo } from '$lib/api/generated/types.gen';
import { extractApiErrorDetail } from '$lib/utils/api-error-detail';

/**
 * Asks the backend for a Stripe Connect onboarding link and returns its URL.
 * Throws an Error with a user-presentable message on failure.
 */
export async function requestStripeOnboardingLink(
	slug: string,
	email: string,
	accessToken: string,
	returnTo: StripeReturnTo = 'settings'
): Promise<string> {
	const response = await organizationadmincoreStripeConnect({
		path: { slug },
		headers: { Authorization: `Bearer ${accessToken}` },
		body: { email, return_to: returnTo }
	});

	if (response.error) {
		throw new Error(
			extractApiErrorDetail(response.error) ?? m['stripeConnect.failedToCreateLink']()
		);
	}
	if (!response.data) throw new Error(m['stripeConnect.failedToCreateLink']());
	return response.data.onboarding_url;
}
