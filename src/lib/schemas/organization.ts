import { z } from 'zod';

/**
 * Organization creation schema matching backend OrganizationCreateSchema
 */
export const organizationCreateSchema = z.object({
	name: z.string().default(''),
	contact_email: z.string().default(''),
	city_id: z.string().default(''),
	address: z.string().default(''),
	description: z.string().default('')
}).superRefine((data, ctx) => {
	// Validate name
	if (!data.name || data.name.trim().length === 0) {
		ctx.addIssue({
			code: z.ZodIssueCode.custom,
			message: 'Organization name is required',
			path: ['name']
		});
	}
	if (data.name.length > 150) {
		ctx.addIssue({
			code: z.ZodIssueCode.custom,
			message: 'Organization name must be 150 characters or less',
			path: ['name']
		});
	}

	// Validate email
	if (!data.contact_email || data.contact_email.trim().length === 0) {
		ctx.addIssue({
			code: z.ZodIssueCode.custom,
			message: 'Contact email is required',
			path: ['contact_email']
		});
	} else if (!z.string().email().safeParse(data.contact_email).success) {
		ctx.addIssue({
			code: z.ZodIssueCode.custom,
			message: 'Valid email address is required',
			path: ['contact_email']
		});
	}
});

export type OrganizationCreateFormData = z.infer<typeof organizationCreateSchema>;
