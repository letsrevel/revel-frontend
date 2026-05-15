import { z } from 'zod';

/**
 * Common pronoun options for dropdown
 */
export const COMMON_PRONOUNS = [
	'she/her',
	'he/him',
	'they/them',
	'she/they',
	'he/they',
	'custom'
] as const;

/**
 * Profile update schema matching backend ProfileUpdateSchema
 */
export const profileUpdateSchema = z.object({
	first_name: z.string().max(30, 'First name must be 30 characters or less').default(''),
	last_name: z.string().max(150, 'Last name must be 150 characters or less').default(''),
	preferred_name: z
		.string()
		.max(255, 'Preferred name must be 255 characters or less')
		.default(''),
	pronouns: z.string().max(10, 'Pronouns must be 10 characters or less'),
	language: z.enum(['en', 'de', 'it']),
	bio: z.string().max(500, 'Bio must be 500 characters or less').optional().default('')
});

export type ProfileUpdateFormData = z.infer<typeof profileUpdateSchema>;
