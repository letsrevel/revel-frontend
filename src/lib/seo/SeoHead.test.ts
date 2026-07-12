import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/svelte';
import SeoHead from '$lib/seo/SeoHead.svelte';
import type { SeoConfig } from '$lib/seo';

const cfg: SeoConfig = {
	title: 'Test',
	description: 'Test description',
	canonical: 'https://letsrevel.io/test',
	og: {
		type: 'website',
		title: 'Test',
		description: 'Test description',
		url: 'https://letsrevel.io/test',
		siteName: 'Revel',
		locale: 'en_US',
		localeAlternate: ['de_DE', 'it_IT']
	},
	twitter: {
		card: 'summary_large_image',
		title: 'Test',
		description: 'Test description',
		site: '@letsrevel'
	},
	hreflang: [
		{ lang: 'en', href: 'https://letsrevel.io/test' },
		{ lang: 'de', href: 'https://letsrevel.io/test' },
		{ lang: 'it', href: 'https://letsrevel.io/test' },
		{ lang: 'x-default', href: 'https://letsrevel.io/test' }
	],
	jsonLd: [{ '@context': 'https://schema.org', '@type': 'WebSite', name: 'Revel' }]
};

describe('<SeoHead>', () => {
	it('renders title and description into <head>', () => {
		render(SeoHead, { config: cfg });
		expect(document.title).toBe('Test');
		const desc = document.head.querySelector('meta[name="description"]');
		expect(desc?.getAttribute('content')).toBe('Test description');
	});

	it('renders canonical', () => {
		render(SeoHead, { config: cfg });
		const link = document.head.querySelector('link[rel="canonical"]');
		expect(link?.getAttribute('href')).toBe('https://letsrevel.io/test');
	});

	it('renders all hreflang alternates', () => {
		render(SeoHead, { config: cfg });
		const links = document.head.querySelectorAll('link[rel="alternate"][hreflang]');
		expect(links).toHaveLength(4);
	});

	it('renders robots when set', () => {
		render(SeoHead, { config: { ...cfg, robots: 'noindex,follow' } });
		const robots = document.head.querySelector('meta[name="robots"]');
		expect(robots?.getAttribute('content')).toBe('noindex,follow');
	});

	it('renders og:logo when set and omits it otherwise', () => {
		render(SeoHead, { config: cfg });
		expect(document.head.querySelector('meta[property="og:logo"]')).toBeNull();
		document.head.innerHTML = '';
		render(SeoHead, {
			config: { ...cfg, og: { ...cfg.og, logo: 'https://letsrevel.io/og-logo-v1.png' } }
		});
		const logo = document.head.querySelector('meta[property="og:logo"]');
		expect(logo?.getAttribute('content')).toBe('https://letsrevel.io/og-logo-v1.png');
	});

	it('renders one <script type="application/ld+json"> per JSON-LD block', () => {
		render(SeoHead, { config: cfg });
		const scripts = document.head.querySelectorAll('script[type="application/ld+json"]');
		expect(scripts).toHaveLength(1);
		expect(scripts[0].textContent).toContain('"@type":"WebSite"');
	});
});
