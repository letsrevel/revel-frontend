import { describe, it, expect } from 'vitest';
import { resolveLang } from '$lib/seo/server';
import { buildSeo } from '$lib/seo';
import { runWithRequestLocale } from '$lib/server/request-locale';

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

	it('returns es when Accept-Language prefers es', () => {
		const req = new Request('https://x.test/', {
			headers: { 'accept-language': 'es-ES,es;q=0.9,en;q=0.5' }
		});
		expect(resolveLang(req)).toBe('es');
	});

	it('returns pt when Accept-Language has pt', () => {
		const req = new Request('https://x.test/', {
			headers: { 'accept-language': 'pt-PT,pt;q=0.9,en;q=0.5' }
		});
		expect(resolveLang(req)).toBe('pt');
	});

	it('falls back to en for unknown languages', () => {
		const req = new Request('https://x.test/', {
			headers: { 'accept-language': 'ja,ko;q=0.9' }
		});
		expect(resolveLang(req)).toBe('en');
	});

	it('uses the request UI locale over Accept-Language (de header, en cookie)', () => {
		const req = new Request('https://x.test/', {
			headers: { 'accept-language': 'de-DE,de;q=0.9' }
		});
		const lang = runWithRequestLocale('en', 'https://x.test', () => resolveLang(req));
		expect(lang).toBe('en');
		const cfg = runWithRequestLocale('en', 'https://x.test', () =>
			buildSeo({
				kind: 'events-listing',
				url: new URL('https://x.test/events'),
				lang: resolveLang(req)
			})
		);
		expect(cfg.title).toBe('Browse Events | Revel');
		expect(cfg.og.locale).toBe('en_US');
	});

	it('falls back to en when no header is set', () => {
		const req = new Request('https://x.test/');
		expect(resolveLang(req)).toBe('en');
	});
});
