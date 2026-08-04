import { render } from '@testing-library/svelte';
import { describe, it, expect } from 'vitest';
import { Calendar } from '@lucide/svelte';
import ToneTile from './ToneTile.svelte';

describe('ToneTile', () => {
	it('is aria-hidden when no label is given (decorative next to visible text)', () => {
		const { container } = render(ToneTile, { props: { tone: 'brand', icon: Calendar } });
		const el = container.querySelector('span') as HTMLElement;
		expect(el.getAttribute('aria-hidden')).toBe('true');
		expect(el.getAttribute('role')).toBeNull();
	});

	it('is an accessibly named img when a label is given', () => {
		const { container } = render(ToneTile, {
			props: { tone: 'info', icon: Calendar, label: 'Events' }
		});
		const el = container.querySelector('span') as HTMLElement;
		expect(el.getAttribute('role')).toBe('img');
		expect(el.getAttribute('aria-label')).toBe('Events');
	});

	it('maps tones to token classes, never raw palette hues', () => {
		const { container } = render(ToneTile, { props: { tone: 'success', icon: Calendar } });
		const el = container.querySelector('span') as HTMLElement;
		expect(el.className).toContain('bg-success/10');
		expect(el.className).toContain('text-success');
	});

	it('warning tone flips its icon color per mode (amber fails AA on light)', () => {
		const { container } = render(ToneTile, { props: { tone: 'warning', icon: Calendar } });
		const el = container.querySelector('span') as HTMLElement;
		expect(el.className).toContain('text-highlight-foreground');
		expect(el.className).toContain('dark:text-highlight');
	});
});
