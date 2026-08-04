import { render, screen } from '@testing-library/svelte';
import { describe, it, expect } from 'vitest';
import { createRawSnippet } from 'svelte';
import Sticker from './Sticker.svelte';

const text = (s: string) => createRawSnippet(() => ({ render: () => `<span>${s}</span>` }));

describe('Sticker', () => {
	it('renders its content', () => {
		render(Sticker, { props: { children: text('Sold out') } });
		expect(screen.getByText('Sold out')).toBeInTheDocument();
	});

	it('clamps rotation to [-3, 3]', () => {
		const { container } = render(Sticker, { props: { rotate: 45, children: text('x') } });
		const el = container.querySelector('span') as HTMLElement;
		expect(el.style.transform).toBe('rotate(3deg)');
	});

	it('clamps rotation at the lower bound', () => {
		const { container } = render(Sticker, { props: { rotate: -45, children: text('x') } });
		const el = container.querySelector('span') as HTMLElement;
		expect(el.style.transform).toBe('rotate(-3deg)');
	});

	it('ink tint inverts to ink background with white text', () => {
		const { container } = render(Sticker, { props: { tint: 'ink', children: text('Live') } });
		const el = container.querySelector('span') as HTMLElement;
		expect(el.className).toContain('bg-poster-ink');
		expect(el.className).toContain('text-poster-white');
	});

	it('default tint is purple text on a white sticker', () => {
		const { container } = render(Sticker, { props: { children: text('New') } });
		const el = container.querySelector('span') as HTMLElement;
		expect(el.className).toContain('bg-poster-white');
		expect(el.className).toContain('text-poster-purple');
	});
});
