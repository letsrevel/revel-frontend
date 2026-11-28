/**
 * Counts for the org visibility warning (A1, #1314): how many upcoming events a
 * visitor can still see although the organization is hidden.
 *
 * Imports the SDK from the `$lib/api/generated` barrel on purpose. The settings
 * route tests mock `$lib/api/generated`; the overview route tests mock
 * `$lib/api/generated/sdk.gen`, which the barrel re-exports. So one import path
 * is covered by both mocks.
 */
import { eventpublicdiscoveryListEvents } from '$lib/api/generated';
import { log } from '$lib/server/logger';

export interface OrgWarningCounts {
	/** Upcoming rows with visibility public|unlisted and status open|closed. */
	publicEventCount: number;
	/** How many of those rows are in a series. */
	inSeriesCount: number;
	/** The response has a next page, so the counts are lower bounds. */
	partial: boolean;
}

export interface LoadOrgWarningCountsOptions {
	orgId: string;
	accessToken: string;
	fetch: typeof fetch;
}

/** One list call (upcoming only, the default). Returns `null` on any failure (fail open). */
export async function loadOrgWarningCounts(
	opts: LoadOrgWarningCountsOptions
): Promise<OrgWarningCounts | null> {
	const { orgId, accessToken, fetch: fetchFn } = opts;
	try {
		const res = await eventpublicdiscoveryListEvents({
			fetch: fetchFn,
			query: { organization: orgId, page_size: 100, order_by: 'start' },
			headers: { Authorization: `Bearer ${accessToken}` }
		});
		if (res.error || !res.data) {
			log.error('org_warning_counts_failed', { error: res.error, orgId });
			return null;
		}
		const rows = res.data.results.filter(
			(e) =>
				(e.visibility === 'public' || e.visibility === 'unlisted') &&
				(e.status === 'open' || e.status === 'closed')
		);
		return {
			publicEventCount: rows.length,
			inSeriesCount: rows.filter((e) => e.event_series != null).length,
			partial: res.data.next != null
		};
	} catch (error: unknown) {
		log.error('org_warning_counts_failed', { error, orgId });
		return null;
	}
}
