import { render, screen } from '@testing-library/svelte';
import { describe, it, expect } from 'vitest';
import { CircleCheck } from '@lucide/svelte';
import StatusBadge from './StatusBadge.svelte';

describe('StatusBadge', () => {
	it('renders the label text', () => {
		render(StatusBadge, { props: { tone: 'success', label: 'Confirmed' } });
		expect(screen.getByText('Confirmed')).toBeInTheDocument();
	});

	it('applies the solid token classes for its tone', () => {
		const { container } = render(StatusBadge, { props: { tone: 'danger', label: 'Cancelled' } });
		const el = container.querySelector('span') as HTMLElement;
		expect(el.className).toContain('bg-destructive');
		expect(el.className).toContain('text-destructive-foreground');
	});

	it('renders an optional icon as decorative', () => {
		const { container } = render(StatusBadge, {
			props: { tone: 'success', label: 'Paid', icon: CircleCheck }
		});
		const svg = container.querySelector('svg');
		expect(svg).not.toBeNull();
		expect(svg?.getAttribute('aria-hidden')).toBe('true');
	});
});
