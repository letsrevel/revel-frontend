/**
 * Classification of a `getUserMedia` / html5-qrcode start failure.
 *
 * Kept separate from the copy so it can be unit-tested without a DOM and reused
 * by every scanner surface (the event check-in modal, the org door page). The
 * caller maps the kind to a localized, actionable message.
 */
export type CameraErrorKind =
	'permission-denied' | 'not-found' | 'not-readable' | 'overconstrained' | 'generic';

/**
 * html5-qrcode reports failures in three different shapes depending on where
 * they originate: the original `DOMException`, an `Error` whose message embeds
 * the name, or a bare string. All three have to classify the same way.
 */
function matches(err: unknown, name: string): boolean {
	if (err instanceof DOMException) return err.name === name;
	const text = typeof err === 'string' ? err : err instanceof Error ? err.message : '';
	return text.includes(name);
}

/** Map an arbitrary camera-start failure onto a known kind. */
export function classifyCameraError(err: unknown): CameraErrorKind {
	if (matches(err, 'NotAllowedError') || matches(err, 'PermissionDeniedError')) {
		return 'permission-denied';
	}
	if (matches(err, 'NotFoundError') || matches(err, 'DevicesNotFoundError')) {
		return 'not-found';
	}
	if (matches(err, 'NotReadableError') || matches(err, 'TrackStartError')) {
		return 'not-readable';
	}
	if (matches(err, 'OverconstrainedError')) {
		return 'overconstrained';
	}
	return 'generic';
}
