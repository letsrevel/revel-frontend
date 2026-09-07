import { error } from '@sveltejs/kit';
import { pollGetPoll } from '$lib/api/generated/sdk.gen';
import { extractErrorMessage } from '$lib/utils/errors';
import { log } from '$lib/server/logger';
import { throwIfTransientUpstream } from '$lib/server/upstream';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ params, locals, fetch }) => {
	const accessToken = locals.user?.accessToken;

	const headers: Record<string, string> = {};
	if (accessToken) headers['Authorization'] = `Bearer ${accessToken}`;

	const res = await pollGetPoll({
		fetch,
		path: { poll_id: params.id },
		headers
	});

	if (res.error) {
		const status = res.response?.status ?? 500;
		// Backend distinguishes 403 (poll exists, caller not in any audience)
		// from 404 (poll genuinely does not exist). Render an inline "no
		// access" page for 403 so the user knows the poll is real but not
		// for them, instead of bouncing them to the global 404 page.
		if (status === 403) {
			return {
				poll: null,
				forbidden: true as const,
				isAuthenticated: !!accessToken
			};
		}
		log.error('poll_load_failed', { error: res.error, status });
		// After logging (so throttling/outages stay visible in the structured
		// logs), a transient upstream failure (429/5xx) becomes a 503 page.
		throwIfTransientUpstream(res.response);
		const message = extractErrorMessage(res.error, 'Failed to load poll');
		// 403 is handled above and 429/5xx became a 503 above; preserve any
		// other upstream client-error status (401/404/410/422). Only a
		// status-less transport failure still falls back to 500 here.
		throw error(status >= 400 && status < 500 ? status : 500, message);
	}

	if (!res.data) {
		throw error(500, 'Failed to load poll');
	}

	return {
		poll: res.data,
		forbidden: false as const,
		isAuthenticated: !!accessToken
	};
};
