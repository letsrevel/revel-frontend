/**
 * Status color and label utilities for admin pages.
 * Centralizes status badge styling across events, tickets, and attendees.
 */

import * as m from '$lib/paraglide/messages.js';

// -- Event status --

export function getEventStatusColor(status: string): string {
	switch (status) {
		case 'draft':
			return 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-100';
		case 'open':
			return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-100';
		case 'closed':
			return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-100';
		case 'cancelled':
			return 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-100';
		default:
			return 'bg-gray-100 text-gray-800';
	}
}

// -- Ticket status --

export function getTicketStatusColor(status: string): string {
	switch (status) {
		case 'pending':
			return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-100';
		case 'active':
			return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-100';
		case 'checked_in':
			return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-100';
		case 'cancelled':
			return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-100';
		default:
			return 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-100';
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

export function getRsvpStatusColor(status: string): string {
	switch (status) {
		case 'yes':
			return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-100';
		case 'maybe':
			return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-100';
		case 'no':
			return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-100';
		default:
			return 'bg-gray-100 text-gray-800';
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
