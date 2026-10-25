import * as m from '$lib/paraglide/messages.js';
import type { NavSection } from './EditorSectionNav.svelte';

/**
 * Anchors for the section nav, in page order. A section is marked as having
 * errors when `validationErrors` holds a key for a field that lives in it;
 * an invalid schedule row surfaces on Date & time.
 */
export function buildEditorSections(
	validationErrors: Record<string, string>,
	scheduleInvalid = false
): NavSection[] {
	return [
		{
			id: 'section-basics',
			label: m['eventEditor.sectionBasics'](),
			hasError: !!validationErrors.name
		},
		{
			id: 'section-when',
			label: m['eventEditor.sectionWhen'](),
			hasError: !!(validationErrors.start || validationErrors.end) || scheduleInvalid
		},
		{
			id: 'section-where',
			label: m['eventEditor.sectionWhere'](),
			hasError: !!validationErrors.city_id
		},
		{ id: 'section-access', label: m['eventEditor.sectionAccess']() },
		{ id: 'section-attendance', label: m['eventEditor.sectionAttendance']() },
		{ id: 'section-page', label: m['eventEditor.sectionPage']() },
		{ id: 'section-extras', label: m['eventEditor.sectionExtras']() }
	];
}

export type EditorTab = 'details' | 'ticketing' | 'listings';

/**
 * Rail / chip-row entries for the sibling tabs of a ticketed event. On Details
 * they are just the other two (they follow the section links); on any other tab
 * all three show, with the active one flagged, so you can see where you are and
 * get back.
 */
export function buildNavTabs(
	active: EditorTab,
	labels: Record<EditorTab, string>
): { value: EditorTab; label: string; current: boolean }[] {
	const order: EditorTab[] = ['details', 'ticketing', 'listings'];
	return order
		.filter((value) => active !== 'details' || value !== 'details')
		.map((value) => ({ value, label: labels[value], current: value === active }));
}
