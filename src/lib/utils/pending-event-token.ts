/**
 * Ask the server to forget the pending event token after a successful claim.
 *
 * The event page reads an invitation token from `?et=` or from the httpOnly
 * `pending_event_token` cookie, and offers "Claim invitation" while it has one.
 * Every client claim path calls this before it navigates, so the next page
 * shows the real next step and not the claim again (#1115, #1274).
 *
 * Best effort: a failure is logged and never blocks the navigation. The
 * timeout keeps a stalled request from holding the user on the page.
 */
export async function forgetPendingEventToken(token: string, timeoutMs = 3000): Promise<void> {
	try {
		const res = await fetch(`/api/events/pending-token?token=${encodeURIComponent(token)}`, {
			method: 'DELETE',
			signal: AbortSignal.timeout(timeoutMs)
		});
		if (!res.ok) {
			console.warn('Failed to clear the pending event token:', res.status);
		}
	} catch (err) {
		console.warn('Failed to clear the pending event token:', err);
	}
}
