import { describe, it, expect } from 'vitest';
import { membershipCalloutFrom } from './scan-membership';
import { formatDateTime } from '$lib/utils/date';

describe('membershipCalloutFrom', () => {
	it('renders nothing without a membership', () => {
		expect(membershipCalloutFrom(null)).toBeNull();
		expect(membershipCalloutFrom(undefined)).toBeNull();
	});

	it('says "Day member, valid until {date}" for a temporary record', () => {
		const validUntil = '2026-11-08T22:59:00Z';
		const callout = membershipCalloutFrom({
			kind: 'temporary',
			tier_name: 'Door pass',
			valid_until: validUntil
		});
		expect(callout?.title).toBe('Membership');
		expect(callout?.body).toContain(`Day member, valid until ${formatDateTime(validUntil)}.`);
	});

	it('never implies member benefits for a day member', () => {
		const callout = membershipCalloutFrom({
			kind: 'temporary',
			tier_name: 'Door pass',
			valid_until: '2026-11-08T22:59:00Z'
		});
		expect(callout?.body).toContain('no member benefits');
		expect(callout?.body).not.toContain('Member:');
	});

	it('handles a day member without an end', () => {
		const callout = membershipCalloutFrom({ kind: 'temporary', tier_name: 'Door pass' });
		expect(callout?.body).toMatch(/^Day member\./);
	});

	it('shows the tier name for a standard member', () => {
		expect(
			membershipCalloutFrom({ kind: 'standard', tier_name: 'Gold', valid_until: null })?.body
		).toBe('Member: Gold');
	});

	it('keeps markdown in a tier name literal', () => {
		const body = membershipCalloutFrom({ kind: 'standard', tier_name: '**VIP** _club_' })?.body;
		expect(body).toBe('Member: \\*\\*VIP\\*\\* \\_club\\_');
	});
});
