import { redirect } from '@sveltejs/kit';
import { eventpublicdetailsGetEvent } from '$lib/api';
import { log } from '$lib/server/logger';
import type { PageServerLoad } from './$types';

/**
 * Opaque Stripe-return route (#756, backend #849): Stripe success/cancel URLs
 * carry UUIDs instead of slugs so org/event names never reach Stripe. Resolve
 * the event with the caller's SSR auth (Lax cookies survive the top-level
 * redirect back from checkout.stripe.com) and 303 to the canonical slug URL,
 * forwarding the query string verbatim so payment_success/payment_cancelled
 * reach the landing page unchanged. Any failure sends the buyer to `/` —
 * never an error page on the way back from a payment. The org UUID segment
 * is parity-only; the event payload embeds the org slug.
 */
export const load: PageServerLoad = async ({ params, locals, fetch, url }) => {
	const headers: HeadersInit = {};
	if (locals.user?.accessToken) {
		headers['Authorization'] = `Bearer ${locals.user.accessToken}`;
	}

	let target = '/';
	try {
		const { data } = await eventpublicdetailsGetEvent({
			fetch,
			path: { event_id: params.event_id },
			headers
		});
		if (data) {
			target = `/events/${data.organization.slug}/${data.slug}${url.search}`;
		}
	} catch (err) {
		log.warning('uuid_event_resolve_failed', { error: err, eventId: params.event_id });
	}
	redirect(303, target);
};
