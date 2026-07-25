// Seat state stored per grid cell, keyed by "row-col".
export interface SeatData {
	exists: boolean;
	is_accessible: boolean;
	is_obstructed_view: boolean;
	/**
	 * Price-category paint for the seat.
	 *
	 * - `undefined`: unknown/untouched — an existing seat whose paint was never
	 *   changed this session (nothing is sent for it on save). Hydration reads
	 *   the seat's persisted `price_category_id` from the admin seats response
	 *   (BE #734); the field is schema-optional, so seats the response omits it
	 *   for stay `undefined` defensively.
	 * - `null`: explicitly unpainted (eraser)
	 * - string: painted with that price category id
	 */
	priceCategoryId?: string | null;
}
