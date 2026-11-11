import { describe, it, expect } from 'vitest';
import { getLocale } from '$lib/paraglide/runtime.js';
import * as m from '$lib/paraglide/messages.js';
import { runWithRequestLocale } from './request-locale';

const tick = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms));

describe('request-scoped server locale', () => {
	it('keeps each concurrent request on its own locale across awaits', async () => {
		const origin = 'http://localhost';
		const seen: Record<string, { locale: string; msg: string }> = {};

		// Request A starts first, then yields; request B runs entirely in the gap.
		const reqA = runWithRequestLocale('de', origin, async () => {
			await tick(20);
			seen.a = { locale: getLocale(), msg: m['accountDeletion.cancel']() };
		});
		const reqB = runWithRequestLocale('fr', origin, async () => {
			await tick(5);
			seen.b = { locale: getLocale(), msg: m['accountDeletion.cancel']() };
		});
		await Promise.all([reqA, reqB]);

		expect(seen.a).toEqual({ locale: 'de', msg: 'Abbrechen' });
		expect(seen.b).toEqual({ locale: 'fr', msg: 'Annuler' });
	});
});
