import type { PageServerLoad } from './$types';
import { error, redirect } from '@sveltejs/kit';
import {
	eventpublicdetailsGetEventBySlugs,
	eventpublicattendanceGetQuestionnaire
} from '$lib/api/client';

export const load: PageServerLoad = async ({ params, locals }) => {
	const { org_slug, event_slug, id: questionnaireId } = params;

	// Prepare headers with authentication if user is logged in
	const headers: HeadersInit = {};
	if (locals.user?.accessToken) {
		headers['Authorization'] = `Bearer ${locals.user.accessToken}`;
	}

	// Fetch the event to get its ID (pass auth to see private events)
	const { data: event, error: eventError } = await eventpublicdetailsGetEventBySlugs({
		path: { event_slug, org_slug },
		headers
	});

	if (eventError || !event) {
		console.error('Failed to fetch event:', eventError);
		throw error(404, 'Event not found');
	}

	// Check authentication - questionnaire submission requires auth
	if (!locals.user) {
		throw redirect(
			302,
			`/login?redirect=${encodeURIComponent(`/events/${org_slug}/${event_slug}/questionnaire/${questionnaireId}`)}`
		);
	}

	// Fetch the questionnaire
	const { data: questionnaire, error: questionnaireError } =
		await eventpublicattendanceGetQuestionnaire({
			path: { event_id: event.id, questionnaire_id: questionnaireId },
			headers: {
				Authorization: `Bearer ${locals.user.accessToken}`
			}
		});

	if (questionnaireError || !questionnaire) {
		console.error('Failed to fetch questionnaire:', questionnaireError);
		throw error(404, 'Questionnaire not found');
	}

	return {
		event: {
			id: event.id,
			name: event.name,
			slug: event.slug,
			organization: {
				name: event.organization.name,
				slug: event.organization.slug
			}
		},
		questionnaire
	};
};
