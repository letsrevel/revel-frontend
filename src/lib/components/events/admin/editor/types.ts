import type { EventCreateSchema } from '$lib/api/generated/types.gen';

/**
 * The editor's single form-state shape: the create schema plus the fields the
 * form tracks locally (media previews, venue/city selection, waitlist tuning).
 * Every section component edits this through one `onUpdate` merge function.
 */
export type EditorFormData = Partial<EventCreateSchema> & {
	id?: string;
	tags?: string[];
	logo?: string;
	cover_art?: string;
	organization_logo?: string;
	organization_cover_art?: string;
	requires_ticket?: boolean;
	requires_full_profile?: boolean;
	venue_id?: string | null;
	city_id?: number | null;
	location_maps_url?: string | null;
	location_maps_embed?: string | null;
	seats_held?: number;
	waitlist_time_window?: string | null;
	waitlist_batch_size?: number | null;
	waitlist_cutoff_date?: string | null;
	waitlist_lottery_mode?: boolean | null;
};

export type EditorUpdate = (data: Partial<EditorFormData>) => void;

export type ImageUpdate = (data: {
	logo?: File | null;
	coverArt?: File | null;
	deleteLogo?: boolean;
	deleteCoverArt?: boolean;
}) => void;

/**
 * `create`: the pre-creation form (name, dates, access, ticketing choice).
 * `edit`: the full editor — every section, all fields.
 */
export type EditorMode = 'create' | 'edit';
