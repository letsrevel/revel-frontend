import { eventpublicdetailsGetEvent, eventpublicattendanceGetQuestionnaire } from '$lib/api';

/**
 * Display lookups for the pass questionnaire steps. Each is keyed by the one id
 * that identifies the thing (event id / questionnaire id) so TanStack dedupes
 * them: N rows cost at most one request per distinct event and per distinct
 * questionnaire, not 2N.
 */
export const passQuestionnaireLookupKeys = {
	event: (eventId: string) => ['series-pass-questionnaire-lookup', 'event', eventId] as const,
	questionnaire: (questionnaireId: string) =>
		['series-pass-questionnaire-lookup', 'questionnaire', questionnaireId] as const
};

export interface PassEventLookup {
	name: string;
	slug: string;
	orgSlug: string;
}

export function passEventLookupOptions(eventId: string) {
	return {
		queryKey: passQuestionnaireLookupKeys.event(eventId),
		queryFn: async (): Promise<PassEventLookup> => {
			const res = await eventpublicdetailsGetEvent({ path: { event_id: eventId } });
			if (res.error || !res.data) throw res.error ?? new Error('event');
			return {
				name: res.data.name,
				slug: res.data.slug,
				orgSlug: res.data.organization.slug
			};
		},
		staleTime: 5 * 60 * 1000
	};
}

/**
 * The questionnaire's name. The endpoint is event-scoped, so the first row to
 * ask supplies its event; any event that covers the questionnaire gives the
 * same name.
 */
export function passQuestionnaireNameOptions(questionnaireId: string, eventId: string) {
	return {
		queryKey: passQuestionnaireLookupKeys.questionnaire(questionnaireId),
		queryFn: async (): Promise<string> => {
			const res = await eventpublicattendanceGetQuestionnaire({
				path: { event_id: eventId, questionnaire_id: questionnaireId }
			});
			if (res.error || !res.data) throw res.error ?? new Error('questionnaire');
			return res.data.name;
		},
		staleTime: 5 * 60 * 1000
	};
}
