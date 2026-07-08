/**
 * "Your Events" filter presets for the dashboard. Each preset maps a set of
 * dashboard-relationship query flags to a translation key.
 */
export interface DashboardFilterState {
	owner: boolean;
	staff: boolean;
	member: boolean;
	rsvp_yes: boolean;
	rsvp_maybe: boolean;
	got_ticket: boolean;
	got_invitation: boolean;
	subscriber: boolean;
	bookmarked: boolean;
}

export interface DashboardFilterPreset {
	labelKey: string;
	filters: DashboardFilterState;
}

export const filterPresets: DashboardFilterPreset[] = [
	{
		labelKey: 'dashboard.filters.all',
		filters: {
			owner: true,
			staff: true,
			member: true,
			rsvp_yes: true,
			rsvp_maybe: true,
			got_ticket: true,
			got_invitation: true,
			subscriber: true,
			bookmarked: false
		}
	},
	{
		labelKey: 'dashboard.filters.organizing',
		filters: {
			owner: true,
			staff: true,
			member: false,
			rsvp_yes: false,
			rsvp_maybe: false,
			got_ticket: false,
			got_invitation: false,
			subscriber: false,
			bookmarked: false
		}
	},
	{
		labelKey: 'dashboard.filters.attending',
		filters: {
			owner: false,
			staff: false,
			member: false,
			rsvp_yes: true,
			rsvp_maybe: true,
			got_ticket: true,
			got_invitation: false,
			subscriber: false,
			bookmarked: false
		}
	},
	{
		labelKey: 'dashboard.filters.invited',
		filters: {
			owner: false,
			staff: false,
			member: false,
			rsvp_yes: false,
			rsvp_maybe: false,
			got_ticket: false,
			got_invitation: true,
			subscriber: false,
			bookmarked: false
		}
	},
	{
		labelKey: 'dashboard.filters.bookmarked',
		filters: {
			owner: false,
			staff: false,
			member: false,
			rsvp_yes: false,
			rsvp_maybe: false,
			got_ticket: false,
			got_invitation: false,
			subscriber: false,
			bookmarked: true
		}
	}
];

// Helper to check if a filter preset is currently active
export function isFilterActive(
	yourEventsFilters: DashboardFilterState,
	preset: DashboardFilterPreset
): boolean {
	return JSON.stringify(yourEventsFilters) === JSON.stringify(preset.filters);
}
