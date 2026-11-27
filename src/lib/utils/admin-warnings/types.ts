/**
 * Admin setting warnings (#1314): settings the backend accepts but that are
 * probably unwanted, because attendees then hit a 404, a dead end or a ticket
 * they cannot buy.
 *
 * Rules are pure functions (see `event.ts`, `tier.ts`) that return
 * `AdminWarning`s. They know nothing about the DOM: the CALLER component adds
 * `fixTarget` / `fixLabel` / `action` with `withFix` / `withAction`, because
 * only the caller knows which field is mounted in this mode.
 *
 * - `warn`: amber, never dismissible.
 * - `info`: neutral, dismissible per browser (see `dismissed.svelte.ts`) when
 *   the entity is saved.
 */
export type AdminWarningLevel = 'warn' | 'info';

export interface AdminWarningAction {
	label: () => string;
	run: () => void | Promise<void>;
}

export interface AdminWarning {
	/** Stable rule id (e.g. `B1`, `C2-rsvp-ticketed`). Part of the dismissal key. */
	id: string;
	level: AdminWarningLevel;
	/** Short title; also names the dismiss button ("Dismiss: <title>"). */
	title: () => string;
	/** One or two short sentences about what attendees experience. */
	message: () => string;
	/** Element id of the field that fixes it. Set by the caller, never by a rule. */
	fixTarget?: string;
	fixLabel?: () => string;
	/** An in-place fix (e.g. "Clear deadline"). Set by the caller. */
	action?: AdminWarningAction;
}

/** Returns a copy of `warning` with a fix link to the element `target`. */
export function withFix(warning: AdminWarning, target: string, label: () => string): AdminWarning {
	return { ...warning, fixTarget: target, fixLabel: label };
}

/** Returns a copy of `warning` with an in-place fix button. */
export function withAction(warning: AdminWarning, action: AdminWarningAction): AdminWarning {
	return { ...warning, action };
}

/** Drops the `null`s that rules return when they do not fire. */
export function compactWarnings(
	list: ReadonlyArray<AdminWarning | null | undefined>
): AdminWarning[] {
	return list.filter((w): w is AdminWarning => w != null);
}
