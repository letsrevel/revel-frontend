import { z } from 'zod';

/**
 * Valid values for the attendee-list visibility preference.
 * Single source of truth — the component (AttendeeVisibilitySelect) uses i18n keys for labels.
 */
export type VisibilityValue = 'never' | 'always' | 'to_members' | 'to_invitees' | 'to_both';

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
