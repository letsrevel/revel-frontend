import { describe, it, expect, vi } from 'vitest';
import { createSyncOnChange } from './sync-on-change';

describe('createSyncOnChange', () => {
	it('applies the first value and every later change', () => {
		const apply = vi.fn();
		const sync = createSyncOnChange<string>(apply);
		expect(sync('a')).toBe(true);
		expect(sync('b')).toBe(true);
		expect(apply.mock.calls).toEqual([['a'], ['b']]);
	});

	it('ignores a repeat of the last synced value (new data reference, same field)', () => {
		const apply = vi.fn();
		const sync = createSyncOnChange<string>(apply);
		sync('DE123');
		expect(sync('DE123')).toBe(false);
		expect(apply).toHaveBeenCalledTimes(1);
	});

	it('treats an empty string as a real first value', () => {
		const apply = vi.fn();
		const sync = createSyncOnChange<string>(apply);
		expect(sync('')).toBe(true);
		expect(sync('')).toBe(false);
	});

	describe('with a current-draft guard', () => {
		const vatEquals = (a: string, b: string): boolean =>
			a.trim().toUpperCase() === b.trim().toUpperCase();

		it('always applies the first value, whatever the draft holds', () => {
			const apply = vi.fn();
			const sync = createSyncOnChange<string>(apply, { current: () => 'typed' });
			expect(sync('DE1')).toBe(true);
			expect(apply).toHaveBeenCalledWith('DE1');
		});

		it('gives an untouched draft the new server value', () => {
			let draft = '';
			const sync = createSyncOnChange<string>((v) => (draft = v), { current: () => draft });
			sync('DE1');
			expect(sync('DE2')).toBe(true);
			expect(draft).toBe('DE2');
		});

		it('gives a draft equal to the incoming value the canonical value', () => {
			let draft = '';
			const sync = createSyncOnChange<string>((v) => (draft = v), {
				current: () => draft,
				equals: vatEquals
			});
			sync('');
			draft = ' de123 ';
			expect(sync('DE123')).toBe(true);
			expect(draft).toBe('DE123');
		});

		it('keeps a diverging draft but remembers the incoming value', () => {
			let draft = '';
			const apply = vi.fn((v: string) => (draft = v));
			const sync = createSyncOnChange<string>(apply, { current: () => draft });
			sync('DE1');
			draft = 'my edit';
			expect(sync('DE2')).toBe(false);
			expect(draft).toBe('my edit');
			// Same incoming again is a no-op, and a later new value still compares to DE2.
			expect(sync('DE2')).toBe(false);
			draft = 'DE2';
			expect(sync('DE3')).toBe(true);
			expect(draft).toBe('DE3');
		});

		it('compares the draft with the last applied value using equals', () => {
			let draft = '';
			const sync = createSyncOnChange<string>((v) => (draft = v), {
				current: () => draft,
				equals: vatEquals
			});
			sync('DE1');
			draft = 'de1';
			expect(sync('DE2')).toBe(true);
		});
	});
});
