/**
 * Pure close-time disposition for `SeatPickerDialog`'s `onDestroy` (#863
 * review). The dialog closes in four distinct situations and each owes the
 * cart something different:
 *
 * - Done hand-off: the cart already owns the seats — do nothing.
 * - Edit-session close after the first availability seed: treat as Done and
 *   write the controller's live holds back to the group (releasing instead
 *   would strip seats out of an existing cart group behind the buyer's back).
 * - Edit-session close BEFORE the seed: the transient controller holds
 *   nothing yet, so writing its (empty) list would delete the buyer's prior
 *   selection on a quick Escape over a cold load — leave the group untouched.
 * - Abandoned first pick: release whatever the transient controller still
 *   holds (nothing held → no-op).
 */
export type SeatPickerCloseAction = 'none' | 'write-holds' | 'release';

export function seatPickerCloseAction(args: {
	handedOff: boolean;
	wasEditSession: boolean;
	seeded: boolean;
	holdCount: number;
}): SeatPickerCloseAction {
	if (args.handedOff) return 'none';
	if (args.wasEditSession) return args.seeded ? 'write-holds' : 'none';
	return args.holdCount > 0 ? 'release' : 'none';
}
