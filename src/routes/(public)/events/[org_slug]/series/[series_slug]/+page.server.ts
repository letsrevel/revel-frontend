import type { PageServerLoad } from './$types';
import { buildSeo } from '$lib/seo';
import { resolveLang } from '$lib/seo/server';
import { log } from '$lib/server/logger';
import {
	eventseriesGetEventSeriesBySlugs,
	eventpublicdiscoveryListEvents,
	permissionMyPermissions,
	seriespassListSeriesPasses
} from '$lib/api';
import { error as svelteKitError } from '@sveltejs/kit';
import type { OrganizationPermissionsSchema } from '$lib/api/generated/types.gen';
import { extractErrorMessage } from '$lib/utils/errors';

export const load: PageServerLoad = async ({ params, url, fetch, locals, request }) => {
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
			log.error('event_series_fetch_failed', {
				error: seriesResponse.error,
				orgSlug: org_slug,
				seriesSlug: series_slug
			});
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
			log.warning('event_series_events_fetch_failed', {
				error: eventsResponse.error,
				seriesId: series.id
			});
			// Don't fail the page if events fail, just show empty
		}

		// Fetch season passes on sale for this series (visibility-aware).
		const passesResponse = await seriespassListSeriesPasses({
			path: { series_id: series.id },
			fetch,
			headers
		});

		if (passesResponse.error) {
			log.warning('event_series_passes_fetch_failed', {
				error: passesResponse.error,
				seriesId: series.id
			});
			// Don't fail the page if passes fail, just hide the section
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
				log.error('user_permissions_fetch_failed', { error: err });
			}
		}

		const lang = resolveLang(request);
		const seo = buildSeo({ kind: 'series', url, lang, series });

		return {
			seo,
			series,
			seriesPasses: passesResponse.data || [],
			events: eventsResponse.data?.results || [],
			totalCount: eventsResponse.data?.count || 0,
			page: eventsPage,
			pageSize,
			orderBy,
			canEdit,
			isAuthenticated: !!locals.user
		};
	} catch (err) {
		log.error('event_series_load_error', {
			error: err,
			orgSlug: org_slug,
			seriesSlug: series_slug
		});

		if (err && typeof err === 'object' && 'status' in err) {
			throw err; // Re-throw SvelteKit errors
		}

		const errorMessage = extractErrorMessage(err, 'Failed to load event series');
		throw svelteKitError(500, errorMessage);
	}
};
