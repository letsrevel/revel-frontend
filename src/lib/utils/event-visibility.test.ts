import { describe, it, expect } from 'vitest';
import {
	VISIBILITY_DEFAULTS,
	VISIBILITY_PRESETS,
	VISIBILITY_PRIVILEGED,
	diffVisibilitySettings,
	isNonDefaultVisibility,
	matchVisibilityPreset,
	resolveVisibilitySettings,
	resolveViewerVisibility
} from './event-visibility';

describe('resolveVisibilitySettings', () => {
	it('fills every absent key with the backend default', () => {
		expect(resolveVisibilitySettings(undefined)).toEqual(VISIBILITY_DEFAULTS);
		expect(resolveVisibilitySettings(null)).toEqual(VISIBILITY_DEFAULTS);
		expect(resolveVisibilitySettings({})).toEqual(VISIBILITY_DEFAULTS);
	});

	it('keeps explicit values and only defaults the absent ones', () => {
		expect(resolveVisibilitySettings({ show_capacity: false })).toEqual({
			show_attendee_count: true,
			show_capacity: false,
			show_attendee_list: true,
			show_pronoun_distribution: false,
			address_visibility: 'public'
		});
	});

	it('fills address_visibility and show_pronoun_distribution when absent', () => {
		const resolved = resolveVisibilitySettings({});
		expect(resolved.address_visibility).toBe('public');
		expect(resolved.show_pronoun_distribution).toBe(false);
	});

	it('preserves explicit address_visibility and show_pronoun_distribution', () => {
		const resolved = resolveVisibilitySettings({
			address_visibility: 'members-only',
			show_pronoun_distribution: true
		});
		expect(resolved.address_visibility).toBe('members-only');
		expect(resolved.show_pronoun_distribution).toBe(true);
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

	// Presets are a shortcut over the three preset-editable toggles only —
	// address_visibility and show_pronoun_distribution are edited elsewhere
	// and must not affect which preset (if any) matches.
	it('still matches open/discreet when the two non-preset keys are non-default', () => {
		expect(
			matchVisibilityPreset({
				...VISIBILITY_PRESETS.open,
				address_visibility: 'members-only',
				show_pronoun_distribution: true
			})
		).toBe('open');
		expect(
			matchVisibilityPreset({
				...VISIBILITY_PRESETS.discreet,
				address_visibility: 'private',
				show_pronoun_distribution: true
			})
		).toBe('discreet');
	});
});

// Owners and staff bypass visibility_settings server-side (#825): the API hands
// them the real numbers and the real guest list. Any UI that branches on the
// toggles must not re-impose the public gate on them.
describe('resolveViewerVisibility', () => {
	const discreet = {
		show_attendee_count: false,
		show_capacity: false,
		show_attendee_list: false,
		show_pronoun_distribution: false,
		address_visibility: 'private' as const
	};

	it('discloses everything to an owner regardless of the settings', () => {
		expect(resolveViewerVisibility(discreet, { isOwner: true, isStaff: false })).toEqual(
			VISIBILITY_PRIVILEGED
		);
	});

	it('discloses everything to staff regardless of the settings', () => {
		expect(resolveViewerVisibility(discreet, { isOwner: false, isStaff: true })).toEqual(
			VISIBILITY_PRIVILEGED
		);
	});

	it('applies the public settings to everyone else', () => {
		expect(resolveViewerVisibility(discreet, { isOwner: false, isStaff: false })).toEqual(discreet);
	});

	it('treats absent viewer flags as a plain guest', () => {
		expect(resolveViewerVisibility(discreet, {})).toEqual(discreet);
		expect(resolveViewerVisibility(discreet, { isOwner: null, isStaff: null })).toEqual(discreet);
	});

	// The pronoun distribution defaults to opt-in `false`, but a privileged
	// viewer always sees it — the backend serves it to them regardless of the
	// event's own toggle.
	it('gives an owner show_pronoun_distribution: true even when the event has it false', () => {
		const settings = { ...VISIBILITY_DEFAULTS, show_pronoun_distribution: false };
		expect(
			resolveViewerVisibility(settings, { isOwner: true, isStaff: false }).show_pronoun_distribution
		).toBe(true);
	});

	it('gives a plain viewer show_pronoun_distribution: false when the event has it false', () => {
		const settings = { ...VISIBILITY_DEFAULTS, show_pronoun_distribution: false };
		expect(
			resolveViewerVisibility(settings, { isOwner: false, isStaff: false })
				.show_pronoun_distribution
		).toBe(false);
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
	// The backend merges this object sub-key by sub-key: an omitted key means
	// "no change". A minimal patch is therefore both correct and the lightest
	// option — and critically, it never restates a key the user did not touch.
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

	it('never emits null for any key', () => {
		const patch = diffVisibilitySettings(VISIBILITY_PRESETS.open, VISIBILITY_PRESETS.discreet);
		for (const value of Object.values(patch)) {
			expect(value).not.toBeNull();
			expect(value).not.toBeUndefined();
		}
	});

	it('detects an address_visibility change', () => {
		const patch = diffVisibilitySettings(
			{ address_visibility: 'public' },
			{ address_visibility: 'members-only' }
		);
		expect(patch).toEqual({ address_visibility: 'members-only' });
	});

	it('detects a show_pronoun_distribution change', () => {
		const patch = diffVisibilitySettings(
			{ show_pronoun_distribution: false },
			{ show_pronoun_distribution: true }
		);
		expect(patch).toEqual({ show_pronoun_distribution: true });
	});

	it('returns {} for an identical pair covering all five keys', () => {
		const settings = {
			show_attendee_count: false,
			show_capacity: true,
			show_attendee_list: false,
			show_pronoun_distribution: true,
			address_visibility: 'staff-only' as const
		};
		expect(diffVisibilitySettings(settings, { ...settings })).toEqual({});
	});
});
