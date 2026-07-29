/**
 * Granular event visibility settings (backend #825, #793).
 *
 * `visibility_settings` carries five disclosure switches:
 *
 * - `show_attendee_count`, `show_capacity`, `show_attendee_list` — three
 *   boolean toggles, all defaulting to `true`, editable together via the
 *   preset UI (`VISIBILITY_PRESETS`) or individually.
 * - `show_pronoun_distribution` — a boolean defaulting to `false` (opt-in,
 *   unlike the other three). Edited elsewhere in the event form, not via the
 *   preset UI.
 * - `address_visibility` — a `ResourceVisibility` enum (not boolean),
 *   defaulting to `'public'`, selecting *who* may see the address rather than
 *   whether it is shown at all. Also edited outside the preset UI.
 *
 * The backend serialises all five on every read, so a resolved value is
 * always fully known once an event has been fetched.
 *
 * ## Write semantics (the part that bites)
 *
 * The backend **merges** this object at sub-key granularity: sending
 * `{"show_capacity": false}` leaves every other key at its stored value
 * rather than resetting it to the schema default. Partial writes and whole-
 * object round-trips are therefore both safe. (The first backend implementation
 * replaced the whole blob, which silently re-disclosed a count the organizer
 * had hidden whenever an unrelated toggle was edited.)
 *
 * Two asymmetries this module exists to keep straight:
 *
 * - `extra="forbid"` — unknown keys are rejected with a 422. Preset shortcuts
 *   are a frontend-only affordance: they set the three granular toggles and a
 *   preset name is never sent to the backend.
 * - Explicit `null` differs by schema. `EventEditSchema` declares the field
 *   non-nullable, so `null` is a 422; `TemplateEditSchema` declares it
 *   `| None` and reads `null` as "no change". Nothing here ever emits `null` —
 *   writers either send a concrete object or omit the key entirely, which is
 *   valid against both schemas.
 */

import type { EventVisibilitySettings, ResourceVisibility } from '$lib/api/generated/types.gen';

/** The three preset-editable toggles, in the order they are presented to organizers. */
export const VISIBILITY_TOGGLE_KEYS = [
	'show_attendee_count',
	'show_capacity',
	'show_attendee_list'
] as const;

export type VisibilityToggleKey = (typeof VISIBILITY_TOGGLE_KEYS)[number];

/** The three preset-editable toggles, with every one known — no optional members. */
export type ResolvedVisibilityToggles = Record<VisibilityToggleKey, boolean>;

/**
 * `EventVisibilitySettings` with all five keys known — no optional members.
 * The two keys beyond `ResolvedVisibilityToggles` (`show_pronoun_distribution`,
 * `address_visibility`) are edited outside the preset UI (see module docstring).
 */
export type ResolvedVisibilitySettings = ResolvedVisibilityToggles & {
	show_pronoun_distribution: boolean;
	address_visibility: ResourceVisibility;
};

/** Backend defaults: reproducing pre-#825/#793 behaviour for every key. */
export const VISIBILITY_DEFAULTS: ResolvedVisibilitySettings = {
	show_attendee_count: true,
	show_capacity: true,
	show_attendee_list: true,
	show_pronoun_distribution: false,
	address_visibility: 'public'
};

/** Frontend-only preset shortcuts. Each is just a set of the three toggles. */
export type VisibilityPresetId = 'open' | 'discreet';

export const VISIBILITY_PRESETS: Record<VisibilityPresetId, ResolvedVisibilityToggles> = {
	open: { show_attendee_count: true, show_capacity: true, show_attendee_list: true },
	discreet: { show_attendee_count: false, show_capacity: false, show_attendee_list: false }
};

/** Presentation order of the preset buttons. */
export const VISIBILITY_PRESET_IDS: readonly VisibilityPresetId[] = ['open', 'discreet'];

/**
 * What an organization owner or staff member sees, as opposed to what the
 * event discloses publicly.
 *
 * This is deliberately *not* `VISIBILITY_DEFAULTS`: `show_pronoun_distribution`
 * defaults to `false` (opt-in, per event), but a privileged viewer sees the
 * distribution unconditionally — the backend serves it to owners/staff
 * regardless of the toggle. Reusing `VISIBILITY_DEFAULTS` here would hide the
 * distribution from an organizer whenever the organizer themselves left it
 * off, which contradicts what the API actually returns them.
 */
export const VISIBILITY_PRIVILEGED: ResolvedVisibilitySettings = {
	show_attendee_count: true,
	show_capacity: true,
	show_attendee_list: true,
	show_pronoun_distribution: true,
	address_visibility: 'public'
};

/**
 * Fill in any absent key with its backend default.
 *
 * Reads always carry all five, so this only matters for form state that has
 * not been seeded yet (create flows) — never for a fetched event.
 */
export function resolveVisibilitySettings(
	settings: EventVisibilitySettings | null | undefined
): ResolvedVisibilitySettings {
	return {
		show_attendee_count: settings?.show_attendee_count ?? VISIBILITY_DEFAULTS.show_attendee_count,
		show_capacity: settings?.show_capacity ?? VISIBILITY_DEFAULTS.show_capacity,
		show_attendee_list: settings?.show_attendee_list ?? VISIBILITY_DEFAULTS.show_attendee_list,
		show_pronoun_distribution:
			settings?.show_pronoun_distribution ?? VISIBILITY_DEFAULTS.show_pronoun_distribution,
		address_visibility: settings?.address_visibility ?? VISIBILITY_DEFAULTS.address_visibility
	};
}

/**
 * Which preset (if any) the current toggles correspond to.
 *
 * `null` means "custom" — a combination no preset expresses. Presets are a
 * shortcut, not a mode: nothing downstream branches on the answer.
 *
 * Deliberately iterates `VISIBILITY_TOGGLE_KEYS` only — presets are a
 * frontend affordance over the three preset-editable toggles, and ignore
 * `show_pronoun_distribution` / `address_visibility` entirely, however those
 * two are set.
 */
export function matchVisibilityPreset(
	settings: EventVisibilitySettings | null | undefined
): VisibilityPresetId | null {
	const resolved = resolveVisibilitySettings(settings);
	for (const id of VISIBILITY_PRESET_IDS) {
		const preset = VISIBILITY_PRESETS[id];
		if (VISIBILITY_TOGGLE_KEYS.every((key) => resolved[key] === preset[key])) return id;
	}
	return null;
}

/**
 * True when the toggles differ from the backend defaults in any way.
 *
 * Deliberately iterates `VISIBILITY_TOGGLE_KEYS` only, for the same reason as
 * `matchVisibilityPreset` — this drives the "non-default" badge on the preset
 * UI, not the other two keys.
 */
export function isNonDefaultVisibility(
	settings: EventVisibilitySettings | null | undefined
): boolean {
	const resolved = resolveVisibilitySettings(settings);
	return VISIBILITY_TOGGLE_KEYS.some((key) => resolved[key] !== VISIBILITY_DEFAULTS[key]);
}

/**
 * What *this viewer* may see, as opposed to what the event discloses publicly.
 *
 * Organization owners and staff bypass `visibility_settings` entirely on the
 * backend: the API serves them the real counts, the real capacity, the real
 * guest list, the real pronoun distribution, and the real address no matter
 * what the settings say. Gating their UI on the public settings would hide an
 * organizer's own event data from them — the numeric surfaces get this for
 * free (the numbers simply arrive non-null), but anything that branches on
 * the settings themselves has to ask this instead.
 */
export function resolveViewerVisibility(
	settings: EventVisibilitySettings | null | undefined,
	viewer: { isOwner?: boolean | null; isStaff?: boolean | null }
): ResolvedVisibilitySettings {
	if (viewer.isOwner || viewer.isStaff) return { ...VISIBILITY_PRIVILEGED };
	return resolveVisibilitySettings(settings);
}

/**
 * The minimal patch that moves `original` to `next`.
 *
 * Returns only the sub-keys that actually changed, which is exactly what the
 * backend's merge semantics reward: an omitted key means "no change". An
 * empty object means nothing changed and the caller should omit the field.
 *
 * Diffs all five keys — unlike `matchVisibilityPreset` /
 * `isNonDefaultVisibility`, this has to capture edits to
 * `show_pronoun_distribution` and `address_visibility` too, since those are
 * real settings a caller may have changed even though no preset represents
 * them.
 */
export function diffVisibilitySettings(
	original: EventVisibilitySettings | null | undefined,
	next: EventVisibilitySettings | null | undefined
): EventVisibilitySettings {
	const before = resolveVisibilitySettings(original);
	const after = resolveVisibilitySettings(next);
	const patch: EventVisibilitySettings = {};
	if (before.show_attendee_count !== after.show_attendee_count) {
		patch.show_attendee_count = after.show_attendee_count;
	}
	if (before.show_capacity !== after.show_capacity) {
		patch.show_capacity = after.show_capacity;
	}
	if (before.show_attendee_list !== after.show_attendee_list) {
		patch.show_attendee_list = after.show_attendee_list;
	}
	if (before.show_pronoun_distribution !== after.show_pronoun_distribution) {
		patch.show_pronoun_distribution = after.show_pronoun_distribution;
	}
	if (before.address_visibility !== after.address_visibility) {
		patch.address_visibility = after.address_visibility;
	}
	return patch;
}
