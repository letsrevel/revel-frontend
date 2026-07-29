import { describe, it, expect } from 'vitest';
import {
	VISIBILITY_DEFAULTS,
	VISIBILITY_PRESETS,
	diffVisibilitySettings,
	isNonDefaultVisibility,
	matchVisibilityPreset,
	resolveVisibilitySettings,
	resolveViewerVisibility
} from './event-visibility';

describe('resolveVisibilitySettings', () => {
	it('fills every absent toggle with the backend default (disclosed)', () => {
		expect(resolveVisibilitySettings(undefined)).toEqual(VISIBILITY_DEFAULTS);
		expect(resolveVisibilitySettings(null)).toEqual(VISIBILITY_DEFAULTS);
		expect(resolveVisibilitySettings({})).toEqual(VISIBILITY_DEFAULTS);
	});

	it('keeps explicit values and only defaults the absent ones', () => {
		expect(resolveVisibilitySettings({ show_capacity: false })).toEqual({
			show_attendee_count: true,
			show_capacity: false,
			show_attendee_list: true
		});
	});
});

describe('matchVisibilityPreset', () => {
	it('recognises the two presets', () => {
		expect(matchVisibilityPreset(VISIBILITY_PRESETS.open)).toBe('open');
		expect(matchVisibilityPreset(VISIBILITY_PRESETS.discreet)).toBe('discreet');
	});

	it('treats the backend default as the "open" preset', () => {
		expect(matchVisibilityPreset(undefined)).toBe('open');
	});

	it('returns null (custom) for a mixed combination', () => {
		expect(
			matchVisibilityPreset({
				show_attendee_count: true,
				show_capacity: false,
				show_attendee_list: true
			})
		).toBeNull();
	});
});

// Owners and staff bypass visibility_settings server-side (#825): the API hands
// them the real numbers and the real guest list. Any UI that branches on the
// toggles must not re-impose the public gate on them.
describe('resolveViewerVisibility', () => {
	const discreet = { show_attendee_count: false, show_capacity: false, show_attendee_list: false };

	it('discloses everything to an owner regardless of the settings', () => {
		expect(resolveViewerVisibility(discreet, { isOwner: true, isStaff: false })).toEqual(
			VISIBILITY_DEFAULTS
		);
	});

	it('discloses everything to staff regardless of the settings', () => {
		expect(resolveViewerVisibility(discreet, { isOwner: false, isStaff: true })).toEqual(
			VISIBILITY_DEFAULTS
		);
	});

	it('applies the public settings to everyone else', () => {
		expect(resolveViewerVisibility(discreet, { isOwner: false, isStaff: false })).toEqual(discreet);
	});

	it('treats absent viewer flags as a plain guest', () => {
		expect(resolveViewerVisibility(discreet, {})).toEqual(discreet);
		expect(resolveViewerVisibility(discreet, { isOwner: null, isStaff: null })).toEqual(discreet);
	});
});

describe('isNonDefaultVisibility', () => {
	it('is false for the defaults', () => {
		expect(isNonDefaultVisibility(undefined)).toBe(false);
		expect(isNonDefaultVisibility(VISIBILITY_PRESETS.open)).toBe(false);
	});

	it('is true as soon as one toggle is off', () => {
		expect(isNonDefaultVisibility({ show_attendee_list: false })).toBe(true);
	});
});

describe('diffVisibilitySettings', () => {
	// The backend merges this object sub-key by sub-key: an omitted toggle means
	// "no change". A minimal patch is therefore both correct and the lightest
	// option — and critically, it never restates a toggle the user did not touch.
	it('returns only the toggles that changed', () => {
		const patch = diffVisibilitySettings(
			{ show_attendee_count: false, show_capacity: true, show_attendee_list: true },
			{ show_attendee_count: false, show_capacity: false, show_attendee_list: true }
		);
		expect(patch).toEqual({ show_capacity: false });
	});

	it('returns an empty object when nothing changed', () => {
		expect(
			diffVisibilitySettings(VISIBILITY_PRESETS.discreet, VISIBILITY_PRESETS.discreet)
		).toEqual({});
	});

	it('can re-enable a disclosure by naming it explicitly', () => {
		const patch = diffVisibilitySettings(VISIBILITY_PRESETS.discreet, VISIBILITY_PRESETS.open);
		expect(patch).toEqual({
			show_attendee_count: true,
			show_capacity: true,
			show_attendee_list: true
		});
	});

	it('treats an absent original as the all-disclosed default', () => {
		expect(diffVisibilitySettings(undefined, { show_capacity: false })).toEqual({
			show_capacity: false
		});
	});

	it('never emits null for any toggle', () => {
		const patch = diffVisibilitySettings(VISIBILITY_PRESETS.open, VISIBILITY_PRESETS.discreet);
		for (const value of Object.values(patch)) {
			expect(typeof value).toBe('boolean');
		}
	});
});
