import type { PageServerLoad } from './$types';
import { eventpublicdiscoveryListEvents } from '$lib/api';
import type { EventType, Visibility } from '$lib/api/generated/types.gen';
import { error as svelteKitError } from '@sveltejs/kit';
import { buildSeo } from '$lib/seo';
import { resolveLang } from '$lib/seo/server';
import { log } from '$lib/server/logger';

const EVENT_TYPES: readonly EventType[] = ['public', 'private', 'members-only'];
const VISIBILITIES: readonly Visibility[] = [
	'public',
	'unlisted',
	'private',
	'members-only',
	'staff-only'
];
const ORDER_BY_VALUES = ['start', '-start', 'distance'] as const;

/** Narrow a raw query-param string to one of the allowed literal values. */
function pickAllowed<T extends string>(value: string | null, allowed: readonly T[]): T | undefined {
	return allowed.find((candidate) => candidate === value);
}

export const load: PageServerLoad = async ({ request, url, fetch, locals }) => {
	const lang = resolveLang(request);
	const seo = buildSeo({ kind: 'events-listing', url, lang });
	// Parse query parameters
	const search = url.searchParams.get('search') || undefined;
	const page = parseInt(url.searchParams.get('page') || '1');
	const pageSize = 20;

	// Parse filter parameters
	const cityId = url.searchParams.get('city_id');
	const organization = url.searchParams.get('organization') || undefined;
	const eventType = pickAllowed(url.searchParams.get('event_type'), EVENT_TYPES);
	const visibility = pickAllowed(url.searchParams.get('visibility'), VISIBILITIES);
	const tagsParam = url.searchParams.get('tags');
	const tags = tagsParam ? tagsParam.split(',').filter(Boolean) : undefined;
	const includePast = url.searchParams.get('include_past') === 'true';
	const ticketType = url.searchParams.get('ticket_type') || undefined;
	const requiresTicket =
		ticketType === 'ticketed' ? true : ticketType === 'free' ? false : undefined;
	const orderBy = pickAllowed(url.searchParams.get('order_by'), ORDER_BY_VALUES) ?? 'distance';

	try {
		// Prepare query parameters
		const queryParams = {
			search,
			city_id: cityId ? parseInt(cityId) : undefined,
			organization,
			event_type: eventType,
			visibility: visibility,
			tags,
			page,
			page_size: pageSize,
			include_past: includePast,
			requires_ticket: requiresTicket,
			order_by: orderBy
		};

		// Prepare headers with authentication if user is logged in
		const headers: HeadersInit = {};
		if (locals.user?.accessToken) {
			headers['Authorization'] = `Bearer ${locals.user.accessToken}`;
		}

		// Call the API with SSR-compatible fetch and auth headers
		const response = await eventpublicdiscoveryListEvents({
			fetch,
			query: queryParams,
			headers
		});

		// Handle API errors
		if (response.error) {
			log.error('events_load_failed', { error: response.error });
			throw svelteKitError(500, 'Failed to load events. Please try again later.');
		}

		// Type guard: ensure response.data exists
		if (!response.data) {
			log.error('events_load_invalid_response');
			throw svelteKitError(500, 'Invalid API response');
		}

		// Return paginated data
		return {
			seo,
			events: response.data.results,
			totalCount: response.data.count,
			page,
			pageSize,
			nextUrl: response.data.next,
			previousUrl: response.data.previous,
			filters: {
				search,
				cityId: cityId ? parseInt(cityId) : undefined,
				organization,
				eventType,
				visibility,
				tags,
				includePast,
				orderBy
			}
		};
	} catch (err) {
		log.error('events_load_error', { error: err });

		// Return empty state rather than throwing to allow graceful degradation
		return {
			seo,
			events: [],
			totalCount: 0,
			page: 1,
			pageSize: 20,
			nextUrl: null,
			previousUrl: null,
			filters: {},
			error: 'Failed to load events. Please try again later.'
		};
	}
};
