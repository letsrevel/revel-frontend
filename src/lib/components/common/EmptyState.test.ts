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

	it('renders an h2 when level=2', () => {
		render(EmptyState, {
			props: { icon: CalendarX, title: 'No events yet', level: 2 }
		});
		expect(screen.getByRole('heading', { level: 2, name: 'No events yet' })).toBeInTheDocument();
	});

	describe('level 1 (display variant)', () => {
		it('renders an h1 carrying the celebration display scale', () => {
			render(EmptyState, {
				props: { icon: CalendarX, title: 'Preferences updated', level: 1 }
			});
			const h1 = screen.getByRole('heading', { level: 1, name: 'Preferences updated' });
			expect(h1.className).toContain('text-3xl');
			expect(h1.className).toContain('font-black');
			expect(h1.className).toContain('leading-[1.12]');
			expect(h1.className).toContain('sm:text-4xl');
		});

		it('scales the chip up but keeps the audited poster pair', () => {
			const { container } = render(EmptyState, {
				props: { icon: CalendarX, title: 'Done', level: 1 }
			});
			const chip = container.querySelector('[aria-hidden="true"]') as HTMLElement;
			expect(chip.className).toContain('h-16');
			expect(chip.className).toContain('w-16');
			// Level 1 changes size only — the tone pair is untouched, so it
			// inherits the same audited contrast levels 2/3 have.
			expect(chip.className).toContain('bg-poster-purple');
			expect(chip.className).toContain('text-poster-white');
			expect(chip.className).toContain('-rotate-2');
		});

		it('gives body and actions the roomier display spacing', () => {
			const { container } = render(EmptyState, {
				props: {
					icon: CalendarX,
					title: 'Done',
					body: 'You are all set.',
					level: 1,
					action: snip('Go home')
				}
			});
			expect((container.firstElementChild as HTMLElement).className).toContain('py-14');
			expect(screen.getByText('You are all set.').className).toContain('text-base');
			expect(screen.getByText('Go home').parentElement?.className).toContain('mt-7');
		});

		it('leaves the level 2/3 class strings byte-identical', () => {
			// Level 1 arrived as a whole extra set of literal class strings rather
			// than conditional fragments spliced into the old ones, specifically so
			// that no existing adopter's markup (or the e2e suite's DOM) shifts.
			// These are the exact strings that shipped before it existed.
			const { container, unmount } = render(EmptyState, {
				props: { icon: CalendarX, title: 'Empty', body: 'Nothing here.', action: snip('Add') }
			});
			const root = container.firstElementChild as HTMLElement;
			expect(root.getAttribute('class')).toBe(
				'flex flex-col items-center rounded-lg border-2 bg-card px-6 py-10 text-center shadow-poster'
			);
			expect(root.querySelector('[aria-hidden="true"]')?.getAttribute('class')).toBe(
				'flex h-14 w-14 -rotate-2 items-center justify-center rounded-2xl shadow-sm bg-poster-purple text-poster-white'
			);
			expect(screen.getByRole('heading', { level: 3 }).getAttribute('class')).toBe(
				'mt-4 text-lg font-extrabold'
			);
			expect(screen.getByText('Nothing here.').getAttribute('class')).toBe(
				'mt-1.5 max-w-sm text-sm text-muted-foreground'
			);
			expect(screen.getByText('Add').parentElement?.getAttribute('class')).toBe(
				'mt-5 flex flex-wrap justify-center gap-2'
			);
			unmount();
		});
	});
});
