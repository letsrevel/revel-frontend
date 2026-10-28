import { render, screen } from '@testing-library/svelte';
import { describe, it, expect } from 'vitest';
import EventCoverImage from './EventCoverImage.svelte';
import type { EventInListSchema } from '$lib/api/generated/types.gen';

// A past event: EventBadges renders "Past Event" for it.
function createPastEvent(): EventInListSchema {
	return {
		id: '123e4567-e89b-12d3-a456-426614174000',
		name: 'Past Party',
		slug: 'past-party',
		start: '2020-01-01T18:00:00Z',
		end: '2020-01-01T22:00:00Z',
		status: 'open',
		visibility: 'public',
		event_type: 'public',
		requires_ticket: false,
		cover_art: null,
		logo: null,
		tags: [],
		organization: { id: '456', name: 'Test Org', slug: 'test-org', logo: null }
	} as unknown as EventInListSchema;
}

// #1094: the past-event fade must hit the artwork only. Opacity or a filter on
// an ancestor of the badge pulls its text below AA contrast.
describe('EventCoverImage — past-event fade', () => {
	it('fades only the artwork layer, never the badge overlay', () => {
		render(EventCoverImage, { props: { event: createPastEvent(), faded: true } });

		const art = screen.getByTestId('event-cover-art');
		expect(art).toHaveClass('grayscale', 'opacity-75');

		const badges = screen.getAllByTestId('status-badge');
		expect(badges.map((b) => b.textContent?.trim())).toContain('Past Event');
		for (const badge of badges) {
			expect(art.contains(badge)).toBe(false);
			let el: HTMLElement | null = badge;
			while (el) {
				expect(el.className).not.toMatch(/\b(opacity-\d+|grayscale)\b/);
				el = el.parentElement;
			}
		}
	});

	it('leaves the artwork untouched when not faded', () => {
		render(EventCoverImage, { props: { event: createPastEvent() } });
		expect(screen.getByTestId('event-cover-art')).not.toHaveClass('grayscale');
	});
});
