import * as m from '$lib/paraglide/messages.js';
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
 * The interface languages a user can choose, mirroring the backend's
 * `accounts.SupportedLanguage`.
 *
 * Single source for every language control. This list used to be spelled out
 * inline in the profile page, the language switcher and the auth store, and they
 * drifted: French shipped without ever being added to the profile dropdown.
 * Order is display order.
 */
export const SUPPORTED_LANGUAGES = ['en', 'de', 'it', 'fr', 'es', 'pt'] as const;
export type SupportedLanguage = (typeof SUPPORTED_LANGUAGES)[number];

/**
 * Profile update schema matching backend ProfileUpdateSchema
 */
export const profileUpdateSchema = z.object({
	first_name: z
		.string()
		.max(30, { error: () => m['profileSchema.firstNameMax']() })
		.default(''),
	last_name: z
		.string()
		.max(150, { error: () => m['profileSchema.lastNameMax']() })
		.default(''),
	preferred_name: z
		.string()
		.max(255, { error: () => m['profileSchema.preferredNameMax']() })
		.default(''),
	pronouns: z.string().max(10, { error: () => m['profileSchema.pronounsMax']() }),
	language: z.enum(SUPPORTED_LANGUAGES),
	bio: z
		.string()
		.max(500, { error: () => m['profileSchema.bioMax']() })
		.optional()
		.default('')
});

export type ProfileUpdateFormData = z.infer<typeof profileUpdateSchema>;
