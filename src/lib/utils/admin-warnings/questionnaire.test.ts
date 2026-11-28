import { describe, it, expect } from 'vitest';
import {
	admissionQuestionnaireNotPublished,
	membershipQuestionnaireNotPublished
} from './questionnaire';

const now = new Date('2026-06-01T12:00:00Z');
const future = { start: '2026-07-01T12:00:00Z' };
const past = { start: '2026-05-01T12:00:00Z' };

describe('F1 admissionQuestionnaireNotPublished', () => {
	const base = {
		questionnaire_type: 'admission',
		status: 'draft',
		events: [future],
		eventSeriesCount: 0,
		now
	};
	it('warns for a draft linked to an upcoming event', () => {
		const w = admissionQuestionnaireNotPublished(base);
		expect(w?.id).toBe('F1');
		expect(w?.level).toBe('warn');
		expect(w?.title()).toBe('Admission questionnaire is not published');
		expect(w?.message()).toContain('not asked to fill it in');
	});
	it('warns for a ready questionnaire linked to a series only', () => {
		expect(
			admissionQuestionnaireNotPublished({
				...base,
				status: 'ready',
				events: [],
				eventSeriesCount: 1
			})?.id
		).toBe('F1');
	});
	it('is silent when published', () => {
		expect(admissionQuestionnaireNotPublished({ ...base, status: 'published' })).toBeNull();
	});
	it('is silent when linked only to past events', () => {
		expect(admissionQuestionnaireNotPublished({ ...base, events: [past] })).toBeNull();
	});
	it('is silent when it is linked to nothing', () => {
		expect(admissionQuestionnaireNotPublished({ ...base, events: [] })).toBeNull();
	});
	it('treats an event that starts exactly now as not upcoming', () => {
		expect(
			admissionQuestionnaireNotPublished({ ...base, events: [{ start: now.toISOString() }] })
		).toBeNull();
	});
	it('is silent for other questionnaire types', () => {
		expect(
			admissionQuestionnaireNotPublished({ ...base, questionnaire_type: 'feedback' })
		).toBeNull();
	});
});

describe('F2 membershipQuestionnaireNotPublished', () => {
	const base = {
		questionnaire_type: 'membership',
		status: 'draft',
		is_organization_default: true,
		tierCount: 0
	};
	it('is an Info hint for an unpublished default questionnaire', () => {
		const w = membershipQuestionnaireNotPublished(base);
		expect(w?.id).toBe('F2');
		expect(w?.level).toBe('info');
		expect(w?.message()).toContain('unpublished version');
	});
	it('fires for a tier-linked questionnaire that is not the default', () => {
		expect(
			membershipQuestionnaireNotPublished({ ...base, is_organization_default: false, tierCount: 2 })
		).not.toBeNull();
	});
	it('is silent when it is in use nowhere', () => {
		expect(
			membershipQuestionnaireNotPublished({ ...base, is_organization_default: false })
		).toBeNull();
	});
	it('is silent when published', () => {
		expect(membershipQuestionnaireNotPublished({ ...base, status: 'published' })).toBeNull();
	});
	it('is silent for other types', () => {
		expect(
			membershipQuestionnaireNotPublished({ ...base, questionnaire_type: 'admission' })
		).toBeNull();
	});
});
