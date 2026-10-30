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
	returnTo?: Exclude<StripeReturnTo, 'event'>
): Promise<string>;
/** `return_to: 'event'` sends the user back to that event's ticketing tab. */
export async function requestStripeOnboardingLink(
	slug: string,
	email: string,
	accessToken: string,
	returnTo: 'event',
	eventId: string
): Promise<string>;
export async function requestStripeOnboardingLink(
	slug: string,
	email: string,
	accessToken: string,
	returnTo: StripeReturnTo = 'settings',
	eventId?: string
): Promise<string> {
	// The backend 422s on event_id without return_to 'event' (and vice versa).
	const body =
		returnTo === 'event' && eventId
			? { email, return_to: returnTo, event_id: eventId }
			: { email, return_to: returnTo };
	const response = await organizationadmincoreStripeConnect({
		path: { slug },
		headers: { Authorization: `Bearer ${accessToken}` },
		body
	});

	if (response.error) {
		throw new Error(
			extractApiErrorDetail(response.error) ?? m['stripeConnect.failedToCreateLink']()
		);
	}
	if (!response.data) throw new Error(m['stripeConnect.failedToCreateLink']());
	return response.data.onboarding_url;
}
