import { error, isHttpError } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { eventadminwaitlistListWaitlist } from '$lib/api';
import { extractErrorMessage } from '$lib/utils/errors';
import { log } from '$lib/server/logger';
import * as m from '$lib/paraglide/messages.js';

export const load: PageServerLoad = async ({ params, locals, fetch }) => {
	const user = locals.user;

	if (!user) {
		throw error(401, m['serverErrors.adminEvents.loginToManageWaitlist']());
	}

	const headers: HeadersInit = {
		Authorization: `Bearer ${user.accessToken}`
	};

	// Load initial waitlist data
	try {
		const response = await eventadminwaitlistListWaitlist({
			fetch,
			path: { event_id: params.event_id },
			query: { page: 1, page_size: 20 },
			headers
		});

		if (response.error) {
			const errorMessage = extractErrorMessage(
				response.error,
				m['serverErrors.adminEvents.loadWaitlistFailed']()
			);
			throw error(500, errorMessage);
		}

		return {
			waitlistData: response.data,
			eventId: params.event_id
		};
	} catch (err) {
		if (isHttpError(err)) throw err;
		log.error('waitlist_load_failed', { error: err, eventId: params.event_id });
		if (typeof err === 'object' && err !== null && 'status' in err) {
			const status = (err as { status: number }).status;

			if (status === 404) {
				throw error(404, m['serverErrors.common.eventNotFound']());
			}

			if (status === 403) {
				throw error(403, m['serverErrors.common.permissionManageEvent']());
			}
		}

		const errorMessage = extractErrorMessage(
			err,
			m['serverErrors.adminEvents.loadWaitlistFailed']()
		);
		throw error(500, errorMessage);
	}
};
