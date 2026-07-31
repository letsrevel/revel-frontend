import { describe, it, expect } from 'vitest';
import * as m from '$lib/paraglide/messages.js';

/**
 * Contract for counted messages.
 *
 * These used to be built by appending an English suffix the caller passed in
 * (`plural: count === 1 ? '' : 's'`), which cannot express `persona`/`persone`,
 * `Platz`/`Plätze`, or `invitación`/`invitaciones`, and left the rest of the
 * sentence unagreed. They are now real CLDR plural variants selected from `count`.
 *
 * The assertions below are deliberately about agreement beyond the noun — the verb
 * and the adjective — because that is exactly what the old mechanism could not do.
 */
describe('counted messages use real plural forms', () => {
	it('agrees the verb with the count, per locale', () => {
		const key = 'orgAdminTokensPage.delete_usesDescription';
		expect(m[key]({ count: 1 }, { locale: 'it' })).toContain('persona si è già unita');
		expect(m[key]({ count: 3 }, { locale: 'it' })).toContain('persone si sono già unite');
		expect(m[key]({ count: 1 }, { locale: 'de' })).toContain('Person ist');
		expect(m[key]({ count: 3 }, { locale: 'de' })).toContain('Personen sind');
		expect(m[key]({ count: 1 }, { locale: 'es' })).toContain('persona ya se ha unido');
		expect(m[key]({ count: 3 }, { locale: 'es' })).toContain('personas ya se han unido');
	});

	it('handles irregular plurals that a suffix could never produce', () => {
		expect(m['orgAdmin.sectors.card.seats']({ count: 1 }, { locale: 'de' })).toBe('1 Platz');
		expect(m['orgAdmin.sectors.card.seats']({ count: 3 }, { locale: 'de' })).toBe('3 Plätze');
		expect(m['orgAdmin.sectors.card.seats']({ count: 3 }, { locale: 'pt' })).toBe('3 lugares');
		expect(m['orgAdmin.venues.card.sectors']({ count: 3 }, { locale: 'es' })).toBe('3 sectores');
	});

	it('agrees adjectives, not just the noun', () => {
		expect(m['orgAdmin.events.sections.cancelled']({ count: 1 }, { locale: 'it' })).toBe(
			'1 evento annullato'
		);
		expect(m['orgAdmin.events.sections.cancelled']({ count: 3 }, { locale: 'it' })).toBe(
			'3 eventi annullati'
		);
	});

	it('treats 0 as the singular form in French, per CLDR', () => {
		const key = 'eventSeriesDetailPage.events_count';
		const zero = m[key]({ count: 0 }, { locale: 'fr' });
		const one = m[key]({ count: 1 }, { locale: 'fr' });
		const many = m[key]({ count: 3 }, { locale: 'fr' });
		expect(zero.replace('0', '1')).toBe(one);
		expect(many).not.toBe(one);
	});

	it('never falls through to emitting the message key', () => {
		// A count landing in a CLDR category with no explicit variant (French `many`)
		// must still render text, not the key name — hence the catch-all branch.
		const out = m['eventSeriesDetailPage.events_count']({ count: 1_000_000 }, { locale: 'fr' });
		expect(out).not.toContain('events_count');
		expect(out).toContain('1000000');
	});

	it('no longer accepts a caller-supplied suffix', () => {
		// The `plural` input is gone; passing it must not leak into the output.
		const out = m['resourceList.showingCount'](
			{ count: 2, plural: 'XX' } as unknown as { count: number },
			{ locale: 'en' }
		);
		expect(out).not.toContain('XX');
		expect(out).toContain('resources');
	});
});
