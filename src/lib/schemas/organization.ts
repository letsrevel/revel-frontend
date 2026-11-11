import { z } from 'zod';
import * as m from '$lib/paraglide/messages.js';

/**
 * Organization creation schema matching backend OrganizationCreateSchema
 */
export const organizationCreateSchema = z
	.object({
		name: z.string().default(''),
		contact_email: z.string().default(''),
		city_id: z.string().default(''),
		address: z.string().default(''),
		description: z.string().default('')
	})
	.superRefine((data, ctx) => {
		// Validate name
		if (!data.name || data.name.trim().length === 0) {
			ctx.addIssue({
				code: z.ZodIssueCode.custom,
				message: m['orgCreate.validation.nameRequired'](),
				path: ['name']
			});
		}
		if (data.name.length > 150) {
			ctx.addIssue({
				code: z.ZodIssueCode.custom,
				message: m['orgCreate.validation.nameTooLong'](),
				path: ['name']
			});
		}

		// Validate email
		if (!data.contact_email || data.contact_email.trim().length === 0) {
			ctx.addIssue({
				code: z.ZodIssueCode.custom,
				message: m['orgCreate.validation.emailRequired'](),
				path: ['contact_email']
			});
		} else if (!z.string().email().safeParse(data.contact_email).success) {
			ctx.addIssue({
				code: z.ZodIssueCode.custom,
				message: m['orgCreate.validation.emailInvalid'](),
				path: ['contact_email']
			});
		}
	});

export type OrganizationCreateFormData = z.infer<typeof organizationCreateSchema>;
