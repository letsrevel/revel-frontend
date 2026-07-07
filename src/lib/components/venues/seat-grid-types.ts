// Seat state stored per grid cell, keyed by "row-col".
export interface SeatData {
	exists: boolean;
	is_accessible: boolean;
	is_obstructed_view: boolean;
}
