import { describe, it, expect } from 'vitest';
import { plainOrNull } from './plain-data';

describe('plainOrNull', () => {
	it('keeps plain objects, arrays and primitives', () => {
		const o = { a: 1 };
		expect(plainOrNull(o)).toBe(o);
		expect(plainOrNull([1])).toEqual([1]);
		expect(plainOrNull(0)).toBe(0);
	});
	it('maps null/undefined to null', () => {
		expect(plainOrNull(undefined)).toBeNull();
		expect(plainOrNull(null)).toBeNull();
	});
	it('rejects non-POJOs devalue cannot serialize', () => {
		expect(plainOrNull(new Blob(['x']))).toBeNull();
		expect(plainOrNull(new ReadableStream())).toBeNull();
	});
});
