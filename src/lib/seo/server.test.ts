import { describe, it, expect } from 'vitest';
import { resolveLang } from '$lib/seo/server';

describe('resolveLang', () => {
	it('returns en when Accept-Language has only en', () => {
		const req = new Request('https://x.test/', {
			headers: { 'accept-language': 'en-US,en;q=0.9' }
		});
		expect(resolveLang(req)).toBe('en');
	});

	it('returns de when Accept-Language prefers de', () => {
		const req = new Request('https://x.test/', {
			headers: { 'accept-language': 'de-DE,de;q=0.9,en;q=0.5' }
		});
		expect(resolveLang(req)).toBe('de');
	});

	it('returns it when Accept-Language has it', () => {
		const req = new Request('https://x.test/', {
			headers: { 'accept-language': 'it,en;q=0.5' }
		});
		expect(resolveLang(req)).toBe('it');
	});

	it('returns fr when Accept-Language has fr', () => {
		const req = new Request('https://x.test/', {
			headers: { 'accept-language': 'fr,en;q=0.5' }
		});
		expect(resolveLang(req)).toBe('fr');
	});

	it('falls back to en for unknown languages', () => {
		const req = new Request('https://x.test/', {
			headers: { 'accept-language': 'es,pt;q=0.9' }
		});
		expect(resolveLang(req)).toBe('en');
	});

	it('falls back to en when no header is set', () => {
		const req = new Request('https://x.test/');
		expect(resolveLang(req)).toBe('en');
	});
});
