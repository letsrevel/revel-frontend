import { z } from 'zod';

/**
 * Visibility options for attendee list
 */
export const VISIBILITY_OPTIONS = [
	{ value: 'never', label: 'Never show me' },
	{ value: 'always', label: 'Always show me' },
	{ value: 'to_members', label: 'Show only to members' },
	{ value: 'to_invitees', label: 'Show only to invitees' },
	{ value: 'to_both', label: 'Show to members and invitees' }
] as const;

export type VisibilityValue = (typeof VISIBILITY_OPTIONS)[number]['value'];

/**
 * General preferences update schema
 */
export const generalPreferencesSchema = z.object({
	show_me_on_attendee_list: z.enum(['never', 'always', 'to_members', 'to_invitees', 'to_both']),
	event_reminders: z.boolean(),
	silence_all_notifications: z.boolean(),
	city_id: z.number().nullable(),
	overwrite_children: z.boolean().optional().default(false)
});

export type GeneralPreferencesFormData = z.infer<typeof generalPreferencesSchema>;
