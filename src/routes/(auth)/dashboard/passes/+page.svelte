<script lang="ts">
	import * as m from '$lib/paraglide/messages.js';
	import { authStore } from '$lib/stores/auth.svelte';
	import { createQuery } from '@tanstack/svelte-query';
	import { seriespassListMySeriesPasses } from '$lib/api';
	import { seriesPassQueryKeys } from '$lib/queries/series-passes';
	import HeldPassCard from '$lib/components/series-passes/HeldPassCard.svelte';
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

<div class="container mx-auto px-4 py-6 md:py-8">
	<!-- Page Header -->
	<div class="mb-8">
		<div class="mb-2 flex items-center gap-3">
			<div class="rounded-lg bg-primary/10 p-2">
				<Ticket class="h-6 w-6 text-primary" aria-hidden="true" />
			</div>
			<h1 class="text-2xl font-bold md:text-3xl">{m['seriesPass.myPassesTitle']()}</h1>
		</div>
		<p class="text-muted-foreground">{m['seriesPass.myPassesDescription']()}</p>
	</div>

	{#if passesQuery.isPending}
		<div class="flex items-center justify-center py-16" role="status">
			<Loader2 class="h-8 w-8 animate-spin text-muted-foreground" aria-hidden="true" />
			<span class="sr-only">{m['seriesPass.loading']()}</span>
		</div>
	{:else if passesQuery.isError}
		<div class="rounded-lg border border-destructive/40 bg-card p-8 text-center" role="alert">
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
		<div class="rounded-lg border bg-card p-8 text-center">
			<Ticket class="mx-auto mb-4 h-12 w-12 text-muted-foreground" aria-hidden="true" />
			<h2 class="mb-2 text-lg font-semibold">{m['seriesPass.noPassesTitle']()}</h2>
			<p class="mb-4 text-sm text-muted-foreground">{m['seriesPass.noPassesDescription']()}</p>
			<a
				href={resolve('/(public)/events', {})}
				class="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
			>
				{m['seriesPass.browseEvents']()}
			</a>
		</div>
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
</div>
