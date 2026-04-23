import type { PageServerLoad } from './$types';
import { error } from '@sveltejs/kit';
import type { CitySchema } from '$lib/api/generated/types.gen';
import { userpreferencesGetGeneralPreferences, questionnaireListOrgQuestionnaires } from '$lib/api';

export const load: PageServerLoad = async ({ parent, locals, fetch }) => {
	const { organization, canCreateEvent } = await parent();
	const user = locals.user;

	if (!user) {
		throw error(401, 'You must be logged in to create a recurring series');
	}

	if (!canCreateEvent) {
		throw error(403, 'You do not have permission to create events in this organization');
	}

	const headers: HeadersInit = {
		Authorization: `Bearer ${user.accessToken}`
	};

	let userCity: CitySchema | null = null;
	try {
		const preferencesResponse = await userpreferencesGetGeneralPreferences({
			fetch,
			headers
		});
		userCity = preferencesResponse.data?.city || null;
	} catch (err) {
		console.debug('Failed to load user preferences:', err);
	}

	const questionnaires = [];
	try {
		const questionnairesResponse = await questionnaireListOrgQuestionnaires({
			query: { organization_id: organization.id },
			fetch,
			headers
		});
		if (questionnairesResponse.data && 'results' in questionnairesResponse.data) {
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
		console.debug('Failed to load questionnaires:', err);
	}

	return {
		userCity,
		orgCity: organization.city || null,
		questionnaires
	};
};
