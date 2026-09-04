import type { PageServerLoad } from './$types';
import { error } from '@sveltejs/kit';
import {
	eventpublicdetailsGetEvent,
	eventpublicdiscoveryGetEventTokenDetails
} from '$lib/api/generated/sdk.gen';
import type { EventTokenRejectionSchema } from '$lib/api/generated/types.gen';
import { extractErrorMessage } from '$lib/utils/errors';

export const load: PageServerLoad = async ({ params, fetch }) => {
	const tokenId = params.token_id;

	// Fetch token details (no auth required)
	const response = await eventpublicdiscoveryGetEventTokenDetails({
		fetch,
		path: { token_id: tokenId }
	});

	// An EXISTING but unservable token answers 410 with a reason + display
	// fields (revel-backend#681) — render guidance instead of a dead 404.
	if (response.response?.status === 410 && response.error) {
		return {
			token: null,
			rejection: response.error as unknown as EventTokenRejectionSchema,
			tokenId,
			canAttendWithoutLogin: false
		};
	}

	if (response.error || !response.data) {
		const errorMessage = extractErrorMessage(response.error, 'Token not found or expired');
		throw error(404, errorMessage);
	}

	// The token preview carries no event settings, so ask the event itself
	// whether guests may proceed without an account (backend #923: the guest
	// checkout/RSVP endpoints claim the link via X-Event-Token). The token
	// header makes a private event visible for this lookup. The client resolves
	// HTTP errors rather than throwing (`?? false` covers those); the catch is
	// only for network-level failures. Either way the lookup is non-critical —
	// no guest shortcut is offered and the sign-in path remains available.
	let canAttendWithoutLogin = false;
	try {
		const eventResponse = await eventpublicdetailsGetEvent({
			fetch,
			path: { event_id: response.data.event },
			headers: { 'X-Event-Token': tokenId }
		});
		canAttendWithoutLogin = eventResponse.data?.can_attend_without_login ?? false;
	} catch {
		// Network failure only — see above.
	}

	return {
		token: response.data,
		rejection: null,
		tokenId,
		canAttendWithoutLogin
	};
};
