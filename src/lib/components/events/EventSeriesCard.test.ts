import { render, screen } from '@testing-library/svelte';
import { describe, it, expect, afterEach, vi } from 'vitest';
import EventSeriesCard from './EventSeriesCard.svelte';
import type { EventSeriesRetrieveSchema } from '$lib/api/generated/types.gen';

// `$app/state`'s real `page.url` stays a static placeholder (`new URL('a:')`)
// outside of an actual SvelteKit navigation, so it never reflects
// `window.history` changes made in tests. Mirror `window.location` instead —
// this is what the component sees as "the current URL" for UTM carry (#880).
vi.mock('$app/state', () => ({
	page: {
		get url() {
			return new URL(window.location.href);
		}
	}
}));

const mockEventSeries: EventSeriesRetrieveSchema = {
	id: 'series-123',
	name: 'Tech Talk Series',
	slug: 'tech-talk-series',
	description: 'Monthly technical talks on web development and software engineering',
	cover_art: '/media/series/tech-talks-cover.jpg',
	logo: '/media/series/tech-talks-logo.png',
	tags: ['technology', 'web-development', 'software-engineering', 'learning'],
	organization: {
		id: 'org-456',
		name: 'Tech Community',
		slug: 'tech-community',
		description: 'A community for tech enthusiasts',
		logo: '/media/orgs/tech-community-logo.png',
		cover_art: '/media/orgs/tech-community-cover.jpg',
		city: {
			id: 'city-789',
			name: 'San Francisco',
			country: 'USA',
			latitude: 37.7749,
			longitude: -122.4194
		},
		tags: ['technology', 'community'],
		is_verified: true,
		created: '2024-01-01T00:00:00Z',
		updated: '2024-01-15T00:00:00Z'
	}
};

describe('EventSeriesCard', () => {
	afterEach(() => {
		window.history.replaceState({}, '', '/');
	});

	it('renders series name and organization name', () => {
		render(EventSeriesCard, {
			props: {
				series: mockEventSeries
			}
		});

		expect(screen.getByText('Tech Talk Series')).toBeInTheDocument();
		expect(screen.getByText('Tech Community')).toBeInTheDocument();
	});

	it('renders with standard variant by default', () => {
		const { container } = render(EventSeriesCard, {
			props: {
				series: mockEventSeries
			}
		});

		const article = container.querySelector('article');
		expect(article).toHaveClass('flex-col');
	});

	it('renders with compact variant when specified', () => {
		const { container } = render(EventSeriesCard, {
			props: {
				series: mockEventSeries,
				variant: 'compact'
			}
		});

		const article = container.querySelector('article');
		expect(article).toHaveClass('flex-row');
	});

	it('displays description in standard variant', () => {
		render(EventSeriesCard, {
			props: {
				series: mockEventSeries,
				variant: 'standard'
			}
		});

		expect(
			screen.getByText('Monthly technical talks on web development and software engineering')
		).toBeInTheDocument();
	});

	it('does not display description in compact variant', () => {
		render(EventSeriesCard, {
			props: {
				series: mockEventSeries,
				variant: 'compact'
			}
		});

		expect(
			screen.queryByText('Monthly technical talks on web development and software engineering')
		).not.toBeInTheDocument();
	});

	it('displays up to 3 tags with more indicator in standard variant', () => {
		render(EventSeriesCard, {
			props: {
				series: mockEventSeries,
				variant: 'standard'
			}
		});

		expect(screen.getByText('technology')).toBeInTheDocument();
		expect(screen.getByText('web-development')).toBeInTheDocument();
		expect(screen.getByText('software-engineering')).toBeInTheDocument();
		expect(screen.getByText('+1 more')).toBeInTheDocument();
	});

	it('does not display tags in compact variant', () => {
		render(EventSeriesCard, {
			props: {
				series: mockEventSeries,
				variant: 'compact'
			}
		});

		expect(screen.queryByText('technology')).not.toBeInTheDocument();
	});

	it('links to correct series detail page', () => {
		render(EventSeriesCard, {
			props: {
				series: mockEventSeries
			}
		});

		const link = screen.getByLabelText(/tech talk series/i);
		expect(link).toHaveAttribute('href', '/events/tech-community/series/tech-talk-series');
	});

	it('carries the current URL utm tags onto its default href', async () => {
		window.history.replaceState({}, '', '/org/acme?utm_source=newsletter&utm_campaign=sept');

		render(EventSeriesCard, {
			props: {
				series: mockEventSeries
			}
		});

		const link = screen.getByRole('link');
		const href = new URL(link.getAttribute('href') ?? '', 'https://x.test');
		expect(href.searchParams.get('utm_source')).toBe('newsletter');
		expect(href.searchParams.get('utm_campaign')).toBe('sept');
	});

	it('has accessible card label for screen readers', () => {
		render(EventSeriesCard, {
			props: {
				series: mockEventSeries
			}
		});

		const link = screen.getByRole('link', { name: /tech talk series/i });
		expect(link).toBeInTheDocument();
	});

	it('renders series indicator badge', () => {
		render(EventSeriesCard, {
			props: {
				series: mockEventSeries
			}
		});

		expect(screen.getByText('Series')).toBeInTheDocument();
	});

	it('handles missing description gracefully', () => {
		const seriesWithoutDescription: EventSeriesRetrieveSchema = {
			...mockEventSeries,
			description: null
		};

		render(EventSeriesCard, {
			props: {
				series: seriesWithoutDescription,
				variant: 'standard'
			}
		});

		expect(screen.getByText('Tech Talk Series')).toBeInTheDocument();
	});

	it('handles missing tags gracefully', () => {
		const seriesWithoutTags: EventSeriesRetrieveSchema = {
			...mockEventSeries,
			tags: undefined
		};

		render(EventSeriesCard, {
			props: {
				series: seriesWithoutTags,
				variant: 'standard'
			}
		});

		expect(screen.getByText('Tech Talk Series')).toBeInTheDocument();
		expect(screen.queryByText('technology')).not.toBeInTheDocument();
	});

	it('applies custom className', () => {
		const { container } = render(EventSeriesCard, {
			props: {
				series: mockEventSeries,
				class: 'custom-class'
			}
		});

		const article = container.querySelector('article');
		expect(article).toHaveClass('custom-class');
	});

	it('is keyboard accessible', () => {
		render(EventSeriesCard, {
			props: {
				series: mockEventSeries
			}
		});

		const link = screen.getByRole('link', { name: /tech talk series/i });
		link.focus();
		expect(link).toHaveFocus();
	});
});
