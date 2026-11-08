import { describe, it, expect } from 'vitest';
import { classifyCheckoutRefusal, questionnaireStepsFromQuote } from './series-pass-questionnaires';

const base = { questionnaires_missing: [], questionnaire_event_id: null, questionnaire_events: [] };

describe('questionnaireStepsFromQuote', () => {
	it('returns no steps for an empty quote', () => {
		expect(questionnaireStepsFromQuote(base)).toEqual([]);
	});

	it('routes each questionnaire through its own event', () => {
		const steps = questionnaireStepsFromQuote({
			questionnaires_missing: ['q-series', 'q-event'],
			questionnaire_event_id: 'e-anchor',
			questionnaire_events: [
				{ questionnaire_id: 'q-series', event_id: 'e-anchor' },
				{ questionnaire_id: 'q-event', event_id: 'e-2' }
			]
		});
		expect(steps).toEqual([
			{ questionnaireId: 'q-series', eventId: 'e-anchor' },
			{ questionnaireId: 'q-event', eventId: 'e-2' }
		]);
	});

	it('keeps a per_event questionnaire once per event', () => {
		const steps = questionnaireStepsFromQuote({
			questionnaires_missing: ['q-1'],
			questionnaire_event_id: 'e-1',
			questionnaire_events: [
				{ questionnaire_id: 'q-1', event_id: 'e-1' },
				{ questionnaire_id: 'q-1', event_id: 'e-2' }
			]
		});
		expect(steps).toEqual([
			{ questionnaireId: 'q-1', eventId: 'e-1' },
			{ questionnaireId: 'q-1', eventId: 'e-2' }
		]);
	});

	it('de-duplicates an identical (questionnaire, event) pair', () => {
		const steps = questionnaireStepsFromQuote({
			questionnaires_missing: ['q-1'],
			questionnaire_event_id: 'e-1',
			questionnaire_events: [
				{ questionnaire_id: 'q-1', event_id: 'e-1' },
				{ questionnaire_id: 'q-1', event_id: 'e-1' }
			]
		});
		expect(steps).toHaveLength(1);
	});

	it('falls back to questionnaire_event_id for ids without an entry', () => {
		const steps = questionnaireStepsFromQuote({
			questionnaires_missing: ['q-1', 'q-2'],
			questionnaire_event_id: 'e-1',
			questionnaire_events: [{ questionnaire_id: 'q-2', event_id: 'e-9' }]
		});
		expect(steps).toEqual([
			{ questionnaireId: 'q-2', eventId: 'e-9' },
			{ questionnaireId: 'q-1', eventId: 'e-1' }
		]);
	});
});

describe('classifyCheckoutRefusal', () => {
	it('ignores bodies that are not eligibility payloads', () => {
		expect(classifyCheckoutRefusal({ detail: 'nope' })).toBeNull();
		expect(classifyCheckoutRefusal(undefined)).toBeNull();
	});

	it('routes complete_questionnaire to the refusal event', () => {
		expect(
			classifyCheckoutRefusal({
				allowed: false,
				event_id: 'e-7',
				next_step: 'complete_questionnaire',
				questionnaires_missing: ['q-1']
			})
		).toEqual({
			kind: 'complete_questionnaire',
			eventId: 'e-7'
		});
	});

	it('recognises a pending review by next step or reason code', () => {
		expect(
			classifyCheckoutRefusal({
				allowed: false,
				event_id: 'e',
				next_step: 'wait_for_questionnaire_evaluation'
			})
		).toEqual({ kind: 'pending_review' });
		expect(
			classifyCheckoutRefusal({
				allowed: false,
				event_id: 'e',
				reason_code: 'questionnaire_pending_review'
			})
		).toEqual({ kind: 'pending_review' });
	});

	it('treats complete_questionnaire without ids as a plain refusal', () => {
		expect(
			classifyCheckoutRefusal({
				allowed: false,
				event_id: 'e',
				next_step: 'complete_questionnaire'
			})
		).toMatchObject({ kind: 'other' });
	});

	it('passes other refusals through', () => {
		expect(
			classifyCheckoutRefusal({ allowed: false, event_id: 'e', next_step: 'choose_another_tier' })
		).toMatchObject({ kind: 'other' });
	});
});
