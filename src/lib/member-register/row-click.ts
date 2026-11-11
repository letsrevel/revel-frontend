/**
 * Whether a click on a whole People row should open the person sheet. The row
 * click is a pointer convenience (the name button is the accessible way in), so
 * it must never fire for a gesture that was about something else:
 * - on an interactive child (button, link, menu item, menu),
 * - while the user is selecting text (a drag-select ends in a click),
 * - when the pointer went down while one of the row's menus was open: that click
 *   only dismisses the menu.
 */
export function shouldOpenRow(
	target: EventTarget | null,
	menuOpenAtPointerDown: boolean,
	selection: string = window.getSelection()?.toString() ?? ''
): boolean {
	if (menuOpenAtPointerDown) return false;
	if (selection.length > 0) return false;
	if (!(target instanceof Element)) return false;
	return !target.closest('button, a, [role="menuitem"], [role="menu"]');
}

/** True when any menu trigger inside the row is currently expanded. */
export function rowHasOpenMenu(row: Element): boolean {
	return row.querySelector('[aria-expanded="true"]') !== null;
}
