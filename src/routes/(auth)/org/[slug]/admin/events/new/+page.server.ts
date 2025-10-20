import type { PageServerLoad } from './$types';
import { error } from '@sveltejs/kit';
import type { CitySchema } from '$lib/api/generated/types.gen';
import {
	userpreferencesGetGeneralPreferencesA39613Ae,
	dashboardDashboardEventSeriesAc85Def8,
	questionnaireListOrgQuestionnairesE0A0441C
} from '$lib/api';

export const load: PageServerLoad = async ({ parent, locals, fetch }) => {
	const parentData = await parent();
	const { organization } = parentData;
	const user = locals.user;

	if (!user) {
		throw error(401, 'You must be logged in to create events');
	}

	const headers: HeadersInit = {
		Authorization: `Bearer ${user.accessToken}`
	};

	// Load user preferences for city default
	let userCity: CitySchema | null = null;
	try {
		const preferencesResponse = await userpreferencesGetGeneralPreferencesA39613Ae({
			fetch,
			headers
		});
		userCity = preferencesResponse.data?.city || null;
	} catch (err) {
		// Preferences not set or error - that's ok, we'll use organization city
		console.debug('Failed to load user preferences:', err);
	}

	// Load organization's event series for dropdown
	const eventSeries = [];
	try {
		const seriesResponse = await dashboardDashboardEventSeriesAc85Def8({
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
		const questionnairesResponse = await questionnaireListOrgQuestionnairesE0A0441C({
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
		userCity,
		orgCity: organization.city || null,
		eventSeries,
		questionnaires
	};
};
