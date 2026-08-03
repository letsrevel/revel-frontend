import { render, screen } from '@testing-library/svelte';
import { describe, it, expect } from 'vitest';
import FeaturesPanel from './FeaturesPanel.svelte';
import * as m from '$lib/paraglide/messages.js';

const SEO_PATHS = [
	'/queer-event-management',
	'/kink-event-ticketing',
	'/privacy-focused-events',
	'/self-hosted-event-platform',
	'/eventbrite-alternative',
	'/community-first-event-platform'
];

describe('FeaturesPanel', () => {
	it('renders the four feature stubs', () => {
		render(FeaturesPanel, { props: { landingPagePrefix: '' } });
		expect(screen.getByText(m['home.poster.feat1Title']())).toBeInTheDocument();
		expect(screen.getByText(m['home.poster.feat4Title']())).toBeInTheDocument();
	});

	it('keeps all six SEO landing links with the locale prefix', () => {
		render(FeaturesPanel, { props: { landingPagePrefix: '/it' } });
		const hrefs = screen.getAllByRole('link').map((a) => a.getAttribute('href'));
		for (const path of SEO_PATHS) {
			expect(hrefs).toContain(`/it${path}`);
		}
	});

	it('renders unprefixed SEO paths for the default locale', () => {
		render(FeaturesPanel, { props: { landingPagePrefix: '' } });
		const hrefs = screen.getAllByRole('link').map((a) => a.getAttribute('href'));
		for (const path of SEO_PATHS) {
			expect(hrefs).toContain(path);
		}
	});
});
