import { render, screen } from '@testing-library/svelte';
import { describe, it, expect } from 'vitest';
import { createRawSnippet } from 'svelte';
import SectionHeader from './SectionHeader.svelte';

const snip = (s: string) => createRawSnippet(() => ({ render: () => `<span>${s}</span>` }));

describe('SectionHeader', () => {
	it('renders an h2 by default', () => {
		render(SectionHeader, { props: { title: 'Upcoming' } });
		expect(screen.getByRole('heading', { level: 2, name: 'Upcoming' })).toBeInTheDocument();
	});

	it('renders an h3 when level=3', () => {
		render(SectionHeader, { props: { title: 'Details', level: 3 } });
		expect(screen.getByRole('heading', { level: 3, name: 'Details' })).toBeInTheDocument();
	});

	it('renders kicker with the standardized tracking', () => {
		render(SectionHeader, { props: { title: 'Tickets', kicker: 'This week' } });
		expect(screen.getByText('This week').className).toContain('tracking-[0.12em]');
	});

	it('renders actions', () => {
		render(SectionHeader, { props: { title: 'Polls', actions: snip('See all') } });
		expect(screen.getByText('See all')).toBeInTheDocument();
	});

	it('celebration volume uses the display heading scale', () => {
		render(SectionHeader, { props: { title: 'Highlights', volume: 'celebration' } });
		const heading = screen.getByRole('heading', { level: 2 });
		// text-2xl since the uplift prototype (was text-xl) — studio unchanged.
		expect(heading.className).toContain('text-2xl');
		expect(heading.className).toContain('font-extrabold');
	});

	it('kicker is text-xs in studio and text-sm in celebration', () => {
		const { unmount } = render(SectionHeader, {
			props: { title: 'Details', kicker: 'Studio', volume: 'studio' }
		});
		expect(screen.getByText('Studio').className).toContain('text-xs');
		unmount();

		render(SectionHeader, {
			props: { title: 'Details', kicker: 'Celebration', volume: 'celebration' }
		});
		expect(screen.getByText('Celebration').className).toContain('text-sm');
	});

	it('poster volume matches celebration at section level (PageHeader parity)', () => {
		// The volume exists so poster-band screens name the same volume on both
		// primitives instead of hand-rolling the scale; today it rides with
		// celebration, and studio must stay the odd one out.
		const { unmount } = render(SectionHeader, {
			props: { title: 'Highlights', kicker: 'Poster', volume: 'poster' }
		});
		const posterHeading = screen.getByRole('heading', { level: 2 }).className;
		expect(posterHeading).toContain('text-2xl');
		expect(posterHeading).toContain('font-extrabold');
		expect(screen.getByText('Poster').className).toContain('text-sm');
		unmount();

		render(SectionHeader, { props: { title: 'Highlights', volume: 'studio' } });
		expect(screen.getByRole('heading', { level: 2 }).className).toContain('text-lg');
	});

	it('renders the subtitle under the heading, inside the heading block', () => {
		const { container } = render(SectionHeader, {
			props: { title: 'Social links', subtitle: 'Shown on your public page.' }
		});
		const subtitle = screen.getByText('Shown on your public page.');
		expect(subtitle.tagName).toBe('P');
		expect(subtitle.className).toContain('text-sm');
		expect(subtitle.className).toContain('text-muted-foreground');
		// It belongs to the heading's own column, not the flex row — that is the
		// whole point over the hand-placed sibling paragraph it replaces, which
		// sat on the parent section's spacing rhythm instead of the title's.
		const heading = screen.getByRole('heading', { level: 2 });
		expect(subtitle.parentElement).toBe(heading.parentElement);
		expect(heading.nextElementSibling).toBe(subtitle);
		expect(container.querySelector('p')).toBe(subtitle);
	});

	it('renders no subtitle node when the prop is absent', () => {
		const { container } = render(SectionHeader, { props: { title: 'Social links' } });
		expect(container.querySelectorAll('p')).toHaveLength(0);
	});

	it('subtitle coexists with kicker and actions', () => {
		render(SectionHeader, {
			props: {
				title: 'Reports',
				kicker: 'Owner',
				subtitle: 'Delivered to your billing email.',
				actions: snip('Configure')
			}
		});
		expect(screen.getByText('Owner')).toBeInTheDocument();
		expect(screen.getByText('Delivered to your billing email.')).toBeInTheDocument();
		expect(screen.getByText('Configure')).toBeInTheDocument();
	});

	it('passes id through to the heading element', () => {
		render(SectionHeader, { props: { title: 'Tickets', id: 'tickets-heading' } });
		expect(screen.getByRole('heading', { level: 2 }).id).toBe('tickets-heading');
	});
});
