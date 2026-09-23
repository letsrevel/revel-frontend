/**
 * Maps a failed backend call's HTTP status to the status a page loader should
 * throw. A missing resource stays a 404 and a permission error stays a 403, so
 * neither reads as the other; backend outages (5xx, or no response at all)
 * become a 500; any other unexpected upstream status is a 502.
 */
export function loaderErrorStatus(backendStatus: number | undefined): number {
	if (backendStatus === 404 || backendStatus === 403) return backendStatus;
	if (backendStatus === undefined || backendStatus >= 500) return 500;
	return 502;
}
