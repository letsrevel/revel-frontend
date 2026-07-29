/**
 * Granular event visibility settings (backend #825).
 *
 * `visibility_settings` carries three independent disclosure switches. Every
 * one defaults to `true`, and the backend serialises all three on every read,
 * so a resolved value is always fully known once an event has been fetched.
 *
 * ## Write semantics (the part that bites)
 *
 * The backend **merges** this object at sub-key granularity: sending
 * `{"show_capacity": false}` leaves `show_attendee_count` at its stored value
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

import type { EventVisibilitySettings } from '$lib/api/generated/types.gen';

/** The three granular toggles, in the order they are presented to organizers. */
export const VISIBILITY_TOGGLE_KEYS = [
	'show_attendee_count',
	'show_capacity',
	'show_attendee_list'
] as const;

export type VisibilityToggleKey = (typeof VISIBILITY_TOGGLE_KEYS)[number];

/** `EventVisibilitySettings` with every toggle known — no optional members. */
export type ResolvedVisibilitySettings = Record<VisibilityToggleKey, boolean>;

/** Backend defaults: everything disclosed, reproducing pre-#825 behaviour. */
export const VISIBILITY_DEFAULTS: ResolvedVisibilitySettings = {
	show_attendee_count: true,
	show_capacity: true,
	show_attendee_list: true
};

/** Frontend-only preset shortcuts. Each is just a set of the three toggles. */
export type VisibilityPresetId = 'open' | 'discreet';

export const VISIBILITY_PRESETS: Record<VisibilityPresetId, ResolvedVisibilitySettings> = {
	open: { show_attendee_count: true, show_capacity: true, show_attendee_list: true },
	discreet: { show_attendee_count: false, show_capacity: false, show_attendee_list: false }
};

export const VISIBILITY_PRESET_IDS = ['open', 'discreet'] as const satisfies readonly [
	VisibilityPresetId,
	VisibilityPresetId
];

/**
 * Fill in any absent toggle with its backend default.
 *
 * Reads always carry all three, so this only matters for form state that has
 * not been seeded yet (create flows) — never for a fetched event.
 */
export function resolveVisibilitySettings(
	settings: EventVisibilitySettings | null | undefined
): ResolvedVisibilitySettings {
	return {
		show_attendee_count: settings?.show_attendee_count ?? VISIBILITY_DEFAULTS.show_attendee_count,
		show_capacity: settings?.show_capacity ?? VISIBILITY_DEFAULTS.show_capacity,
		show_attendee_list: settings?.show_attendee_list ?? VISIBILITY_DEFAULTS.show_attendee_list
	};
}

/**
 * Which preset (if any) the current toggles correspond to.
 *
 * `null` means "custom" — a combination no preset expresses. Presets are a
 * shortcut, not a mode: nothing downstream branches on the answer.
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

/** True when the toggles differ from the backend defaults in any way. */
export function isNonDefaultVisibility(
	settings: EventVisibilitySettings | null | undefined
): boolean {
	const resolved = resolveVisibilitySettings(settings);
	return VISIBILITY_TOGGLE_KEYS.some((key) => resolved[key] !== VISIBILITY_DEFAULTS[key]);
}

/**
 * The minimal patch that moves `original` to `next`.
 *
 * Returns only the sub-keys that actually changed, which is exactly what the
 * backend's merge semantics reward: an omitted toggle means "no change". An
 * empty object means nothing changed and the caller should omit the field.
 */
export function diffVisibilitySettings(
	original: EventVisibilitySettings | null | undefined,
	next: EventVisibilitySettings | null | undefined
): EventVisibilitySettings {
	const before = resolveVisibilitySettings(original);
	const after = resolveVisibilitySettings(next);
	const patch: EventVisibilitySettings = {};
	for (const key of VISIBILITY_TOGGLE_KEYS) {
		if (before[key] !== after[key]) patch[key] = after[key];
	}
	return patch;
}
