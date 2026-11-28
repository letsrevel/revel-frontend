import { describe, it, expect, vi, beforeEach } from 'vitest';

const listEvents = vi.hoisted(() => vi.fn());
const logError = vi.hoisted(() => vi.fn());

vi.mock('$lib/api/generated', () => ({ eventpublicdiscoveryListEvents: listEvents }));
vi.mock('$lib/server/logger', () => ({ log: { error: logError } }));

import { loadOrgWarningCounts } from './org-warning-counts';

const fetchStub = vi.fn() as unknown as typeof fetch;
const opts = { orgId: 'org-1', accessToken: 'tok', fetch: fetchStub };

function row(visibility: string, status: string, inSeries = false) {
	return { visibility, status, event_series: inSeries ? { id: 's', name: 'S' } : null };
}

describe('loadOrgWarningCounts', () => {
	beforeEach(() => {
		listEvents.mockReset();
		logError.mockReset();
	});

	it('calls the list once with the org, page size 100, order by start and the bearer header', async () => {
		listEvents.mockResolvedValue({ data: { results: [], next: null } });
		await loadOrgWarningCounts(opts);
		expect(listEvents).toHaveBeenCalledTimes(1);
		expect(listEvents).toHaveBeenCalledWith({
			fetch: fetchStub,
			query: { organization: 'org-1', page_size: 100, order_by: 'start' },
			headers: { Authorization: 'Bearer tok' }
		});
	});

	it('counts only public/unlisted rows with status open/closed', async () => {
		listEvents.mockResolvedValue({
			data: {
				results: [
					row('public', 'open'),
					row('unlisted', 'closed', true),
					row('public', 'draft'),
					row('public', 'cancelled', true),
					row('private', 'open'),
					row('members-only', 'open', true)
				],
				next: null
			}
		});
		expect(await loadOrgWarningCounts(opts)).toEqual({
			publicEventCount: 2,
			inSeriesCount: 1,
			partial: false
		});
	});

	it('marks the counts partial when there is a next page', async () => {
		listEvents.mockResolvedValue({
			data: { results: [row('public', 'open')], next: 'http://x/?page=2' }
		});
		expect(await loadOrgWarningCounts(opts)).toMatchObject({ publicEventCount: 1, partial: true });
	});

	it('returns null on an API error', async () => {
		listEvents.mockResolvedValue({ error: { detail: 'x' }, data: undefined });
		expect(await loadOrgWarningCounts(opts)).toBeNull();
		expect(logError).toHaveBeenCalled();
	});

	it('returns null when the call throws', async () => {
		listEvents.mockRejectedValue(new Error('boom'));
		expect(await loadOrgWarningCounts(opts)).toBeNull();
	});
});
