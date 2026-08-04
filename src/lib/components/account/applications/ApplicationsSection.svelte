<script lang="ts">
	import * as m from '$lib/paraglide/messages.js';
	import { createQuery } from '@tanstack/svelte-query';
	import { memembershipapplicationsListApplications } from '$lib/api/generated/sdk.gen';
	import type { MembershipApplicationSchema } from '$lib/api/generated/types.gen';
	import { authStore } from '$lib/stores/auth.svelte';
	import ApplicationRow from './ApplicationRow.svelte';
	import SectionHeader from '$lib/components/common/SectionHeader.svelte';
	import EmptyState from '$lib/components/common/EmptyState.svelte';
	import { ClipboardList, Loader2 } from '@lucide/svelte';

	const accessToken = $derived(authStore.accessToken);

	const applicationsQuery = createQuery(() => ({
		queryKey: ['me', 'applications'],
		queryFn: async () => {
			const res = await memembershipapplicationsListApplications({
				query: { page_size: 50 },
				headers: { Authorization: `Bearer ${accessToken}` }
			});
			if (res.error) throw new Error('Failed to load applications');
			return res.data?.results ?? [];
		},
		enabled: !!accessToken
	}));

	// TanStack keeps the last successful payload across a failed refetch, which
	// is why the error branch below is gated on this being empty: a blipped
	// background poll must not replace rows the member is reading with an error
	// line. Only "we have nothing to show *and* the fetch failed" is an error.
	const applications = $derived(applicationsQuery.data ?? []);

	// PENDING and APPROVED are the two states the member is still waiting on —
	// APPROVED included, because the membership only materializes once the
	// application is read, which is exactly what the rows below do.
	const inProgress = $derived(
		applications.filter((a) => a.status === 'pending' || a.status === 'approved')
	);
	const closed = $derived(
		applications.filter((a) => a.status !== 'pending' && a.status !== 'approved')
	);

	// `id` is optional on the schema; the org/date pair is unique enough for a
	// keyed each, and stable across the row's own in-place refresh.
	function rowKey(a: MembershipApplicationSchema): string {
		return a.id ?? `${a.organization_id}:${a.created_at}`;
	}

	// `isPending`, not `isLoading` — a query disabled while auth bootstraps
	// reports `isLoading === false`, which would flash the empty state on first
	// paint at every member who has applications.
	const isSectionPending = $derived(applicationsQuery.isPending);
</script>

<section aria-labelledby="applications-heading" class="space-y-3">
	<SectionHeader id="applications-heading" title={m['applications.title']()} />

	{#if isSectionPending}
		<div role="status">
			<Loader2 class="h-5 w-5 animate-spin" aria-hidden="true" />
			<span class="sr-only">{m['common.loading']()}</span>
		</div>
	{:else if applicationsQuery.isError && applications.length === 0}
		<!-- `role="alert"`: this replaces the spinner after first paint, so without a
		     live region the failure is silent to anyone who has moved focus on. -->
		<p role="alert" class="text-sm text-destructive">{m['applications.loadError']()}</p>
	{:else if applications.length === 0}
		<!-- level=3: sits inside this section, whose own heading is the level-2. -->
		<EmptyState
			icon={ClipboardList}
			level={3}
			title={m['applications.emptyTitle']()}
			body={m['applications.empty']()}
		/>
	{:else}
		{#if inProgress.length > 0}
			<h3 id="applications-in-progress-heading" class="text-sm font-medium text-muted-foreground">
				{m['applications.inProgress']()}
			</h3>
			<ul aria-labelledby="applications-in-progress-heading" class="space-y-3">
				{#each inProgress as application (rowKey(application))}
					<li><ApplicationRow {application} /></li>
				{/each}
			</ul>
		{/if}

		{#if closed.length > 0}
			<h3 id="applications-closed-heading" class="text-sm font-medium text-muted-foreground">
				{m['applications.closed']()}
			</h3>
			<ul aria-labelledby="applications-closed-heading" class="space-y-3">
				{#each closed as application (rowKey(application))}
					<li><ApplicationRow {application} /></li>
				{/each}
			</ul>
		{/if}
	{/if}
</section>
