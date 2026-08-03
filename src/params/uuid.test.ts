import { describe, it, expect } from 'vitest';
import { match } from './uuid';

describe('uuid param matcher', () => {
	it('accepts backend-shaped lowercase UUIDs', () => {
		expect(match('0f14d0ab-9605-4a62-a9e4-5ed26688389b')).toBe(true);
		expect(match('00000000-0000-0000-0000-000000000000')).toBe(true);
	});

	it('rejects slugs and slug-like strings', () => {
		expect(match('revel-events-collective')).toBe(false);
		expect(match('summer-sunset-music-festival')).toBe(false);
	});

	it('rejects uppercase UUIDs (backend emits lowercase only)', () => {
		expect(match('0F14D0AB-9605-4A62-A9E4-5ED26688389B')).toBe(false);
	});

	it('rejects near-misses', () => {
		expect(match('0f14d0ab-9605-4a62-a9e4-5ed26688389')).toBe(false); // last group short
		expect(match('0f14d0ab96054a62a9e45ed26688389b')).toBe(false); // no hyphens
		expect(match('0f14d0ab-9605-4a62-a9e4-5ed26688389b-x')).toBe(false); // trailing garbage
		expect(match('g014d0ab-9605-4a62-a9e4-5ed26688389b')).toBe(false); // non-hex
		expect(match('')).toBe(false);
	});
});
