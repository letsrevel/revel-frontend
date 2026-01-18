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
	first_name: z
		.string()
		.min(1, 'First name is required')
		.max(30, 'First name must be 30 characters or less'),
	last_name: z
		.string()
		.min(1, 'Last name is required')
		.max(150, 'Last name must be 150 characters or less'),
	preferred_name: z.string().max(255, 'Preferred name must be 255 characters or less'),
	pronouns: z.string().max(10, 'Pronouns must be 10 characters or less'),
	language: z.enum(['en', 'de', 'it']),
	bio: z.string().max(500, 'Bio must be 500 characters or less').optional().default('')
});

export type ProfileUpdateFormData = z.infer<typeof profileUpdateSchema>;
