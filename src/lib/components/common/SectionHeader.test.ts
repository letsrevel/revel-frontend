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
});
