import { describe, it, expect } from 'vitest';
import { isWalletPassUnavailable } from './wallet-error';

describe('isWalletPassUnavailable', () => {
	it('accepts the coded generation-failure body', () => {
		expect(
			isWalletPassUnavailable({ detail: 'Pass unavailable', code: 'wallet_pass_unavailable' })
		).toBe(true);
	});

	it('rejects the un-coded "not configured" body', () => {
		expect(isWalletPassUnavailable({ detail: 'Wallet is not configured' })).toBe(false);
	});

	it('rejects some other code', () => {
		expect(isWalletPassUnavailable({ detail: 'nope', code: 'something_else' })).toBe(false);
	});

	// The client hands back whatever the body parsed to — a non-JSON 503 from a
	// proxy arrives as a bare string, and a body-less one as undefined.
	it('rejects non-object bodies', () => {
		expect(isWalletPassUnavailable(undefined)).toBe(false);
		expect(isWalletPassUnavailable(null)).toBe(false);
		expect(isWalletPassUnavailable('503 Service Unavailable')).toBe(false);
	});
});
