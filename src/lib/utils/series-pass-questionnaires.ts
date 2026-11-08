import type {
	EventUserEligibility,
	SeriesPassQuestionnaireEventSchema,
	SeriesPassQuoteSchema
} from '$lib/api/generated/types.gen';
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
 * The steps for `questionnaire_events` pairs (one per missing questionnaire, each
 * routed through the event that accepts it), de-duplicated, in backend order.
 * Shared by the quote and the checkout 400, which carry the same routing.
 */
export function questionnaireStepsFromEvents(
	entries: ReadonlyArray<SeriesPassQuestionnaireEventSchema> | null | undefined
): PassQuestionnaireStep[] {
	return dedupe(
		(entries ?? []).map((entry) => ({
			questionnaireId: entry.questionnaire_id,
			eventId: entry.event_id
		}))
	);
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
	const steps = questionnaireStepsFromEvents(quote.questionnaire_events);
	const covered = new Set(steps.map((step) => step.questionnaireId));
	const fallbackEventId = quote.questionnaire_event_id;
	if (fallbackEventId) {
		for (const questionnaireId of quote.questionnaires_missing ?? []) {
			if (!covered.has(questionnaireId)) steps.push({ questionnaireId, eventId: fallbackEventId });
		}
	}
	return dedupe(steps);
}

/** What the purchase dialog should do with a 400 from `POST /series-passes/{id}/checkout`. */
export type CheckoutRefusal =
	| {
			kind: 'complete_questionnaire';
			/** The 400's own `event_id`: a fallback link target only. */
			eventId: string;
			/** One step per missing questionnaire, routed by the 400 (empty when it sent none). */
			steps: PassQuestionnaireStep[];
	  }
	| { kind: 'pending_review' }
	| { kind: 'other'; eligibility: EventUserEligibility };

/**
 * Classify the 400 body, or `null` when it is not an eligibility payload.
 *
 * A complete_questionnaire 400 carries `questionnaire_events` (the same routing
 * as the quote). When it is absent or empty (older backend, other endpoints),
 * the dialog refreshes the quote and builds the steps from that instead; the
 * 400's `event_id` is then only a fallback link target.
 */
export function classifyCheckoutRefusal(body: unknown): CheckoutRefusal | null {
	if (!isEligibilityRefusal(body)) return null;
	if (
		body.next_step === 'complete_questionnaire' &&
		(body.questionnaires_missing ?? []).length > 0
	) {
		return {
			kind: 'complete_questionnaire',
			eventId: body.event_id,
			steps: questionnaireStepsFromEvents(body.questionnaire_events)
		};
	}
	if (
		body.next_step === 'wait_for_questionnaire_evaluation' ||
		body.reason_code === 'questionnaire_pending_review'
	) {
		return { kind: 'pending_review' };
	}
	return { kind: 'other', eligibility: body };
}
