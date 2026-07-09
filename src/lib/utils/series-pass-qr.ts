// Series-pass QR payload contract, shared by the producer (MyPassModal renders
// the QR) and the consumer (the admin scanner routes scanned codes). Mirrors
// the backend's HeldSeriesPass.QR_PREFIX.
export const SERIES_PASS_QR_PREFIX = 'series:';

/** Build the QR/check-in payload for a held series pass. */
export function seriesPassQrPayload(heldPassId: string): string {
	return `${SERIES_PASS_QR_PREFIX}${heldPassId}`;
}

/** Whether a scanned code is a series-pass payload (vs a plain ticket UUID). */
export function isSeriesPassCode(code: string): boolean {
	return code.startsWith(SERIES_PASS_QR_PREFIX);
}
