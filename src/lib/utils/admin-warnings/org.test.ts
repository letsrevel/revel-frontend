import { describe, it, expect } from 'vitest';
import {
	isOrgRestricted,
	orgHiddenWithPublicEvents,
	orgRequestsWhileRestricted,
	orgCustomDomainWhileRestricted
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
