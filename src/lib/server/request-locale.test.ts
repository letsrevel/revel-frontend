import { describe, it, expect } from 'vitest';
import { getLocale } from '$lib/paraglide/runtime.js';
import * as m from '$lib/paraglide/messages.js';
import { runWithRequestLocale } from './request-locale';

function deferred(): { promise: Promise<void>; resolve: () => void } {
	let resolve!: () => void;
	const promise = new Promise<void>((r) => (resolve = r));
	return { promise, resolve };
}

describe('request-scoped server locale', () => {
	it('keeps each concurrent request on its own locale across awaits', async () => {
		const origin = 'http://localhost';
		const gate = deferred();

		// Request A (de) parks on a gate; request B (fr) runs entirely in the gap.
		const reqA = runWithRequestLocale('de', origin, async () => {
			await gate.promise;
			return { locale: getLocale(), msg: m['accountDeletion.cancel']() };
		});
		const reqB = runWithRequestLocale('fr', origin, async () => ({
			locale: getLocale(),
			msg: m['accountDeletion.cancel']()
		}));
		const b = await reqB;
		gate.resolve();

		expect(await reqA).toEqual({ locale: 'de', msg: 'Abbrechen' });
		expect(b).toEqual({ locale: 'fr', msg: 'Annuler' });
	});
});
