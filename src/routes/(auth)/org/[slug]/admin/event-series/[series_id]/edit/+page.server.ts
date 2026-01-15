import { error } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import {
	eventseriesGetEventSeries,
	questionnaireListOrgQuestionnaires,
	organizationadminresourcesListResources
} from '$lib/api';

export const load: PageServerLoad = async ({ parent, params, locals, fetch }) => {
	const parentData = await parent();
	const { organization } = parentData;
	const user = locals.user;

	if (!user) {
		throw error(401, 'You must be logged in to edit event series');
	}

	const headers: HeadersInit = {
		Authorization: `Bearer ${user.accessToken}`
	};

	// Load event series
	let series;
	try {
		const seriesResponse = await eventseriesGetEventSeries({
			fetch,
			path: { series_id: params.series_id },
			headers
		});

		if (!seriesResponse.data) {
			throw error(404, 'Event series not found');
		}

		series = seriesResponse.data;
	} catch (err) {
		// Handle API errors
		if (typeof err === 'object' && err !== null && 'status' in err) {
			const status = (err as { status: number }).status;

			if (status === 404) {
				throw error(404, 'Event series not found');
			}

			if (status === 403) {
				throw error(403, 'You do not have permission to edit this event series');
			}
		}

		// Re-throw SvelteKit errors
		if (err && typeof err === 'object' && 'status' in err && 'body' in err) {
			throw err;
		}

		console.error('Error loading event series:', err);
		throw error(500, 'Failed to load event series');
	}

	// Verify series belongs to this organization
	if (series.organization?.slug !== organization.slug) {
		throw error(403, 'Event series does not belong to this organization');
	}

	// Load organization's questionnaires
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

	// Load organization's resources
	const resources = [];
	try {
		const resourcesResponse = await organizationadminresourcesListResources({
			path: { slug: organization.slug },
			query: {
				page_size: 100
			},
			fetch,
			headers
		});
		// API returns paginated response with results array
		if (resourcesResponse.data && 'results' in resourcesResponse.data) {
			resources.push(...resourcesResponse.data.results);
		}
	} catch (err) {
		// No resources yet or error - that's ok
		console.debug('Failed to load resources:', err);
	}

	return {
		series,
		questionnaires,
		resources
	};
};
