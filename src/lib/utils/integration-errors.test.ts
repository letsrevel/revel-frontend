import { describe, it, expect } from 'vitest';
import { integrationErrorMessage, integrationErrorFromResponse } from './integration-errors';

describe('integrationErrorMessage', () => {
	it('names the platform in the copy', () => {
		expect(integrationErrorMessage('already_connected', 'Eventbrite')).toBe(
			'Eventbrite is already connected.'
		);
	});

	it('uses the landing variant for a refused OAuth exchange', () => {
		expect(integrationErrorMessage('provider_rejected', 'Eventbrite', 'landing')).toContain(
			'did not complete the connection'
		);
		expect(integrationErrorMessage('provider_rejected', 'Eventbrite', 'action')).toBe(
			'Eventbrite refused the change.'
		);
	});

	it('interpolates the tier name for remote_only_tier', () => {
		expect(integrationErrorMessage('remote_only_tier', 'Eventbrite', 'action', 'VIP')).toContain(
			'"VIP"'
		);
	});

	it('returns null for unknown or missing codes', () => {
		expect(integrationErrorMessage('not_a_code', 'Eventbrite')).toBeNull();
		expect(integrationErrorMessage(null, 'Eventbrite')).toBeNull();
		expect(integrationErrorMessage(undefined, 'Eventbrite')).toBeNull();
	});
});

describe('integrationErrorFromResponse', () => {
	it('maps a known code and keeps the provider message aside', () => {
		const info = integrationErrorFromResponse(
			{
				detail: 'translated by backend',
				code: 'provider_rate_limited',
				provider_message: 'HTTP 429'
			},
			'Eventbrite'
		);
		expect(info.code).toBe('provider_rate_limited');
		expect(info.message).toBe('Eventbrite is busy right now. Try again in a few minutes.');
		expect(info.providerMessage).toBe('HTTP 429');
	});

	it('falls back to the backend detail for an unknown code', () => {
		const info = integrationErrorFromResponse(
			{ detail: 'Something specific', code: 'brand_new_code' },
			'Eventbrite'
		);
		expect(info.code).toBeNull();
		expect(info.message).toBe('Something specific');
		expect(info.providerMessage).toBeNull();
	});

	it('joins the messages of a request-validation 422 detail list', () => {
		const info = integrationErrorFromResponse(
			{
				detail: [
					{ msg: 'ensure this value has at least 1 items', loc: ['body', 'remote_ids'] },
					{ msg: 'field required', loc: ['body', 'provider'] }
				]
			},
			'Eventbrite'
		);
		expect(info.code).toBeNull();
		expect(info.message).toBe('ensure this value has at least 1 items, field required');
	});

	it('falls back to the generic line when the body is not an envelope', () => {
		const info = integrationErrorFromResponse(new Error('network down'), 'Eventbrite');
		expect(info.code).toBeNull();
		expect(info.message).toBe('Something went wrong with Eventbrite. Try again in a moment.');
	});
});
