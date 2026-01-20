import type { PageServerLoad } from './$types';
import {
	eventseriesGetEventSeriesBySlugs,
	eventpublicdiscoveryListEvents,
	permissionMyPermissions
} from '$lib/api';
import { error as svelteKitError } from '@sveltejs/kit';
import type { OrganizationPermissionsSchema } from '$lib/api/generated/types.gen';
import { extractErrorMessage } from '$lib/utils/errors';

export const load: PageServerLoad = async ({ params, url, fetch, locals }) => {
	const { org_slug, series_slug } = params;

	// Parse pagination and ordering
	const eventsPage = parseInt(url.searchParams.get('page') || '1');
	const pageSize = 12;
	const orderBy = url.searchParams.get('order_by') === 'start' ? 'start' : '-start'; // Default to newest first

	try {
		// Prepare headers with authentication if user is logged in
		const headers: HeadersInit = {};
		if (locals.user?.accessToken) {
			headers['Authorization'] = `Bearer ${locals.user.accessToken}`;
		}

		// Fetch the event series (pass auth to see private series)
		const seriesResponse = await eventseriesGetEventSeriesBySlugs({
			path: { org_slug, series_slug },
			fetch,
			headers
		});

		if (seriesResponse.error || !seriesResponse.data) {
			console.error('[Event Series Load] Failed to fetch series:', seriesResponse.error);
			throw svelteKitError(404, 'Event series not found');
		}

		const series = seriesResponse.data;

		// Fetch events for this series
		const eventsResponse = await eventpublicdiscoveryListEvents({
			fetch,
			query: {
				event_series: series.id,
				include_past: true, // Show all events in series
				order_by: orderBy,
				page: eventsPage,
				page_size: pageSize
			},
			headers
		});

		if (eventsResponse.error) {
			console.error('[Event Series Load] Failed to fetch events:', eventsResponse.error);
			// Don't fail the page if events fail, just show empty
		}

		// Fetch user permissions (requires authentication)
		let userPermissions: OrganizationPermissionsSchema | null = null;
		let canEdit = false;

		if (locals.user) {
			try {
				const permissionsResponse = await permissionMyPermissions({
					fetch,
					headers
				});

				if (permissionsResponse.data) {
					userPermissions = permissionsResponse.data;

					// Check if user is owner or staff of the organization
					const orgPermissions = userPermissions.organization_permissions?.[series.organization.id];

					// User can edit if they are owner or staff
					if (orgPermissions === 'owner') {
						canEdit = true;
					} else if (orgPermissions && typeof orgPermissions === 'object') {
						// If orgPermissions is an object with permission keys, user is staff
						canEdit = true;
					}
				}
			} catch (err) {
				// If permissions fail to load, continue without them
				console.error('Failed to fetch user permissions:', err);
			}
		}

		return {
			series,
			events: eventsResponse.data?.results || [],
			totalCount: eventsResponse.data?.count || 0,
			page: eventsPage,
			pageSize,
			orderBy,
			canEdit,
			isAuthenticated: !!locals.user
		};
	} catch (err) {
		console.error('Error loading event series:', err);

		if (err && typeof err === 'object' && 'status' in err) {
			throw err; // Re-throw SvelteKit errors
		}

		const errorMessage = extractErrorMessage(err, 'Failed to load event series');
		throw svelteKitError(500, errorMessage);
	}
};
