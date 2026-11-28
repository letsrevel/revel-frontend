/**
 * Questionnaire warning rules (#1314, F1, F2). Pure functions: each returns an
 * `AdminWarning`, or `null` when the setting is fine. Callers add the action.
 */
import * as m from '$lib/paraglide/messages.js';
import type { AdminWarning } from './types';

export interface AdmissionQuestionnaireInput {
	questionnaire_type: string | null | undefined;
	status: string | null | undefined;
	/** Linked events. Only the start matters. */
	events: ReadonlyArray<{ start: string }> | null | undefined;
	/** Linked event series. Any link counts. */
	eventSeriesCount: number;
	/** Injected so tests are deterministic. */
	now: Date;
}

/**
 * F1: an admission questionnaire is linked to an upcoming event or to a series,
 * but it is not published. The backend screens only with published ones.
 */
export function admissionQuestionnaireNotPublished(
	input: AdmissionQuestionnaireInput
): AdminWarning | null {
	if (input.questionnaire_type !== 'admission' || input.status === 'published') return null;
	const nowMs = input.now.getTime();
	const hasUpcoming = (input.events ?? []).some((e) => new Date(e.start).getTime() > nowMs);
	if (!hasUpcoming && !(input.eventSeriesCount > 0)) return null;
	return {
		id: 'F1',
		level: 'warn',
		title: () => m['adminWarnings.questionnaireF1Title'](),
		message: () => m['adminWarnings.questionnaireF1Message']()
	};
}

export interface MembershipQuestionnaireInput {
	questionnaire_type: string | null | undefined;
	status: string | null | undefined;
	is_organization_default: boolean | null | undefined;
	tierCount: number;
}

/** F2: a membership questionnaire is in use (default or tier-linked) but not published. */
export function membershipQuestionnaireNotPublished(
	input: MembershipQuestionnaireInput
): AdminWarning | null {
	if (input.questionnaire_type !== 'membership' || input.status === 'published') return null;
	if (!input.is_organization_default && !(input.tierCount > 0)) return null;
	return {
		id: 'F2',
		level: 'info',
		title: () => m['adminWarnings.questionnaireF2Title'](),
		message: () => m['adminWarnings.questionnaireF2Message']()
	};
}
