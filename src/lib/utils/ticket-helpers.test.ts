import { describe, it, expect } from 'vitest';
import { getGuestNameIfDifferent } from './ticket-helpers';

function ticket(guestName: string | null | undefined, user: Record<string, unknown> = {}) {
	return {
		guest_name: guestName,
		user: { first_name: 'Ann', last_name: 'Attendee', ...user }
	};
}

describe('getGuestNameIfDifferent', () => {
	it('returns the holder name when it differs from the purchaser', () => {
		expect(getGuestNameIfDifferent(ticket('Bob Bearer'))).toBe('Bob Bearer');
	});

	it('hides the holder name when it matches the purchaser (case/space-insensitive)', () => {
		expect(getGuestNameIfDifferent(ticket('  ann ATTENDEE '))).toBeNull();
	});

	it('returns null for a nameless ticket', () => {
		expect(getGuestNameIfDifferent(ticket(null))).toBeNull();
		expect(getGuestNameIfDifferent(ticket(undefined))).toBeNull();
		expect(getGuestNameIfDifferent(ticket(''))).toBeNull();
	});

	it('treats a whitespace-only name as nameless', () => {
		expect(getGuestNameIfDifferent(ticket('   '))).toBeNull();
	});

	it('returns the trimmed holder name', () => {
		expect(getGuestNameIfDifferent(ticket('  Bob Bearer  '))).toBe('Bob Bearer');
	});
});
