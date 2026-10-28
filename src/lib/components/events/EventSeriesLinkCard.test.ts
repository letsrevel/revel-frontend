import { fireEvent, render, screen } from '@testing-library/svelte';
import { describe, it, expect, vi } from 'vitest';
import EventSeriesLinkCard from './EventSeriesLinkCard.svelte';
import type { MinimalEventSeriesSchema } from '$lib/api/generated/types.gen';

// See EventSeriesCard.test.ts: mirror window.location for the UTM carry (#880).
vi.mock('$app/state', () => ({
	page: {
		get url() {
			return new URL(window.location.href);
		}
	}
}));

const series = {
	id: 'series-1',
	name: 'Wholesome Parties',
	slug: 'wholesome-parties',
	description: 'Come for **cuddles**. Read the [house rules](https://example.com/rules).',
	logo: '/media/logos/full.png',
	logo_thumbnail_url: '/media/logos/thumb.png',
	organization: { id: 'org-1', name: 'Revel', slug: 'revel' }
} as MinimalEventSeriesSchema;

function renderCard(overrides: Partial<MinimalEventSeriesSchema> = {}) {
	return render(EventSeriesLinkCard, {
		props: { series: { ...series, ...overrides }, orgSlug: 'revel', headingId: 'series-heading' }
	});
}

describe('EventSeriesLinkCard', () => {
	it('renders the description as markdown with no link nested inside another link', () => {
		const { container } = renderCard();
		expect(container.querySelector('strong')?.textContent).toBe('cuddles');
		const rulesLink = screen.getByRole('link', { name: 'house rules' });
		expect(rulesLink.parentElement?.closest('a')).toBeNull();
		expect(container.querySelectorAll('a a')).toHaveLength(0);
	});

	it('links the series name and a "View series" CTA to the series page', () => {
		renderCard();
		const expected = '/events/revel/series/wholesome-parties';
		expect(screen.getByRole('link', { name: 'Wholesome Parties' })).toHaveAttribute(
			'href',
			expected
		);
		expect(screen.getByRole('link', { name: /View series/ })).toHaveAttribute('href', expected);
	});

	it('falls back to the full-size logo when the thumbnail fails, then hides it', async () => {
		const { container } = renderCard();
		const img = (): HTMLImageElement | null => container.querySelector('img');
		const requireImg = (): HTMLImageElement => {
			const el = img();
			if (!el) throw new Error('expected a logo <img>');
			return el;
		};
		expect(requireImg().getAttribute('src')).toContain('/media/logos/thumb.png');
		await fireEvent.error(requireImg());
		expect(requireImg().getAttribute('src')).toContain('/media/logos/full.png');
		await fireEvent.error(requireImg());
		expect(img()).toBeNull();
	});

	it('renders no logo when the series has none', () => {
		const { container } = renderCard({ logo: null, logo_thumbnail_url: null });
		expect(container.querySelector('img')).toBeNull();
	});
});
