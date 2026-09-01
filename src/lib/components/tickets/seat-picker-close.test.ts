import { describe, it, expect } from 'vitest';
import { seatPickerCloseAction } from './seat-picker-close';

describe('seatPickerCloseAction', () => {
	it('does nothing after a Done hand-off — the cart owns the seats', () => {
		expect(
			seatPickerCloseAction({ handedOff: true, wasEditSession: true, seeded: true, holdCount: 3 })
		).toBe('none');
	});

	it('an edit-session close after seeding writes the holds back to the group', () => {
		expect(
			seatPickerCloseAction({ handedOff: false, wasEditSession: true, seeded: true, holdCount: 2 })
		).toBe('write-holds');
	});

	it('an edit-session close BEFORE seeding leaves the existing group untouched (#863 review)', () => {
		// The transient controller holds nothing yet; writing its empty list
		// would delete the buyer's prior selection on a quick Escape.
		expect(
			seatPickerCloseAction({ handedOff: false, wasEditSession: true, seeded: false, holdCount: 0 })
		).toBe('none');
	});

	it('abandoning a first pick releases whatever is still held', () => {
		expect(
			seatPickerCloseAction({ handedOff: false, wasEditSession: false, seeded: true, holdCount: 2 })
		).toBe('release');
	});

	it('abandoning a first pick with nothing held is a no-op', () => {
		expect(
			seatPickerCloseAction({ handedOff: false, wasEditSession: false, seeded: true, holdCount: 0 })
		).toBe('none');
	});
});
