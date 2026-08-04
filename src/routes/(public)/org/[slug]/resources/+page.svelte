<script lang="ts">
	import { page } from '$app/stores';
	import { FileText, Search, Filter } from '@lucide/svelte';
	import type { AdditionalResourceSchema } from '$lib/api/generated/types.gen';
	import * as m from '$lib/paraglide/messages.js';
	import PageHeader from '$lib/components/common/PageHeader.svelte';
	import EmptyState from '$lib/components/common/EmptyState.svelte';
	import ToneTile from '$lib/components/common/ToneTile.svelte';
	import { getBackendUrl } from '$lib/config/api';

	const data = $derived($page.data);
	const organization = $derived(data.organization);
	const allResources = $derived<AdditionalResourceSchema[]>(data.resources || []);

	// Filter state
	let searchQuery = $state('');
	let typeFilter = $state<'all' | 'file' | 'link' | 'text'>('all');

	// Filter resources
	const filteredResources = $derived.by(() => {
		let result = allResources;

		// Filter by search query
		if (searchQuery.trim()) {
			const query = searchQuery.toLowerCase();
			result = result.filter(
				(r) => r.name?.toLowerCase().includes(query) || r.description?.toLowerCase().includes(query)
			);
		}

		// Filter by type
		if (typeFilter !== 'all') {
			result = result.filter((r) => r.resource_type === typeFilter);
		}

		return result;
	});

	function openResource(resource: AdditionalResourceSchema) {
		if (resource.resource_type === 'file' && resource.file_url) {
			// file_url may be a relative path from the backend, so we need to prepend the API base URL
			window.open(getBackendUrl(resource.file_url), '_blank');
		} else if (resource.resource_type === 'link' && resource.link) {
			window.open(resource.link, '_blank');
		}
	}
</script>

<svelte:head>
	<title>{m['orgResourcesPage.pageTitle']({ organizationName: organization.name })}</title>
	<meta
		name="description"
		content={m['orgResourcesPage.pageDescription']({ organizationName: organization.name })}
	/>
</svelte:head>

<!-- `flex-col` so the tinted panel can take `flex-1`: an org with two resources
     would otherwise leave a bare `--background` strip under the wash. -->
<div class="flex min-h-screen flex-col bg-background">
	<!--
		Colour-block header band (uplift, spec §9), full-bleed: this route owns its
		own h1, so unlike the membership sub-page it can bleed to the viewport
		edge. Same full-strength `bg-secondary` poster panel as the discovery
		listings — audit-enforced in both modes — and shallow, because what follows
		is a search box and a grid.

		No sticker chip: the org's logo is not in this route's payload, and the
		sticker-chip rule forbids the Revel mark as a stand-in.
	-->
	<section class="bg-secondary text-secondary-foreground">
		<div class="container mx-auto px-6 pb-16 pt-8 md:px-8">
			<!-- Header -->
			<PageHeader
				volume="poster"
				onBand
				kicker={organization.name}
				title={m['orgResourcesPage.title']()}
				subtitle={m['orgResourcesPage.subtitle']({ organizationName: organization.name })}
			/>
		</div>
	</section>

	<!-- Body on plain `--background`, pulled up over the band's bottom edge — the
	     merged questionnaire page's arrangement. A `bg-secondary` wash under a
	     `bg-secondary` band sits 5 points of lightness from it and the block stops
	     reading as a block; the tinted wash is reserved for pages whose header is
	     the mode-inert poster-purple ribbon (event, org profile, series). The
	     float is the resource cards' `shadow-poster`. -->
	<div class="flex-1">
		<div class="container mx-auto -mt-8 space-y-6 px-6 pb-8 md:px-8 lg:pb-12">
			<!-- Filters -->
			<div class="flex flex-col gap-3 md:flex-row md:items-center">
				<!-- Search -->
				<div class="relative flex-1">
					<Search
						class="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
						aria-hidden="true"
					/>
					<input
						type="search"
						bind:value={searchQuery}
						placeholder={m['orgResourcesPage.searchPlaceholder']()}
						class="w-full rounded-md border border-input bg-background py-2 pl-10 pr-4 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
						aria-label={m['orgResourcesPage.searchAriaLabel']()}
					/>
				</div>

				<!-- Type Filter -->
				<select
					bind:value={typeFilter}
					class="rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
					aria-label={m['orgResourcesPage.filterAriaLabel']()}
				>
					<option value="all">{m['orgResourcesPage.filter_allTypes']()}</option>
					<option value="file">{m['orgResourcesPage.filter_files']()}</option>
					<option value="link">{m['orgResourcesPage.filter_links']()}</option>
					<option value="text">{m['orgResourcesPage.filter_text']()}</option>
				</select>
			</div>

			<!-- Resources Grid -->
			{#if filteredResources.length === 0}
				<EmptyState
					level={2}
					icon={Filter}
					title={m['orgResourcesPage.empty_title']()}
					body={searchQuery || typeFilter !== 'all'
						? m['orgResourcesPage.empty_withFilters']()
						: m['orgResourcesPage.empty_initial']()}
				/>
			{:else}
				<div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
					{#each filteredResources as resource (resource.id)}
						<!-- Same silhouette and lift as the three discovery cards: `border-2`
						     + `shadow-poster`, so a resource reads as a white sticker
						     floating on the page — this route's body sits on plain
						     `--background` (see the comment above), not a tinted panel. -->
						<article
							class="flex flex-col gap-3 rounded-lg border-2 bg-card p-4 shadow-poster transition-all hover:-translate-y-1 hover:shadow-poster-lg"
						>
							<!-- Header -->
							<div class="flex items-start gap-3">
								<ToneTile tone="brand" icon={FileText} />
								<div class="min-w-0 flex-1">
									<h3 class="truncate font-bold leading-tight">
										{resource.name || m['orgResourcesPage.resource_untitled']()}
									</h3>
									<p class="text-xs capitalize text-muted-foreground">
										{resource.resource_type}
									</p>
								</div>
							</div>

							<!-- Description -->
							{#if resource.description}
								<p class="line-clamp-2 text-sm text-muted-foreground">
									{resource.description}
								</p>
							{/if}

							<!-- Action Button -->
							{#if resource.resource_type !== 'text'}
								<button
									type="button"
									onclick={() => openResource(resource)}
									class="mt-auto rounded-md bg-primary px-4 py-2 text-sm font-bold text-primary-foreground transition-colors hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
								>
									{resource.resource_type === 'file'
										? m['orgResourcesPage.button_viewFile']()
										: m['orgResourcesPage.button_openLink']()}
								</button>
							{:else if resource.text}
								<div class="mt-auto rounded-md bg-muted/50 p-3 text-sm">
									<p class="line-clamp-3 text-muted-foreground">
										{resource.text}
									</p>
								</div>
							{/if}
						</article>
					{/each}
				</div>
			{/if}
		</div>
	</div>
</div>
