import { render } from '@testing-library/svelte';
import { describe, it, expect } from 'vitest';
import { Calendar } from '@lucide/svelte';
import ToneTile from './ToneTile.svelte';
import type { PosterTint } from './tones';

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

	describe('tint (identity axis)', () => {
		const expectedClasses: Record<PosterTint, [string, string]> = {
			purple: ['bg-poster-purple', 'text-poster-white'],
			lavender: ['bg-poster-lavender', 'text-poster-ink'],
			periwinkle: ['bg-poster-periwinkle', 'text-poster-ink'],
			amber: ['bg-poster-amber', 'text-poster-ink'],
			crimson: ['bg-poster-crimson-deep', 'text-poster-white'],
			ink: ['bg-poster-ink', 'text-poster-white'],
			paper: ['bg-poster-paper', 'text-poster-ink']
		};

		// tint-only (no tone at all) is a legal shape on its own — the union
		// requires only one of tone/tint, and the admin quick-actions grid is a
		// tint-only consumer (no semantic tone to fall back to).
		for (const [tint, [bg, fg]] of Object.entries(expectedClasses) as [
			PosterTint,
			[string, string]
		][]) {
			it(`renders the audited solid pair for tint="${tint}" (tint-only, no tone)`, () => {
				const { container } = render(ToneTile, {
					props: { tint, icon: Calendar }
				});
				const el = container.querySelector('span') as HTMLElement;
				expect(el.className).toContain(bg);
				expect(el.className).toContain(fg);
			});
		}

		it('always carries a theme-aware ring so the fixed chip reads against either card surface', () => {
			const { container } = render(ToneTile, {
				props: { tint: 'ink', icon: Calendar }
			});
			const el = container.querySelector('span') as HTMLElement;
			expect(el.className).toContain('ring-1');
			expect(el.className).toContain('ring-inset');
			expect(el.className).toContain('ring-border');
		});

		it('takes precedence over tone when both are set', () => {
			const { container } = render(ToneTile, {
				props: { tone: 'danger', tint: 'purple', icon: Calendar }
			});
			const el = container.querySelector('span') as HTMLElement;
			expect(el.className).toContain('bg-poster-purple');
			expect(el.className).not.toContain('bg-destructive');
		});

		it('stays a decorative aria-hidden icon next to visible text (no label)', () => {
			const { container } = render(ToneTile, {
				props: { tint: 'amber', icon: Calendar }
			});
			const el = container.querySelector('span') as HTMLElement;
			expect(el.getAttribute('aria-hidden')).toBe('true');
			expect(el.getAttribute('role')).toBeNull();
		});

		it('is an accessibly named img when a label is given', () => {
			const { container } = render(ToneTile, {
				props: { tint: 'ink', icon: Calendar, label: 'Settings' }
			});
			const el = container.querySelector('span') as HTMLElement;
			expect(el.getAttribute('role')).toBe('img');
			expect(el.getAttribute('aria-label')).toBe('Settings');
		});
	});
});
