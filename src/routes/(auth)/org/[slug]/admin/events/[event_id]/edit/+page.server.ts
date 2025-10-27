import { error } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import type { CitySchema } from '$lib/api/generated/types.gen';
import {
	eventGetEvent,
	userpreferencesGetGeneralPreferences,
	dashboardDashboardEventSeries,
	questionnaireListOrgQuestionnaires
} from '$lib/api';

export const load: PageServerLoad = async ({ parent, params, locals, fetch }) => {
	const parentData = await parent();
	const { organization } = parentData;
	const user = locals.user;

	if (!user) {
		throw error(401, 'You must be logged in to edit events');
	}

	const headers: HeadersInit = {
		Authorization: `Bearer ${user.accessToken}`
	};

	// Load event
	let event;
	try {
		const eventResponse = await eventGetEvent({
			fetch,
			path: { event_id: params.event_id },
			headers
		});

		if (!eventResponse.data) {
			throw error(404, 'Event not found');
		}

		event = eventResponse.data;
	} catch (err) {
		// Handle API errors
		if (typeof err === 'object' && err !== null && 'status' in err) {
			const status = (err as { status: number }).status;

			if (status === 404) {
				throw error(404, 'Event not found');
			}

			if (status === 403) {
				throw error(403, 'You do not have permission to edit this event');
			}
		}

		// Re-throw SvelteKit errors
		if (err && typeof err === 'object' && 'status' in err && 'body' in err) {
			throw err;
		}

		console.error('Error loading event:', err);
		throw error(500, 'Failed to load event');
	}

	// Verify event belongs to this organization
	if (event.organization?.slug !== organization.slug) {
		throw error(403, 'Event does not belong to this organization');
	}

	// Load user preferences for city default
	let userCity: CitySchema | null = null;
	try {
		const preferencesResponse = await userpreferencesGetGeneralPreferences({
			fetch,
			headers
		});
		userCity = preferencesResponse.data?.city || null;
	} catch (err) {
		// Preferences not set or error - that's ok
		console.debug('Failed to load user preferences:', err);
	}

	// Load organization's event series for dropdown
	const eventSeries = [];
	try {
		const seriesResponse = await dashboardDashboardEventSeries({
			fetch,
			headers
		});
		// API returns paginated response with results array
		if (seriesResponse.data && 'results' in seriesResponse.data) {
			eventSeries.push(...seriesResponse.data.results);
		}
	} catch (err) {
		// No series yet or error - that's ok
		console.debug('Failed to load event series:', err);
	}

	// Load organization's questionnaires for dropdown
	const questionnaires = [];
	try {
		const questionnairesResponse = await questionnaireListOrgQuestionnaires({
			query: {
				organization_id: organization.id
			},
			fetch,
			headers
		});
		// API returns paginated response with results array
		if (questionnairesResponse.data && 'results' in questionnairesResponse.data) {
			// Filter to only show questionnaires for this organization
			const orgQuestionnaires = questionnairesResponse.data.results.filter((q) => {
				if (typeof q === 'object' && q !== null && 'organization' in q) {
					const org = q.organization as { id?: string } | null | undefined;
					return org?.id === organization.id;
				}
				return false;
			});
			questionnaires.push(...orgQuestionnaires);
		}
	} catch (err) {
		// No questionnaires yet or error - that's ok
		console.debug('Failed to load questionnaires:', err);
	}

	return {
		event,
		userCity,
		orgCity: organization.city || null,
		eventSeries,
		questionnaires
	};
};
