import { describe, it, expect } from 'vitest';
import { connectionView, landingOutcome } from './connection-view';
import type { ConnectionSchema } from '$lib/api/generated/types.gen';

function conn(overrides: Partial<ConnectionSchema> = {}): ConnectionSchema {
	return { provider: 'eventbrite', display_name: 'Eventbrite', status: null, ...overrides };
}

describe('connectionView', () => {
	it('is not-connected when status is null', () => {
		const v = connectionView(conn());
		expect(v.kind).toBe('not-connected');
		expect(v.canConnect).toBe(true);
		expect(v.canDisconnect).toBe(false);
		expect(v.tone).toBe('neutral');
	});

	it('is pending when the account still has to be chosen', () => {
		const v = connectionView(conn({ status: 'pending' }));
		expect(v.kind).toBe('pending');
		expect(v.canConnect).toBe(false);
		expect(v.canDisconnect).toBe(true);
		expect(v.tone).toBe('info');
	});

	it('is active with success tone', () => {
		const v = connectionView(conn({ status: 'active', remote_account_name: 'Acme' }));
		expect(v.kind).toBe('active');
		expect(v.canConnect).toBe(false);
		expect(v.canDisconnect).toBe(true);
		expect(v.tone).toBe('success');
	});

	it.each(['error', 'revoked'] as const)(
		'is access-lost for %s, and lets the owner reconnect',
		(status) => {
			const v = connectionView(conn({ status }));
			expect(v.kind).toBe('access-lost');
			expect(v.canConnect).toBe(true);
			expect(v.canDisconnect).toBe(true);
			expect(v.tone).toBe('danger');
		}
	);

	it('flags live updates off only for webhook_registration_failed', () => {
		expect(
			connectionView(
				conn({
					status: 'active',
					last_error: { detail: 'x', code: 'webhook_registration_failed' }
				})
			).liveUpdatesOff
		).toBe(true);
		expect(
			connectionView(
				conn({ status: 'error', last_error: { detail: 'x', code: 'connection_revoked' } })
			).liveUpdatesOff
		).toBe(false);
	});
});

describe('landingOutcome', () => {
	it('reads connected', () => {
		expect(landingOutcome(new URLSearchParams('connected=eventbrite'))).toEqual({
			kind: 'connected',
			provider: 'eventbrite'
		});
	});

	it('reads select', () => {
		expect(landingOutcome(new URLSearchParams('select=eventbrite'))).toEqual({
			kind: 'select',
			provider: 'eventbrite'
		});
	});

	it('reads error', () => {
		expect(landingOutcome(new URLSearchParams('error=state_invalid'))).toEqual({
			kind: 'error',
			code: 'state_invalid'
		});
	});

	it('is null with no landing key', () => {
		expect(landingOutcome(new URLSearchParams('tab=x'))).toBeNull();
	});
});
