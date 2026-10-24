import { describe, it, expect } from 'vitest';
import { generateICalFromRevelEvent } from './ical';
import type { LinkContext } from './org-links';

const event = (organization: { slug: string; name: string; custom_domain?: string | null }) => ({
	id: 'evt-1',
	slug: 'party',
	name: 'Party',
	start: '2099-01-01T18:00:00Z',
	end: '2099-01-01T20:00:00Z',
	organization
});

// iCal folds long lines at 75 octets; unfold before matching.
const urlOf = (ics: string): string | undefined =>
	ics
		.replace(/\r?\n[ \t]/g, '')
		.match(/^URL[^:]*:(.*)$/m)?.[1]
		?.trim();

const platformOrigin = 'https://app.example.com';
const enabled = { enabled: true, platformOrigin };

describe('generateICalFromRevelEvent links', () => {
	it('org with a custom domain links to its domain', () => {
		const ctx: LinkContext = { tenant: null, customDomains: enabled };
		const ics = generateICalFromRevelEvent(
			event({ slug: 'acme', name: 'Acme', custom_domain: 'events.acme.test' }),
			ctx
		);
		expect(urlOf(ics)).toBe('https://events.acme.test/events/acme/party');
	});

	it('rule C: org without a domain, viewed from a tenant host, links to the platform origin', () => {
		const ctx: LinkContext = {
			tenant: { slug: 'acme', custom_domain: 'events.acme.test' },
			customDomains: enabled
		};
		const ics = generateICalFromRevelEvent(event({ slug: 'beta', name: 'Beta' }), ctx);
		expect(urlOf(ics)).toBe(`${platformOrigin}/events/beta/party`);
	});

	it('the tenant own org stays on the current origin', () => {
		const ctx: LinkContext = {
			tenant: { slug: 'acme', custom_domain: 'events.acme.test' },
			customDomains: enabled
		};
		const ics = generateICalFromRevelEvent(
			event({ slug: 'acme', name: 'Acme', custom_domain: 'events.acme.test' }),
			ctx
		);
		expect(urlOf(ics)).toBe(`${window.location.origin}/events/acme/party`);
	});

	it('tenant mode off: current origin, never a custom domain', () => {
		const ics = generateICalFromRevelEvent(
			event({ slug: 'acme', name: 'Acme', custom_domain: 'events.acme.test' }),
			{ customDomains: { enabled: false, platformOrigin: null } }
		);
		expect(urlOf(ics)).toBe(`${window.location.origin}/events/acme/party`);
	});
});
