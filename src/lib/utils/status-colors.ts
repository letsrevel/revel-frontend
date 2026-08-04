/**
 * Status tone and label utilities for admin pages.
 * Centralizes status -> tone mapping across events, tickets, and
 * attendees — every call site renders through `common/StatusBadge`, so
 * these return a semantic `Tone`, never a raw color class.
 */

import * as m from '$lib/paraglide/messages.js';
import type { Tone } from '$lib/components/common/tones';

// -- Event status --

export function getEventStatusTone(status: string): Tone {
	switch (status) {
		case 'draft':
			return 'neutral';
		case 'open':
			return 'success';
		case 'closed':
			return 'danger';
		case 'cancelled':
			return 'warning';
		default:
			return 'neutral';
	}
}

// -- Ticket status --

export function getTicketStatusTone(status: string): Tone {
	switch (status) {
		case 'pending':
			return 'warning';
		case 'active':
			return 'success';
		case 'checked_in':
			return 'info';
		case 'cancelled':
			return 'danger';
		default:
			return 'neutral';
	}
}

export function getTicketStatusLabel(status: string): string {
	switch (status) {
		case 'pending':
			return m['eventTicketsAdmin.statusPending']();
		case 'active':
			return m['eventTicketsAdmin.statusActive']();
		case 'checked_in':
			return m['eventTicketsAdmin.statusCheckedIn']();
		case 'cancelled':
			return m['eventTicketsAdmin.statusCancelled']();
		default:
			return status;
	}
}

// -- RSVP status --

export function getRsvpStatusTone(status: string): Tone {
	switch (status) {
		case 'yes':
			return 'success';
		case 'maybe':
			return 'warning';
		case 'no':
			return 'danger';
		default:
			return 'neutral';
	}
}

export function getRsvpStatusLabel(status: string): string {
	switch (status) {
		case 'yes':
			return m['attendeesAdmin.statusLabelYes']();
		case 'maybe':
			return m['attendeesAdmin.statusLabelMaybe']();
		case 'no':
			return m['attendeesAdmin.statusLabelNo']();
		default:
			return status;
	}
}
