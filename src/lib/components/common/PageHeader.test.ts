import { render, screen } from '@testing-library/svelte';
import { describe, it, expect } from 'vitest';
import { createRawSnippet } from 'svelte';
import PageHeader from './PageHeader.svelte';

const snip = (s: string) => createRawSnippet(() => ({ render: () => `<span>${s}</span>` }));

describe('PageHeader', () => {
	it('renders title as the page h1', () => {
		render(PageHeader, { props: { title: 'Your events' } });
		expect(screen.getByRole('heading', { level: 1, name: 'Your events' })).toBeInTheDocument();
	});

	it('studio volume (default) uses the studio scale', () => {
		render(PageHeader, { props: { title: 'Settings' } });
		const h1 = screen.getByRole('heading', { level: 1 });
		expect(h1.className).toContain('font-extrabold');
		expect(h1.className).not.toContain('font-black');
	});

	it('celebration volume uses the display scale', () => {
		render(PageHeader, { props: { title: 'Party time', volume: 'celebration' } });
		const h1 = screen.getByRole('heading', { level: 1 });
		expect(h1.className).toContain('font-black');
	});

	it('celebration volume applies the full typography contract', () => {
		render(PageHeader, { props: { title: 'Party time', volume: 'celebration' } });
		const h1 = screen.getByRole('heading', { level: 1 });
		expect(h1.className).toContain('text-3xl');
		expect(h1.className).toContain('font-black');
		expect(h1.className).toContain('leading-[1.12]');
		expect(h1.className).toContain('sm:text-4xl');
	});

	it('studio volume applies the full typography contract', () => {
		render(PageHeader, { props: { title: 'Settings', volume: 'studio' } });
		const h1 = screen.getByRole('heading', { level: 1 });
		expect(h1.className).toContain('text-2xl');
		expect(h1.className).toContain('font-extrabold');
		expect(h1.className).toContain('tracking-tight');
		expect(h1.className).toContain('sm:text-3xl');
	});

	it('renders kicker, subtitle, and actions', () => {
		render(PageHeader, {
			props: {
				title: 'Members',
				kicker: 'Organization',
				subtitle: 'Manage who belongs.',
				actions: snip('Invite')
			}
		});
		expect(screen.getByText('Organization')).toBeInTheDocument();
		expect(screen.getByText('Manage who belongs.')).toBeInTheDocument();
		expect(screen.getByText('Invite')).toBeInTheDocument();
	});

	it('decoration renders in celebration and is decorative; ignored in studio', () => {
		const { container, unmount } = render(PageHeader, {
			props: { title: 'Hey', volume: 'celebration', decoration: snip('New!') }
		});
		const deco = screen.getByText('New!').closest('[aria-hidden="true"]');
		expect(deco).not.toBeNull();
		expect(container.textContent).toContain('New!');
		unmount();
		render(PageHeader, { props: { title: 'Hey', volume: 'studio', decoration: snip('New!') } });
		expect(screen.queryByText('New!')).toBeNull();
	});
});
