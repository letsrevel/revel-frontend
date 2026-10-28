import { eventpublicdiscoveryListEvents } from '$lib/api/generated/sdk.gen';
import { log } from '$lib/server/logger';
import type { SetupCounts } from '$lib/utils/org-setup-progress';

type ListQuery = NonNullable<
	NonNullable<Parameters<typeof eventpublicdiscoveryListEvents>[0]>['query']
>;

export interface LoadSetupCountsOptions {
	orgId: string;
	accessToken: string;
	fetch: typeof fetch;
}

/**
 * Loads the org setup-checklist counts. Each count is fetched independently and
 * degrades to `null` on any failure (logged), so this never throws.
 * Templates are excluded server-side; `include_past` keeps finished events counted.
 */
export async function loadSetupCounts(opts: LoadSetupCountsOptions): Promise<SetupCounts> {
	const { orgId, accessToken, fetch: fetchFn } = opts;
	const base = {
		fetch: fetchFn,
		headers: { Authorization: `Bearer ${accessToken}` }
	} as const;

	const run = (name: string, extra: ListQuery) =>
		eventpublicdiscoveryListEvents({
			...base,
			query: { organization: orgId, include_past: true, page_size: 1, ...extra }
		})
			.then((result) => {
				if (result.error || !result.data) {
					log.error('org_setup_counts_failed', { error: result.error, orgId, query: name });
					return null;
				}
				return result.data;
			})
			.catch((error: unknown) => {
				log.error('org_setup_counts_failed', { error, orgId, query: name });
				return null;
			});

	const [total, open, closed, draft] = await Promise.all([
		run('total', {}),
		run('open', { status: 'open' }),
		run('closed', { status: 'closed' }),
		run('draft', { status: 'draft', order_by: '-start' })
	]);

	const firstDraft = draft?.results?.[0];

	return {
		eventCount: total?.count ?? null,
		publishedCount: open && closed ? open.count + closed.count : null,
		latestDraft: firstDraft ? { id: firstDraft.id, name: firstDraft.name } : null
	};
}

/**
 * Minimal check used while the setup card is hidden: has the org published
 * (open or closed) any event? Returns `null` when it cannot be determined.
 * Never throws.
 */
export async function loadHasPublishedEvent(opts: LoadSetupCountsOptions): Promise<boolean | null> {
	const { orgId, accessToken, fetch: fetchFn } = opts;
	const run = (status: 'open' | 'closed') =>
		eventpublicdiscoveryListEvents({
			fetch: fetchFn,
			headers: { Authorization: `Bearer ${accessToken}` },
			query: { organization: orgId, include_past: true, page_size: 1, status }
		})
			.then((result) => {
				if (result.error || !result.data) {
					log.error('org_setup_published_check_failed', { error: result.error, orgId, status });
					return null;
				}
				return result.data.count;
			})
			.catch((error: unknown) => {
				log.error('org_setup_published_check_failed', { error, orgId, status });
				return null;
			});

	const [open, closed] = await Promise.all([run('open'), run('closed')]);
	if ((open ?? 0) > 0 || (closed ?? 0) > 0) return true;
	if (open === null || closed === null) return null;
	return false;
}
