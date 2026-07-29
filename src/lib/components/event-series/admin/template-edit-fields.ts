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

/** The boolean template fields the dialog edits as simple checkboxes. */
export type TemplateFlagKey =
	| 'requires_ticket'
	| 'waitlist_open'
	| 'requires_full_profile'
	| 'potluck_open'
	| 'accept_invitation_requests'
	| 'accept_rsvp_notes'
	| 'public_pronoun_distribution'
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
		}
	];
}

export function buildAttendanceToggles(): TemplateToggleConfig[] {
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
		},
		{
			key: 'public_pronoun_distribution',
			label: m['recurringEvents.templateDialog.toggles.publicPronounDistribution'](),
			testid: 'template-edit-public-pronoun-distribution'
		},
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
