import { z } from 'zod';
import * as m from '$lib/paraglide/messages.js';

/**
 * Base schema for guest user data (email, first_name, last_name). Not itself
 * consumed outside this file (the legacy `GuestTicketDialog` tree that used
 * it directly was deleted in #853 PR4 task 6) — kept unexported as the base
 * `guestEmailOnlySchema` (`.pick`) and `guestRsvpSchema` (`.extend`) build on.
 */
const guestUserSchema = z.object({
	email: z
		.string({ error: m['guest_attendance.validation_email']() })
		.min(1, m['guest_attendance.validation_email']())
		.email(m['guest_attendance.validation_email']()),

	first_name: z
		.string({ error: m['guest_attendance.validation_first_name']() })
		.min(1, m['guest_attendance.validation_first_name']())
		.max(150, m['guest_attendance.validation_first_name']()),

	last_name: z
		.string({ error: m['guest_attendance.validation_last_name']() })
		.min(1, m['guest_attendance.validation_last_name']())
		.max(150, m['guest_attendance.validation_last_name']())
});

/**
 * Email-only variant for events with require_ticket_names disabled — the
 * anonymous buyer provides nothing but a contact address.
 */
export const guestEmailOnlySchema = guestUserSchema.pick({ email: true });

/**
 * Schema for guest RSVP (includes answer: yes/no/maybe)
 */
export const guestRsvpSchema = guestUserSchema.extend({
	answer: z.enum(['yes', 'no', 'maybe'], {
		error: m['guest_attendance.validation_rsvp_answer']()
	})
});

/**
 * Type exports for use in components
 */
export type GuestRsvpData = z.infer<typeof guestRsvpSchema>;
