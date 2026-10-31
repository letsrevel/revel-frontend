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
});
