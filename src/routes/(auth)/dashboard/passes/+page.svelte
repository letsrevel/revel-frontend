<script lang="ts">
	import * as m from '$lib/paraglide/messages.js';
	import { authStore } from '$lib/stores/auth.svelte';
	import { createQuery } from '@tanstack/svelte-query';
	import { seriespassListMySeriesPasses } from '$lib/api';
	import { seriesPassQueryKeys } from '$lib/queries/series-passes';
	import HeldPassCard from '$lib/components/series-passes/HeldPassCard.svelte';
	import DashboardBandLayout from '$lib/components/dashboard/DashboardBandLayout.svelte';
	import EmptyState from '$lib/components/common/EmptyState.svelte';
	import { Ticket, ChevronLeft, ChevronRight, Loader2 } from '@lucide/svelte';
	import { page } from '$app/state';
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';

	const accessToken = $derived(authStore.accessToken);

	// Clamp untrusted ?page= input: NaN/0/negative all fall back to 1.
	const currentPage = $derived(Math.max(1, Number(page.url.searchParams.get('page') || '1') || 1));
	const PAGE_SIZE = 12;

	const passesQuery = createQuery(() => ({
		queryKey: seriesPassQueryKeys.mine(currentPage),
		queryFn: async () => {
			const response = await seriespassListMySeriesPasses({
				headers: { Authorization: `Bearer ${accessToken}` },
				query: { page: currentPage, page_size: PAGE_SIZE }
			});
			if (response.error || !response.data) {
				throw new Error('Failed to load passes');
			}
			return response.data;
		},
		enabled: !!accessToken
	}));

	const passes = $derived(passesQuery.data?.results || []);
	const totalCount = $derived(passesQuery.data?.count || 0);
	const totalPages = $derived(Math.ceil(totalCount / PAGE_SIZE));
	const hasNextPage = $derived(currentPage < totalPages);
	const hasPrevPage = $derived(currentPage > 1);

	function navigateToPage(pageNum: number) {
		const url = new URL(page.url);
		if (pageNum === 1) {
			url.searchParams.delete('page');
		} else {
			url.searchParams.set('page', pageNum.toString());
		}
		// eslint-disable-next-line svelte/no-navigation-without-resolve -- target is derived from the live page URL (base path already applied); resolve() cannot express search params
		goto(url.toString(), { replaceState: true, noScroll: true });
	}
</script>

<svelte:head>
	<title>{m['seriesPass.myPassesTitle']()} - Revel</title>
	<meta name="description" content={m['seriesPass.myPassesDescription']()} />
</svelte:head>

<!-- Celebration band + floating content (uplift); see DashboardBandLayout for
     the band's contrast contract. The pass grid, the empty state and the
     loading/error panels are all card surfaces, so they meet the band's
     bottom edge on their own. -->
<DashboardBandLayout
	title={m['seriesPass.myPassesTitle']()}
	subtitle={m['seriesPass.myPassesDescription']()}
	kicker={m['userMenu.dashboard']()}
>
	{#if passesQuery.isPending}
		<div
			class="flex items-center justify-center rounded-lg border-2 border-border bg-card py-16 shadow-poster"
			role="status"
		>
			<Loader2 class="h-8 w-8 animate-spin text-muted-foreground" aria-hidden="true" />
			<span class="sr-only">{m['seriesPass.loading']()}</span>
		</div>
	{:else if passesQuery.isError}
		<div
			class="rounded-lg border-2 border-destructive/40 bg-card p-8 text-center shadow-poster"
			role="alert"
		>
			<p class="mb-4 text-sm text-muted-foreground">{m['seriesPass.loadError']()}</p>
			<button
				type="button"
				onclick={() => passesQuery.refetch()}
				class="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
			>
				{m['seriesPass.retry']()}
			</button>
		</div>
	{:else if passes.length === 0}
		{#snippet browseEventsAction()}
			<a
				href={resolve('/(public)/events', {})}
				class="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
			>
				{m['seriesPass.browseEvents']()}
			</a>
		{/snippet}
		<EmptyState
			icon={Ticket}
			title={m['seriesPass.noPassesTitle']()}
			body={m['seriesPass.noPassesDescription']()}
			action={browseEventsAction}
			level={2}
		/>
	{:else}
		<div class="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
			{#each passes as heldPass (heldPass.id)}
				<HeldPassCard {heldPass} />
			{/each}
		</div>

		{#if totalPages > 1}
			<nav
				class="mt-8 flex items-center justify-center gap-2"
				aria-label={m['seriesPass.paginationLabel']()}
			>
				<button
					type="button"
					onclick={() => navigateToPage(currentPage - 1)}
					disabled={!hasPrevPage}
					class="inline-flex h-10 items-center justify-center gap-1 rounded-md border border-input bg-background px-4 py-2 text-sm font-medium transition-colors hover:bg-accent hover:text-accent-foreground disabled:cursor-not-allowed disabled:opacity-50"
				>
					<ChevronLeft class="h-4 w-4" aria-hidden="true" />
					{m['seriesPass.previous']()}
				</button>
				<span class="px-4 text-sm font-medium">
					{m['seriesPass.pageIndicator']({ currentPage, totalPages })}
				</span>
				<button
					type="button"
					onclick={() => navigateToPage(currentPage + 1)}
					disabled={!hasNextPage}
					class="inline-flex h-10 items-center justify-center gap-1 rounded-md border border-input bg-background px-4 py-2 text-sm font-medium transition-colors hover:bg-accent hover:text-accent-foreground disabled:cursor-not-allowed disabled:opacity-50"
				>
					{m['seriesPass.next']()}
					<ChevronRight class="h-4 w-4" aria-hidden="true" />
				</button>
			</nav>
		{/if}
	{/if}
</DashboardBandLayout>
