import { describe, it, expect } from 'vitest';
import { classifyCameraError, type CameraErrorKind } from './camera-errors';

/**
 * html5-qrcode surfaces getUserMedia failures inconsistently — sometimes the
 * original DOMException, sometimes a plain Error wrapping the name in its
 * message, sometimes a bare string. All three must classify identically, or a
 * denied-permission error reads to an organizer as a generic "something failed".
 */
function allShapes(name: string): unknown[] {
	return [new DOMException('boom', name), new Error(`Error: ${name} — no camera`), name];
}

const CASES: [string, CameraErrorKind][] = [
	['NotAllowedError', 'permission-denied'],
	['PermissionDeniedError', 'permission-denied'],
	['NotFoundError', 'not-found'],
	['DevicesNotFoundError', 'not-found'],
	['NotReadableError', 'not-readable'],
	['TrackStartError', 'not-readable'],
	['OverconstrainedError', 'overconstrained']
];

describe('classifyCameraError', () => {
	for (const [name, kind] of CASES) {
		it(`classifies ${name} as ${kind} in all three error shapes`, () => {
			for (const err of allShapes(name)) {
				expect(classifyCameraError(err)).toBe(kind);
			}
		});
	}

	it('falls back to generic for an unrecognized failure', () => {
		expect(classifyCameraError(new Error('the moon exploded'))).toBe('generic');
	});

	it('falls back to generic for a non-error value', () => {
		expect(classifyCameraError(null)).toBe('generic');
		expect(classifyCameraError(undefined)).toBe('generic');
		expect(classifyCameraError({ nope: true })).toBe('generic');
	});

	// A DOMException whose *message* happens to mention another error name must
	// be classified by its `name`, which is the authoritative field.
	it('prefers a DOMException name over a misleading message', () => {
		const err = new DOMException('NotFoundError appeared in the text', 'NotAllowedError');
		expect(classifyCameraError(err)).toBe('permission-denied');
	});
});
