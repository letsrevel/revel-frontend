import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('$lib/api', () => ({
	organizationadminblacklistCreateBlacklistEntry: vi.fn()
}));

import { organizationadminblacklistCreateBlacklistEntry } from '$lib/api';
import { requestCreateBlacklistEntry } from './blacklist-request';

const args = {
	slug: 'org',
	accessToken: 'tok',
	body: { email: 'a@b.c' },
	fallbackMessage: 'Fallback'
} as Parameters<typeof requestCreateBlacklistEntry>[0];

beforeEach(() => vi.clearAllMocks());

describe('requestCreateBlacklistEntry', () => {
	it('returns the data', async () => {
		vi.mocked(organizationadminblacklistCreateBlacklistEntry).mockResolvedValue({
			data: { id: 'x' }
		} as never);
		await expect(requestCreateBlacklistEntry(args)).resolves.toEqual({ id: 'x' });
	});

	it('throws the backend detail for an HTTP error', async () => {
		vi.mocked(organizationadminblacklistCreateBlacklistEntry).mockResolvedValue({
			error: { detail: 'Staff member.' }
		} as never);
		await expect(requestCreateBlacklistEntry(args)).rejects.toThrow('Staff member.');
	});

	it('falls back when the error has no detail', async () => {
		vi.mocked(organizationadminblacklistCreateBlacklistEntry).mockResolvedValue({
			error: {}
		} as never);
		await expect(requestCreateBlacklistEntry(args)).rejects.toThrow('Fallback');
	});

	it('replaces a thrown fetch error with the fallback', async () => {
		vi.mocked(organizationadminblacklistCreateBlacklistEntry).mockRejectedValue(
			new TypeError('Failed to fetch')
		);
		await expect(requestCreateBlacklistEntry(args)).rejects.toThrow('Fallback');
	});
});
