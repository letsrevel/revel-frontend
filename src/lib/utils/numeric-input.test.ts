import { describe, it, expect, vi } from 'vitest';
import { parseCommittableNumber, clampNumber, settleNumber } from './numeric-input';
import { numericField } from './numeric-input.svelte';

describe('parseCommittableNumber', () => {
	it('commits a whole number inside the bounds', () => {
		expect(parseCommittableNumber('5', { min: 1, max: 52 })).toBe(5);
		expect(parseCommittableNumber(' 5 ', { min: 1, max: 52 })).toBe(5);
		expect(parseCommittableNumber('05', { min: 1, max: 52 })).toBe(5);
	});

	it('refuses an empty buffer instead of reading it as 0', () => {
		// The whole point of the sweep: Number('') is 0 and Number.isFinite(0) is
		// true, so a naive guard commits 0 and the clamp pushes it up to the min.
		expect(parseCommittableNumber('', { min: 1 })).toBeNull();
		expect(parseCommittableNumber('   ', { min: 1 })).toBeNull();
	});

	it('refuses half-typed input rather than committing a prefix', () => {
		expect(parseCommittableNumber('-', {})).toBeNull();
		expect(parseCommittableNumber('1.', { decimal: true })).toBeNull();
		expect(parseCommittableNumber('.', { decimal: true })).toBeNull();
		expect(parseCommittableNumber('abc', {})).toBeNull();
	});

	it('refuses decimals and exponents on a whole-number field', () => {
		// type="number" hands us "1.5" and "1e2" verbatim; parseInt would commit 1.
		expect(parseCommittableNumber('1.5', {})).toBeNull();
		expect(parseCommittableNumber('1e2', {})).toBeNull();
	});

	it('accepts decimals only when the field asks for them', () => {
		expect(parseCommittableNumber('0.5', { decimal: true, min: 0, max: 100 })).toBe(0.5);
		expect(parseCommittableNumber('1e2', { decimal: true })).toBeNull();
	});

	it('refuses a value outside the bounds instead of clamping it', () => {
		expect(parseCommittableNumber('0', { min: 1, max: 52 })).toBeNull();
		expect(parseCommittableNumber('53', { min: 1, max: 52 })).toBeNull();
		// ...but 0 is a perfectly good value where the minimum allows it.
		expect(parseCommittableNumber('0', { min: 0, max: 100 })).toBe(0);
	});

	it('accepts negatives when the bounds allow them', () => {
		expect(parseCommittableNumber('-12', { min: -40, max: 40 })).toBe(-12);
		expect(parseCommittableNumber('-12', { min: 0 })).toBeNull();
	});

	it('refuses an integer too large to be exact', () => {
		expect(parseCommittableNumber('9007199254740993', {})).toBeNull();
	});
});

describe('clampNumber', () => {
	it('pulls a value inside the bounds', () => {
		expect(clampNumber(0, { min: 1, max: 52 })).toBe(1);
		expect(clampNumber(99, { min: 1, max: 52 })).toBe(52);
		expect(clampNumber(7, { min: 1, max: 52 })).toBe(7);
	});

	it('leaves a missing bound unconstrained', () => {
		expect(clampNumber(-99, { max: 52 })).toBe(-99);
		expect(clampNumber(9999, { min: 1 })).toBe(9999);
	});
});

describe('settleNumber', () => {
	it('normalizes what the user actually entered', () => {
		expect(settleNumber('05', { min: 1, fallback: 1 })).toBe(5);
		expect(settleNumber('10.5', { min: 1, fallback: 1 })).toBe(10);
		expect(settleNumber('1e2', { min: 1, fallback: 1 })).toBe(100);
	});

	it('clamps an out-of-range entry into the bounds', () => {
		expect(settleNumber('0', { min: 1, max: 52, fallback: 1 })).toBe(1);
		expect(settleNumber('99', { min: 1, max: 52, fallback: 1 })).toBe(52);
		expect(settleNumber('-5', { min: 1, fallback: 1 })).toBe(1);
	});

	it('keeps the fraction on a decimal field', () => {
		expect(settleNumber('0.5', { min: 0, max: 100, decimal: true, fallback: 0 })).toBe(0.5);
		expect(settleNumber('120.5', { min: 0, max: 100, decimal: true, fallback: 0 })).toBe(100);
	});

	it('falls back for an empty or unparseable buffer', () => {
		expect(settleNumber('', { min: 1, fallback: 7 })).toBe(7);
		expect(settleNumber('  ', { min: 1, fallback: 7 })).toBe(7);
		expect(settleNumber('-', { min: 1, fallback: 7 })).toBe(7);
	});

	it('settles empty to null for a clearable field', () => {
		expect(settleNumber('', { min: 1, fallback: null })).toBeNull();
		expect(settleNumber('4', { min: 1, max: 31, fallback: null })).toBe(4);
	});
});

describe('numericField', () => {
	/** Stand-in for the `oninput` event a real input hands the handler. */
	function typed(value: string) {
		return { currentTarget: { value } } as Event & { currentTarget: HTMLInputElement };
	}

	function setup(initial = 5, options: Partial<Parameters<typeof numericField>[0]> = {}) {
		let committed: number | null = initial;
		const commit = vi.fn((next: number | null) => (committed = next));
		const field = numericField({
			value: () => committed,
			commit,
			min: 1,
			max: 52,
			...options
		});
		return { field, commit, committed: () => committed };
	}

	it('shows the committed value until the user starts editing', () => {
		const { field } = setup(5);
		expect(field.value).toBe('5');
	});

	it('lets the field be emptied without refilling it', () => {
		const { field, commit } = setup(5);

		field.oninput(typed(''));

		expect(field.value).toBe('');
		expect(commit).not.toHaveBeenCalled();
	});

	it('commits a replacement typed after clearing', () => {
		const { field, commit } = setup(5);

		field.oninput(typed(''));
		field.oninput(typed('1'));
		field.oninput(typed('12'));

		expect(field.value).toBe('12');
		expect(commit).toHaveBeenLastCalledWith(12);
	});

	it('keeps a transient out-of-range keystroke visible without committing it', () => {
		const { field, commit } = setup(5);

		// "0" on the way to "10" is a legal keystroke, not a value.
		field.oninput(typed('0'));

		expect(field.value).toBe('0');
		expect(commit).not.toHaveBeenCalled();
	});

	it('clamps and normalizes on blur', () => {
		const { field, commit } = setup(5);

		field.oninput(typed('99'));
		field.onblur();

		expect(commit).toHaveBeenLastCalledWith(52);
		expect(field.value).toBe('52');
	});

	it('restores the previous value when an emptied field is blurred', () => {
		const { field, commit } = setup(5);

		field.oninput(typed(''));
		field.onblur();

		expect(commit).toHaveBeenLastCalledWith(5);
		expect(field.value).toBe('5');
	});

	it('settles an emptied field to an explicit empty value', () => {
		const { field, commit } = setup(5, { emptyValue: 0, min: 0 });

		field.oninput(typed(''));
		field.onblur();

		expect(commit).toHaveBeenLastCalledWith(0);
		expect(field.value).toBe('0');
	});

	it('commits the clear immediately on a clearable field', () => {
		const { field, commit } = setup(5, { emptyValue: null });

		field.oninput(typed(''));

		expect(commit).toHaveBeenLastCalledWith(null);
		expect(field.value).toBe('');

		field.onblur();
		expect(commit).toHaveBeenLastCalledWith(null);
		expect(field.value).toBe('');
	});

	it('commits nothing on blur when the field was never edited', () => {
		const { field, commit } = setup(5);

		field.onblur();

		expect(commit).not.toHaveBeenCalled();
	});

	it('follows the committed value again once the edit is settled', () => {
		let committed = 5;
		const field = numericField({
			value: () => committed,
			commit: (next) => (committed = next),
			min: 1,
			max: 52
		});

		field.oninput(typed('7'));
		field.onblur();

		// An update from elsewhere (a parent prop, a reopened dialog) shows through
		// without an $effect re-sync, because the buffer is released on blur.
		committed = 20;
		expect(field.value).toBe('20');
	});
});
