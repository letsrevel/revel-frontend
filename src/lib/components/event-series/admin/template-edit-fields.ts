/**
 * Config for TemplateEditDialog's repetitive form rows.
 *
 * These lists drive near-identical markup blocks from data instead of
 * duplicating them, and live here rather than in the component so the dialog
 * stays under the file-length cap.
 *
 * Each is a *factory*, not a module-level constant: the labels are Paraglide
 * message calls, and evaluating them once at module-eval time would freeze the
 * copy at whichever locale happened to import the module first. Callers invoke
 * them inside `$derived` so the labels track the active locale. (Today that is
 * belt-and-braces — `setLocale()` reloads the page — but neither the freeze nor
 * the reload is a contract worth depending on.)
 */

import * as m from '$lib/paraglide/messages.js';
import type { PropagateScope } from '$lib/api/generated/types.gen';

/**
 * The boolean template fields the dialog edits as simple checkboxes.
 *
 * `public_pronoun_distribution` is deliberately absent: backend #793 moved it
 * into the nested `visibility_settings.show_pronoun_distribution` (renamed),
 * so it's no longer a flat field and doesn't fit this record-of-booleans
 * shape. It's edited directly against the dialog's `visibilitySettings`
 * state, hand-rendered rather than driven by a config entry here — see
 * `buildAttendanceTogglesBeforePronoun`/`buildAttendanceTogglesAfterPronoun`
 * below, which flank the hand-written checkbox to keep it in its original
 * position in the Attendance section.
 */
export type TemplateFlagKey =
	| 'requires_ticket'
	| 'waitlist_open'
	| 'require_ticket_names'
	| 'requires_full_profile'
	| 'potluck_open'
	| 'accept_invitation_requests'
	| 'accept_rsvp_notes'
	| 'can_attend_without_login'
	| 'is_open_ended';

export interface TemplateToggleConfig {
	key: TemplateFlagKey;
	label: string;
	testid: string;
}

export interface PropagateOption {
	scope: PropagateScope;
	title: string;
	body: string;
	testid: string;
	destructive: boolean;
	recommended: boolean;
}

export function buildCapacityToggles(): TemplateToggleConfig[] {
	return [
		{
			key: 'requires_ticket',
			label: m['recurringEvents.templateDialog.toggles.requiresTicket'](),
			testid: 'template-edit-requires-ticket'
		},
		{
			key: 'waitlist_open',
			label: m['recurringEvents.templateDialog.toggles.waitlistOpen'](),
			testid: 'template-edit-waitlist-open'
		},
		{
			key: 'require_ticket_names',
			label: m['recurringEvents.templateDialog.toggles.requireTicketNames'](),
			testid: 'template-edit-require-ticket-names'
		}
	];
}

/**
 * Attendance toggles that render before the hand-written pronoun-distribution
 * checkbox (see `TemplateFlagKey` docstring). Split from
 * `buildAttendanceTogglesAfterPronoun` purely to preserve that checkbox's
 * original position in the Attendance section without index-slicing a single
 * array in the template.
 */
export function buildAttendanceTogglesBeforePronoun(): TemplateToggleConfig[] {
	return [
		{
			key: 'requires_full_profile',
			label: m['recurringEvents.templateDialog.toggles.requiresFullProfile'](),
			testid: 'template-edit-requires-full-profile'
		},
		{
			key: 'potluck_open',
			label: m['recurringEvents.templateDialog.toggles.potluckOpen'](),
			testid: 'template-edit-potluck-open'
		},
		{
			key: 'accept_invitation_requests',
			label: m['recurringEvents.templateDialog.toggles.acceptInvitationRequests'](),
			testid: 'template-edit-accept-invitation-requests'
		},
		{
			key: 'accept_rsvp_notes',
			label: m['recurringEvents.templateDialog.toggles.acceptRsvpNotes'](),
			testid: 'template-edit-accept-rsvp-notes'
		}
	];
}

/** Attendance toggles that render after the pronoun-distribution checkbox. */
export function buildAttendanceTogglesAfterPronoun(): TemplateToggleConfig[] {
	return [
		{
			key: 'can_attend_without_login',
			label: m['recurringEvents.templateDialog.toggles.canAttendWithoutLogin'](),
			testid: 'template-edit-can-attend-without-login'
		},
		{
			key: 'is_open_ended',
			label: m['recurringEvents.templateDialog.toggles.openEnded'](),
			testid: 'template-edit-open-ended'
		}
	];
}

export function buildPropagateOptions(): PropagateOption[] {
	return [
		{
			scope: 'none',
			title: m['recurringEvents.templateDialog.propagate.none.title'](),
			body: m['recurringEvents.templateDialog.propagate.none.body'](),
			testid: 'template-edit-propagate-none',
			destructive: false,
			recommended: false
		},
		{
			scope: 'future_unmodified',
			title: m['recurringEvents.templateDialog.propagate.futureUnmodified.title'](),
			body: m['recurringEvents.templateDialog.propagate.futureUnmodified.body'](),
			testid: 'template-edit-propagate-future-unmodified',
			destructive: false,
			recommended: true
		},
		{
			scope: 'all_future',
			title: m['recurringEvents.templateDialog.propagate.allFuture.title'](),
			body: m['recurringEvents.templateDialog.propagate.allFuture.body'](),
			testid: 'template-edit-propagate-all-future',
			destructive: true,
			recommended: false
		}
	];
}
