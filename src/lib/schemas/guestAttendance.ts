import { z } from 'zod';
import * as m from '$lib/paraglide/messages.js';

/**
 * Base schema for guest user data (email, first_name, last_name)
 * Used for both RSVP and ticket purchases by unauthenticated users
 */
export const guestUserSchema = z.object({
	email: z
		.string({ required_error: m['guest_attendance.validation_email']() })
		.min(1, m['guest_attendance.validation_email']())
		.email(m['guest_attendance.validation_email']()),

	first_name: z
		.string({ required_error: m['guest_attendance.validation_first_name']() })
		.min(1, m['guest_attendance.validation_first_name']())
		.max(150, m['guest_attendance.validation_first_name']()),

	last_name: z
		.string({ required_error: m['guest_attendance.validation_last_name']() })
		.min(1, m['guest_attendance.validation_last_name']())
		.max(150, m['guest_attendance.validation_last_name']())
});

/**
 * Schema for guest RSVP (includes answer: yes/no/maybe)
 */
export const guestRsvpSchema = guestUserSchema.extend({
	answer: z.enum(['yes', 'no', 'maybe'], {
		required_error: m['guest_attendance.validation_rsvp_answer']()
	})
});

/**
 * Factory function to create PWYC (Pay What You Can) schema with dynamic min/max validation
 * @param tier - The tier object containing pwyc_min and pwyc_max
 * @returns Zod schema with dynamic validation based on tier limits
 */
export function createGuestPwycSchema(tier: { pwyc_min: number; pwyc_max?: number | null }) {
	let pwycSchema = z
		.number({ required_error: m['guest_attendance.validation_pwyc_min']({ min: tier.pwyc_min }) })
		.min(tier.pwyc_min, m['guest_attendance.validation_pwyc_min']({ min: tier.pwyc_min }));

	// Add max validation only if tier.pwyc_max is defined
	if (tier.pwyc_max !== null && tier.pwyc_max !== undefined) {
		pwycSchema = pwycSchema.max(
			tier.pwyc_max,
			m['guest_attendance.validation_pwyc_max']({ max: tier.pwyc_max })
		);
	}

	return guestUserSchema.extend({
		pwyc: pwycSchema
	});
}

/**
 * Schema for guest action confirmation (JWT token from email)
 */
export const guestConfirmationSchema = z.object({
	token: z.string().min(1, 'Token is required')
});

/**
 * Type exports for use in components
 */
export type GuestUserData = z.infer<typeof guestUserSchema>;
export type GuestRsvpData = z.infer<typeof guestRsvpSchema>;
export type GuestPwycData =
	ReturnType<typeof createGuestPwycSchema> extends z.ZodType<infer T> ? T : never;
export type GuestConfirmationData = z.infer<typeof guestConfirmationSchema>;
