import { describe, it, expect } from 'vitest';
import { eventPublicLinks } from './event-links';

const ctx = { customDomains: { enabled: true, platformOrigin: 'https://letsrevel.io' } };

describe('eventPublicLinks', () => {
	it('keeps the preview on the platform and shares an absolute platform URL', () => {
		const { previewHref, shareUrl } = eventPublicLinks(
			{ slug: 'acme' },
			'party',
			ctx,
			'https://letsrevel.io'
		);
		expect(previewHref).toMatch(/events\/acme\/party$/);
		expect(previewHref).not.toMatch(/^https?:/);
		expect(shareUrl).toBe('https://letsrevel.io/events/acme/party');
	});

	it('shares the custom-domain URL while the preview stays relative', () => {
		const { previewHref, shareUrl } = eventPublicLinks(
			{ slug: 'acme', custom_domain: 'events.acme.test' },
			'party',
			ctx,
			'https://letsrevel.io'
		);
		expect(shareUrl).toBe('https://events.acme.test/events/acme/party');
		expect(previewHref).not.toMatch(/^https?:/);
	});

	it('without tenant mode everything is platform-origin', () => {
		const { shareUrl } = eventPublicLinks(
			{ slug: 'acme', custom_domain: 'events.acme.test' },
			'party',
			null,
			'http://localhost:5173'
		);
		expect(shareUrl).toBe('http://localhost:5173/events/acme/party');
	});
});
