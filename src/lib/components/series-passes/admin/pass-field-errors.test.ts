import { describe, it, expect } from 'vitest';
import { toPassFieldErrors } from './pass-field-errors';

describe('toPassFieldErrors', () => {
	it('maps payload.tier_links.N.* locs onto tier_links', () => {
		const out = toPassFieldErrors({
			detail: [{ loc: ['body', 'payload', 'tier_links', 0, 'tier'], msg: 'Too strict.' }]
		});
		expect(out).toEqual({ tier_links: 'Too strict.' });
	});

	it('concatenates multiple messages per key instead of keeping the last', () => {
		const out = toPassFieldErrors({
			errors: {
				'tier_links.0.tier': ['First problem.'],
				'tier_links.1.tier': ['Second problem.'],
				'payload.name': ['Bad name.']
			}
		});
		expect(out.tier_links).toBe('First problem. Second problem.');
		expect(out.name).toBe('Bad name.');
	});
});
