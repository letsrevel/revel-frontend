import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('$lib/api', () => ({
	organizationadminblacklistCreateBlacklistEntry: vi.fn()
}));

import { organizationadminblacklistCreateBlacklistEntry } from '$lib/api';
import {
	blacklistBodyForHolder,
	canBlacklistHolder,
	requestCreateBlacklistEntry
} from './blacklist-request';

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

describe('blacklistBodyForHolder', () => {
	it('uses the user id for a live account', () => {
		expect(blacklistBodyForHolder({ id: 'u1', email: 'a@b.c', display_name: 'A' })).toEqual({
			user_id: 'u1',
			reason: ''
		});
	});

	it('uses the kept email and name for an erased holder', () => {
		expect(
			blacklistBodyForHolder({
				id: 'u1',
				erased: true,
				email: 'eve@example.com',
				display_name: 'Eve Erased'
			})
		).toEqual({ email: 'eve@example.com', preferred_name: 'Eve Erased', reason: '' });
	});

	it('omits the name when it is just the email', () => {
		expect(
			blacklistBodyForHolder({
				id: 'u1',
				erased: true,
				email: 'eve@example.com',
				display_name: 'eve@example.com'
			})
		).toEqual({ email: 'eve@example.com', reason: '' });
	});

	it('is null for an erased holder without a kept email, and for no id', () => {
		expect(blacklistBodyForHolder({ id: 'u1', erased: true, email: null })).toBeNull();
		expect(blacklistBodyForHolder({ id: '' })).toBeNull();
		expect(blacklistBodyForHolder(null)).toBeNull();
		expect(canBlacklistHolder({ id: 'u1', erased: true, email: ' ' })).toBe(false);
		expect(canBlacklistHolder({ id: 'u1' })).toBe(true);
	});
});
