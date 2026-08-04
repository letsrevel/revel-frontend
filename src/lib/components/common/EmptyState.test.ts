import { render, screen } from '@testing-library/svelte';
import { describe, it, expect } from 'vitest';
import { createRawSnippet } from 'svelte';
import { CalendarX } from '@lucide/svelte';
import EmptyState from './EmptyState.svelte';

const snip = (s: string) => createRawSnippet(() => ({ render: () => `<span>${s}</span>` }));

describe('EmptyState', () => {
	it('renders title as a heading and the body', () => {
		render(EmptyState, {
			props: { icon: CalendarX, title: 'No events yet', body: 'Create your first one.' }
		});
		expect(screen.getByRole('heading', { level: 3, name: 'No events yet' })).toBeInTheDocument();
		expect(screen.getByText('Create your first one.')).toBeInTheDocument();
	});

	it('the icon chip is decorative (aria-hidden) and tilted', () => {
		const { container } = render(EmptyState, { props: { icon: CalendarX, title: 'Empty' } });
		const chip = container.querySelector('[aria-hidden="true"]') as HTMLElement;
		expect(chip).not.toBeNull();
		expect(chip.className).toContain('-rotate-2');
	});

	it('brand tone (default) uses the fixed poster palette (imagery rule)', () => {
		const { container } = render(EmptyState, { props: { icon: CalendarX, title: 'Empty' } });
		const chip = container.querySelector('[aria-hidden="true"]') as HTMLElement;
		expect(chip.className).toContain('bg-poster-purple');
		expect(chip.className).toContain('text-poster-white');
	});

	it('renders an action snippet', () => {
		render(EmptyState, {
			props: { icon: CalendarX, title: 'Empty', action: snip('Create event') }
		});
		expect(screen.getByText('Create event')).toBeInTheDocument();
	});
});
