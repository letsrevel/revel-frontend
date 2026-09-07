import type { ConnectionSchema } from '$lib/api/generated/types.gen';
import type { Tone } from '$lib/components/common/tones';

export type ConnectionViewKind = 'not-connected' | 'pending' | 'active' | 'access-lost';

export interface ConnectionView {
	kind: ConnectionViewKind;
	/** Card tint + icon chip tone. Body text never carries it. */
	tone: Tone;
	/** Connect (status null) or reconnect (access lost). The backend refuses connect while active. */
	canConnect: boolean;
	canDisconnect: boolean;
	/** Webhook registration failed at connect time: counts fall back to the 15-minute sweep. */
	liveUpdatesOff: boolean;
}

/**
 * One card state per `ConnectionSchema.status`. `revoked` is reserved on the
 * backend and never written today, but it means the same thing as `error`
 * (whose `last_error.code` is `connection_revoked`): Revel lost access.
 */
export function connectionView(connection: ConnectionSchema): ConnectionView {
	const liveUpdatesOff = connection.last_error?.code === 'webhook_registration_failed';
	switch (connection.status) {
		case 'pending':
			return {
				kind: 'pending',
				tone: 'info',
				canConnect: false,
				canDisconnect: true,
				liveUpdatesOff
			};
		case 'active':
			return {
				kind: 'active',
				tone: 'success',
				canConnect: false,
				canDisconnect: true,
				liveUpdatesOff
			};
		case 'error':
		case 'revoked':
			return {
				kind: 'access-lost',
				tone: 'danger',
				canConnect: true,
				canDisconnect: true,
				liveUpdatesOff
			};
		default:
			return {
				kind: 'not-connected',
				tone: 'neutral',
				canConnect: true,
				canDisconnect: false,
				liveUpdatesOff: false
			};
	}
}

export const LANDING_PARAMS = ['connected', 'select', 'error'] as const;

export type LandingOutcome =
	| { kind: 'connected'; provider: string }
	| { kind: 'select'; provider: string }
	| { kind: 'error'; code: string }
	| null;

/**
 * The OAuth callback 302s here with exactly one of `?connected=<provider>`,
 * `?select=<provider>` or `?error=<code>` (backend
 * `integrations/controllers/public.py`).
 */
export function landingOutcome(params: URLSearchParams): LandingOutcome {
	const connected = params.get('connected');
	if (connected) return { kind: 'connected', provider: connected };
	const select = params.get('select');
	if (select) return { kind: 'select', provider: select };
	const error = params.get('error');
	if (error) return { kind: 'error', code: error };
	return null;
}
