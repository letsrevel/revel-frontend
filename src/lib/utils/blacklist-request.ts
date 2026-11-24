import { organizationadminblacklistCreateBlacklistEntry } from '$lib/api';
import type { BlacklistCreateSchema } from '$lib/api/generated/types.gen';
import { backendMessage } from '$lib/utils/api-error-detail';
import {
	isErasedHolder,
	staffViewDisplayName,
	type StaffViewUserInfo
} from '$lib/utils/user-display';

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

/** The account projection a blacklist row action works from. */
type BlacklistTarget = (StaffViewUserInfo & { id?: string | null }) | null | undefined;

/**
 * The create body for blacklisting a row's holder, or null when it cannot be done.
 * A live account is blacklisted by user id. An erased account has no profile left, so
 * the entry goes by the kept email (and the kept name, as `preferred_name`, when it
 * differs from the email); with no kept email there is nothing to match and it is null.
 */
export function blacklistBodyForHolder(user: BlacklistTarget): BlacklistCreateSchema | null {
	if (!user) return null;
	if (isErasedHolder(user)) {
		const email = user.email?.trim();
		if (!email) return null;
		const name = staffViewDisplayName(user, '').trim();
		const body: BlacklistCreateSchema = { email, reason: '' };
		if (name && name.toLowerCase() !== email.toLowerCase()) body.preferred_name = name;
		return body;
	}
	return user.id ? { user_id: user.id, reason: '' } : null;
}

/** Whether the Blacklist row action should be offered for this holder. */
export function canBlacklistHolder(user: BlacklistTarget): boolean {
	return blacklistBodyForHolder(user) !== null;
}
