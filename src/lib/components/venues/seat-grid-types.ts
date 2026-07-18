// Seat state stored per grid cell, keyed by "row-col".
export interface SeatData {
	exists: boolean;
	is_accessible: boolean;
	is_obstructed_view: boolean;
	/**
	 * Price-category paint for the seat.
	 *
	 * - `undefined`: unknown/untouched — an existing seat whose paint was never
	 *   changed this session (nothing is sent for it on save). The admin seats
	 *   response does not expose `price_category_id` yet, so hydration is
	 *   defensive and untouched seats stay `undefined`.
	 * - `null`: explicitly unpainted (eraser)
	 * - string: painted with that price category id
	 */
	priceCategoryId?: string | null;
}
