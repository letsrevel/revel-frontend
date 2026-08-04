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

	it('poster volume applies the loudest typography contract', () => {
		render(PageHeader, { props: { title: 'Party time', volume: 'poster' } });
		const h1 = screen.getByRole('heading', { level: 1 });
		expect(h1.className).toContain('text-4xl');
		expect(h1.className).toContain('font-black');
		expect(h1.className).toContain('leading-[1.08]');
		expect(h1.className).toContain('sm:text-5xl');
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

	it('passes through arbitrary attributes to the header element', () => {
		// Asserts on the <header> element directly rather than its implicit
		// `banner` role: that role only holds here because the test renders the
		// header straight into <body> — in real usage it can sit inside a
		// sectioning element (losing the landmark role), so asserting role=banner
		// would overstate what this test actually locks down (restProps spread).
		const { container } = render(PageHeader, {
			props: { title: 'Members', id: 'members-header', 'aria-label': 'Members admin header' }
		});
		const header = container.querySelector('header') as HTMLElement;
		expect(header.id).toBe('members-header');
		expect(header.getAttribute('aria-label')).toBe('Members admin header');
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

	it('kicker defaults to the primary accent off a band', () => {
		render(PageHeader, { props: { title: 'Members', kicker: 'Organization' } });
		expect(screen.getByText('Organization').className).toContain('text-primary');
	});

	it('onBand drops the accent kicker and muted subtitle for the band foreground', () => {
		// The reason this prop exists: `text-primary` on the light periwinkle
		// `--secondary` band measures 4.12:1, below AA for the kicker's 14px
		// extrabold. Inheriting the band's own audited foreground is 9.00:1.
		render(PageHeader, {
			props: {
				title: 'Apply',
				kicker: 'Acme',
				subtitle: 'Tell us about yourself.',
				onBand: true
			}
		});
		const kicker = screen.getByText('Acme');
		expect(kicker.className).not.toContain('text-primary');
		expect(kicker.className).toContain('text-current');
		// Typography is untouched by the prop — only colour.
		expect(kicker.className).toContain('font-extrabold');
		expect(kicker.className).toContain('tracking-[0.12em]');

		const subtitle = screen.getByText('Tell us about yourself.');
		expect(subtitle.className).not.toContain('text-muted-foreground');
		expect(subtitle.className).toContain('text-current');
	});

	it('onBand leaves the h1 inheriting, in every volume', () => {
		render(PageHeader, { props: { title: 'Apply', volume: 'poster', onBand: true } });
		const h1 = screen.getByRole('heading', { level: 1 });
		expect(h1.className).not.toMatch(/\btext-(primary|muted-foreground|current)\b/);
		expect(h1.className).toContain('text-4xl');
	});

	it('decoration also renders in poster volume', () => {
		render(PageHeader, { props: { title: 'Hey', volume: 'poster', decoration: snip('New!') } });
		expect(screen.getByText('New!').closest('[aria-hidden="true"]')).not.toBeNull();
	});
});
