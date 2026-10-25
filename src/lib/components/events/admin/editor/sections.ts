import * as m from '$lib/paraglide/messages.js';
import type { NavSection } from './EditorSectionNav.svelte';

/**
 * Anchors for the section nav. Phase 1 mirrors the existing blocks; resources
 * and schedule only exist once the event does. Validation errors surface as a
 * marker on the section that owns the offending field.
 */
export function buildEditorSections(
	validationErrors: Record<string, string>,
	hasEvent: boolean
): NavSection[] {
	return [
		{
			id: 'section-basics',
			label: m['eventEditor.sectionBasics'](),
			hasError: !!(validationErrors.name || validationErrors.start || validationErrors.end)
		},
		{
			id: 'section-details',
			label: m['eventEditor.sectionDetails'](),
			hasError: !!validationErrors.city_id
		},
		...(hasEvent
			? [
					{ id: 'section-resources', label: m['eventEditor.sectionResources']() },
					{ id: 'section-schedule', label: m['eventEditor.sectionSchedule']() }
				]
			: [])
	];
}
