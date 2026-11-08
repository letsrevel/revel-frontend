import type { EventUserEligibility, SeriesPassQuoteSchema } from '$lib/api/generated/types.gen';
import { isEligibilityRefusal } from './eligibility';

/**
 * One questionnaire the buyer still has to answer, and the event that accepts
 * the submission. The backend reports them per event, so the same questionnaire
 * can legitimately appear twice (a `per_event` one is answered once per event).
 */
export interface PassQuestionnaireStep {
	questionnaireId: string;
	eventId: string;
}

/** Stable identity of a step (a questionnaire answered through one event). */
export function stepKey(step: PassQuestionnaireStep): string {
	return `${step.eventId}:${step.questionnaireId}`;
}

function dedupe(steps: PassQuestionnaireStep[]): PassQuestionnaireStep[] {
	const seen = new Set<string>();
	return steps.filter((step) => {
		const key = stepKey(step);
		if (seen.has(key)) return false;
		seen.add(key);
		return true;
	});
}

/**
 * The steps a pass quote asks for, each routed through ITS event.
 *
 * `questionnaire_events` is the source of truth (one entry per missing
 * questionnaire, a `per_event` one once per covered event). Questionnaires listed
 * in `questionnaires_missing` that have no entry fall back to
 * `questionnaire_event_id` (the event of the first listed one) so an older
 * backend still produces a usable step. Order follows the backend.
 */
export function questionnaireStepsFromQuote(
	quote: Pick<
		SeriesPassQuoteSchema,
		'questionnaires_missing' | 'questionnaire_event_id' | 'questionnaire_events'
	>
): PassQuestionnaireStep[] {
	const steps: PassQuestionnaireStep[] = (quote.questionnaire_events ?? []).map((entry) => ({
		questionnaireId: entry.questionnaire_id,
		eventId: entry.event_id
	}));
	const covered = new Set(steps.map((step) => step.questionnaireId));
	const fallbackEventId = quote.questionnaire_event_id;
	if (fallbackEventId) {
		for (const questionnaireId of quote.questionnaires_missing ?? []) {
			if (!covered.has(questionnaireId)) steps.push({ questionnaireId, eventId: fallbackEventId });
		}
	}
	return dedupe(steps);
}

/** The steps a checkout 400 asks for: all of them belong to the refusal's `event_id`. */
export function questionnaireStepsFromEligibility(
	eligibility: Pick<EventUserEligibility, 'event_id' | 'questionnaires_missing'>
): PassQuestionnaireStep[] {
	return dedupe(
		(eligibility.questionnaires_missing ?? []).map((questionnaireId) => ({
			questionnaireId,
			eventId: eligibility.event_id
		}))
	);
}

/** What the purchase dialog should do with a 400 from `POST /series-passes/{id}/checkout`. */
export type CheckoutRefusal =
	| { kind: 'complete_questionnaire'; steps: PassQuestionnaireStep[] }
	| { kind: 'pending_review' }
	| { kind: 'other'; eligibility: EventUserEligibility };

/** Classify the 400 body, or `null` when it is not an eligibility payload. */
export function classifyCheckoutRefusal(body: unknown): CheckoutRefusal | null {
	if (!isEligibilityRefusal(body)) return null;
	if (body.next_step === 'complete_questionnaire') {
		const steps = questionnaireStepsFromEligibility(body);
		// Without the questionnaire ids there is nothing to link to: show the message.
		if (steps.length > 0) return { kind: 'complete_questionnaire', steps };
	}
	if (
		body.next_step === 'wait_for_questionnaire_evaluation' ||
		body.reason_code === 'questionnaire_pending_review'
	) {
		return { kind: 'pending_review' };
	}
	return { kind: 'other', eligibility: body };
}
