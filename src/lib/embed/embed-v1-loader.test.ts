import { describe, it, expect, afterEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const loaderSource = readFileSync(resolve(process.cwd(), 'static/embed-v1.js'), 'utf-8');

/** Run the loader as if dropped on a host page; returns the created iframe. */
function runLoader(attrs: Record<string, string> = {}): HTMLIFrameElement {
	const script = document.createElement('script');
	script.setAttribute('src', 'https://letsrevel.io/embed-v1.js');
	script.setAttribute('data-revel-org', 'acme');
	for (const [key, value] of Object.entries(attrs)) script.setAttribute(key, value);
	document.body.appendChild(script);
	Object.defineProperty(document, 'currentScript', { value: script, configurable: true });
	new Function(loaderSource)();
	const iframe = document.querySelector('iframe');
	if (!iframe) throw new Error('loader did not create an iframe');
	return iframe;
}

function setHostSearch(search: string) {
	window.history.replaceState({}, '', `/page${search}`);
}

afterEach(() => {
	document.body.innerHTML = '';
	setHostSearch('');
});

describe('embed-v1 loader UTM passthrough', () => {
	it('defaults to utm_content=<hostname> when the host page has no utm_source', () => {
		setHostSearch('?foo=1&utm_campaign=ignored-without-source');
		const src = new URL(runLoader().src);
		expect(src.searchParams.get('utm_content')).toBe(window.location.hostname);
		expect(src.searchParams.get('utm_source')).toBeNull();
		expect(src.searchParams.get('utm_campaign')).toBeNull();
	});

	it('copies the four utm keys verbatim when the host page has utm_source', () => {
		setHostSearch('?utm_source=newsletter&utm_campaign=sept&utm_term=NOT-copied&x=1');
		const src = new URL(runLoader().src);
		expect(src.searchParams.get('utm_source')).toBe('newsletter');
		expect(src.searchParams.get('utm_campaign')).toBe('sept');
		expect(src.searchParams.get('utm_medium')).toBeNull();
		expect(src.searchParams.get('utm_term')).toBeNull();
		expect(src.searchParams.get('x')).toBeNull();
		// hostname default is skipped — the organizer's tags replace the set
		expect(src.searchParams.get('utm_content')).toBeNull();
	});

	it('still forwards config attributes alongside the passthrough', () => {
		setHostSearch('?utm_source=newsletter');
		const src = new URL(runLoader({ 'data-revel-theme': 'dark' }).src);
		expect(src.searchParams.get('theme')).toBe('dark');
		expect(src.pathname).toBe('/embed/acme');
	});
});
