import { describe, it, expect } from 'vitest';
import type { RequestEvent } from '@sveltejs/kit';
import { getLocale } from '$lib/paraglide/runtime.js';
import * as m from '$lib/paraglide/messages.js';
import { i18nHandle } from './i18n';

function deferred(): { promise: Promise<void>; resolve: () => void } {
	let resolve!: () => void;
	const promise = new Promise<void>((r) => (resolve = r));
	return { promise, resolve };
}

function fakeEvent(lang: string): RequestEvent {
	return {
		url: new URL(`https://revel.test/?lang=${lang}`),
		request: new Request('https://revel.test/'),
		cookies: { get: () => undefined, set: () => undefined }
	} as unknown as RequestEvent;
}

describe('i18nHandle', () => {
	it('keeps each interleaved request on its own locale', async () => {
		const handle = i18nHandle();
		const gateA = deferred();
		const bDone = deferred();

		const seen = (gate?: Promise<void>) => async (): Promise<Response> => {
			if (gate) await gate;
			return new Response(
				JSON.stringify({ locale: getLocale(), msg: m['accountDeletion.cancel']() })
			);
		};

		// A (de) starts first and parks on a gate; B (fr) runs to completion while A waits.
		const resA = handle({ event: fakeEvent('de'), resolve: seen(gateA.promise) } as never);
		const resB = Promise.resolve(handle({ event: fakeEvent('fr'), resolve: seen() } as never)).then(
			(r) => {
				bDone.resolve();
				return r;
			}
		);
		await bDone.promise;
		gateA.resolve();

		expect(await (await resA).json()).toEqual({ locale: 'de', msg: 'Abbrechen' });
		expect(await (await resB).json()).toEqual({ locale: 'fr', msg: 'Annuler' });
	});
});
