import { describe, it, expect } from 'vitest';
import { embedRootAttributes, rootAttributesFor } from './embed';

describe('embedRootAttributes', () => {
	it('applies an explicit dark theme to <html> and locks it', () => {
		const attrs = embedRootAttributes('dark');
		expect(attrs).toContain('class="dark"');
		expect(attrs).toContain('color-scheme: dark');
		expect(attrs).toContain('data-theme-locked="dark"');
	});

	it('locks light without adding the dark class', () => {
		const attrs = embedRootAttributes('light');
		expect(attrs).not.toContain('class="dark"');
		expect(attrs).toContain('data-theme-locked="light"');
	});

	it('leaves auto to the anti-FOUC script, whose default already means system', () => {
		expect(embedRootAttributes('auto')).toBe('');
	});
});

describe('rootAttributesFor', () => {
	it('is a no-op outside the embed surface, whatever ?theme says', () => {
		expect(rootAttributesFor(new URL('https://letsrevel.io/events?theme=dark'))).toBe('');
		expect(rootAttributesFor(new URL('https://letsrevel.io/'))).toBe('');
	});

	it('resolves the theme from the embed URL', () => {
		expect(rootAttributesFor(new URL('https://letsrevel.io/embed/acme?theme=dark'))).toContain(
			'class="dark"'
		);
		expect(rootAttributesFor(new URL('https://letsrevel.io/embed/acme?theme=light'))).toContain(
			'data-theme-locked="light"'
		);
		expect(rootAttributesFor(new URL('https://letsrevel.io/embed/acme'))).toBe('');
	});

	it('ignores an unknown theme rather than emitting it', () => {
		const attrs = rootAttributesFor(new URL('https://letsrevel.io/embed/acme?theme=%22onload%3D'));
		expect(attrs).toBe('');
	});
});
