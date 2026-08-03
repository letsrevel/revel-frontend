import { render, screen } from '@testing-library/svelte';
import { describe, it, expect } from 'vitest';
import { createRawSnippet } from 'svelte';
import PosterSticker from './PosterSticker.svelte';

const text = (s: string) => createRawSnippet(() => ({ render: () => `<span>${s}</span>` }));

describe('PosterSticker', () => {
	it('renders its content', () => {
		render(PosterSticker, { props: { children: text('no hidden fees') } });
		expect(screen.getByText('no hidden fees')).toBeInTheDocument();
	});

	it('clamps rotation to 3 degrees', () => {
		const { container } = render(PosterSticker, {
			props: { rotate: 45, children: text('x') }
		});
		const el = container.querySelector('.poster-sticker') as HTMLElement;
		expect(el.style.transform).toBe('rotate(3deg)');
	});

	it('ink tint renders dark sticker with white text', () => {
		const { container } = render(PosterSticker, {
			props: { tint: 'ink', children: text('Too kinky') }
		});
		const el = container.querySelector('.poster-sticker') as HTMLElement;
		expect(el.className).toContain('sticker-ink');
	});
});
