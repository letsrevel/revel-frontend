import { describe, it, expect } from 'vitest';
import {
	isOrgRestricted,
	orgHiddenWithPublicEvents,
	orgRequestsWhileRestricted,
	orgCustomDomainWhileRestricted,
	orgSettingsWarnings
} from './org';

describe('isOrgRestricted', () => {
	it.each(['private', 'members-only', 'staff-only'])('is true for %s', (v) => {
		expect(isOrgRestricted(v)).toBe(true);
	});
	it.each(['public', 'unlisted'])('is false for %s', (v) => {
		expect(isOrgRestricted(v)).toBe(false);
	});
	it('is false when the visibility is unknown', () => {
		expect(isOrgRestricted(undefined)).toBe(false);
		expect(isOrgRestricted(null)).toBe(false);
	});
});

describe('A1 orgHiddenWithPublicEvents', () => {
	const base = { orgVisibility: 'private', publicEventCount: 3, inSeriesCount: 0, partial: false };
	it('warns for a restricted organization with visible events', () => {
		const w = orgHiddenWithPublicEvents(base);
		expect(w?.id).toBe('A1');
		expect(w?.level).toBe('warn');
		expect(w?.title()).toBe('Visitors see events of a hidden organization');
		expect(w?.message()).toContain('"not found"');
		expect(w?.message()).toContain('Upcoming events that visitors can see: 3.');
		expect(w?.message()).not.toContain('series');
		expect(w?.fixTarget).toBeUndefined();
	});
	it('adds the series sentence when an event is in a series', () => {
		const w = orgHiddenWithPublicEvents({ ...base, inSeriesCount: 1 });
		expect(w?.message()).toContain('Some of these events are in a series.');
	});
	it('uses "at least" when the count is partial', () => {
		const w = orgHiddenWithPublicEvents({ ...base, publicEventCount: 100, partial: true });
		expect(w?.message()).toContain('at least 100');
	});
	it('is silent for a public or unlisted organization', () => {
		expect(orgHiddenWithPublicEvents({ ...base, orgVisibility: 'public' })).toBeNull();
		expect(orgHiddenWithPublicEvents({ ...base, orgVisibility: 'unlisted' })).toBeNull();
	});
	it('is silent without visible events', () => {
		expect(orgHiddenWithPublicEvents({ ...base, publicEventCount: 0 })).toBeNull();
	});
});

describe('A4 orgRequestsWhileRestricted', () => {
	it('warns when requests are on and the organization is restricted', () => {
		const w = orgRequestsWhileRestricted({
			orgVisibility: 'members-only',
			accept_membership_requests: true
		});
		expect(w?.id).toBe('A4');
		expect(w?.level).toBe('warn');
		expect(w?.title()).toBe('Membership requests are not reachable');
		expect(w?.message()).toContain('invitation link');
	});
	it('is silent when requests are off', () => {
		expect(
			orgRequestsWhileRestricted({ orgVisibility: 'private', accept_membership_requests: false })
		).toBeNull();
	});
	it('is silent for a public organization', () => {
		expect(
			orgRequestsWhileRestricted({ orgVisibility: 'public', accept_membership_requests: true })
		).toBeNull();
	});
});

describe('A5 orgCustomDomainWhileRestricted', () => {
	it('is an Info hint for a custom domain on a restricted organization', () => {
		const w = orgCustomDomainWhileRestricted({
			orgVisibility: 'staff-only',
			custom_domain: 'events.example.com'
		});
		expect(w?.id).toBe('A5');
		expect(w?.level).toBe('info');
		expect(w?.title()).toBe('The custom domain shows a hidden organization');
	});
	it('is silent without a custom domain', () => {
		expect(
			orgCustomDomainWhileRestricted({ orgVisibility: 'private', custom_domain: null })
		).toBeNull();
		expect(
			orgCustomDomainWhileRestricted({ orgVisibility: 'private', custom_domain: '' })
		).toBeNull();
	});
	it('is silent for a public organization', () => {
		expect(
			orgCustomDomainWhileRestricted({ orgVisibility: 'public', custom_domain: 'a.example.com' })
		).toBeNull();
	});
});

describe('orgSettingsWarnings', () => {
	const counts = { publicEventCount: 2, inSeriesCount: 0, partial: false };
	const base = {
		visibility: 'private',
		acceptNewMembers: true,
		defaultQuestionnaireId: '',
		counts,
		customDomain: 'club.example.com',
		membershipQuestionnaires: [
			{ id: 'q1', questionnaire_type: 'membership', questionnaire: { status: 'draft' } },
			{ id: 'q2', questionnaire_type: 'membership', questionnaire: { status: 'published' } }
		],
		questionnairesHref: '/org/x/admin/questionnaires'
	};

	it('returns A1 and A5 on the visibility field and A4 on the requests field', () => {
		const r = orgSettingsWarnings(base);
		expect(r.visibility.map((w) => w.id)).toEqual(['A1', 'A5']);
		expect(r.visibility.every((w) => w.fixTarget === 'visibility')).toBe(true);
		expect(r.requests.map((w) => w.id)).toEqual(['A4']);
		expect(r.requests[0].fixTarget).toBe('accept_membership_requests');
		expect(r.questionnaire).toEqual([]);
	});

	it('returns nothing for a public organization', () => {
		const r = orgSettingsWarnings({ ...base, visibility: 'public' });
		expect(r.visibility).toEqual([]);
		expect(r.requests).toEqual([]);
	});

	it('skips A1 when the counts did not load', () => {
		const r = orgSettingsWarnings({ ...base, counts: null });
		expect(r.visibility.map((w) => w.id)).toEqual(['A5']);
	});

	it('rewrites the F2 id to follow the chosen questionnaire and links to the questionnaires page', () => {
		const r = orgSettingsWarnings({ ...base, defaultQuestionnaireId: 'q1' });
		expect(r.questionnaire).toHaveLength(1);
		expect(r.questionnaire[0].id).toBe('F2-q1');
		expect(r.questionnaire[0].fixHref).toBe('/org/x/admin/questionnaires');
	});

	it('returns no F2 for a published or unknown questionnaire', () => {
		expect(orgSettingsWarnings({ ...base, defaultQuestionnaireId: 'q2' }).questionnaire).toEqual(
			[]
		);
		expect(orgSettingsWarnings({ ...base, defaultQuestionnaireId: 'zz' }).questionnaire).toEqual(
			[]
		);
	});
});
