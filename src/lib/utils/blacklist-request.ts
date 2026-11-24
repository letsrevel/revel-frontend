import { organizationadminblacklistCreateBlacklistEntry } from '$lib/api';
import type { BlacklistCreateSchema } from '$lib/api/generated/types.gen';
import { backendMessage } from '$lib/utils/api-error-detail';

interface CreateBlacklistEntryArgs {
	slug: string;
	accessToken: string | null | undefined;
	body: BlacklistCreateSchema;
	/** Already-translated text for failures that carry no backend `detail`. */
	fallbackMessage: string;
}

/**
 * Creates a blacklist entry. Throws an Error carrying the backend's own
 * (translated) `detail` when there is one, for example the 403 a non-owner gets
 * when the entry matches a current staff member (BE #1529); otherwise the
 * caller's localized fallback. A network failure also gives the fallback.
 */
export async function requestCreateBlacklistEntry(args: CreateBlacklistEntryArgs) {
	let response;
	try {
		response = await organizationadminblacklistCreateBlacklistEntry({
			path: { slug: args.slug },
			body: args.body,
			headers: { Authorization: `Bearer ${args.accessToken}` }
		});
	} catch {
		// A thrown fetch error (offline, DNS) carries a raw English browser message.
		throw new Error(args.fallbackMessage);
	}
	if (response.error) {
		throw new Error(backendMessage(response.error) || args.fallbackMessage);
	}
	return response.data;
}
