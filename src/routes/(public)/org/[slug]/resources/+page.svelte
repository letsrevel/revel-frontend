<script lang="ts">
	import { page } from '$app/stores';
	import { FileText, Search, Filter } from 'lucide-svelte';
	import type { AdditionalResourceSchema } from '$lib/api/generated/types.gen';

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

	// Get resource icon
	function getResourceIcon(type: string) {
		switch (type) {
			case 'file':
				return 'FileText';
			case 'link':
				return 'Link';
			case 'text':
				return 'AlignLeft';
			default:
				return 'FileText';
		}
	}

	function openResource(resource: AdditionalResourceSchema) {
		if (resource.resource_type === 'file' && resource.file) {
			// Files are stored on backend, so prepend backend URL if path is relative
			const fileUrl = resource.file.startsWith('http')
				? resource.file
				: `http://localhost:8000${resource.file}`;
			window.open(fileUrl, '_blank');
		} else if (resource.resource_type === 'link' && resource.link) {
			window.open(resource.link, '_blank');
		}
	}
</script>

<svelte:head>
	<title>Resources - {organization.name}</title>
	<meta name="description" content="Resources for {organization.name}" />
</svelte:head>

<div class="space-y-6">
	<!-- Header -->
	<div>
		<h1 class="text-3xl font-bold tracking-tight md:text-4xl">Resources</h1>
		<p class="mt-2 text-muted-foreground">
			Browse files, links, and documents from {organization.name}
		</p>
	</div>

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
				placeholder="Search resources..."
				class="w-full rounded-md border border-input bg-background py-2 pl-10 pr-4 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
				aria-label="Search resources"
			/>
		</div>

		<!-- Type Filter -->
		<select
			bind:value={typeFilter}
			class="rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
			aria-label="Filter by type"
		>
			<option value="all">All Types</option>
			<option value="file">Files</option>
			<option value="link">Links</option>
			<option value="text">Text</option>
		</select>
	</div>

	<!-- Resources Grid -->
	{#if filteredResources.length === 0}
		<div
			class="rounded-lg border-2 border-dashed border-gray-300 p-12 text-center dark:border-gray-600"
		>
			<Filter class="mx-auto h-12 w-12 text-muted-foreground" aria-hidden="true" />
			<h3 class="mt-4 text-lg font-semibold">No resources found</h3>
			<p class="mt-2 text-sm text-muted-foreground">
				{searchQuery || typeFilter !== 'all'
					? 'Try adjusting your filters'
					: 'This organization has not added any resources yet'}
			</p>
		</div>
	{:else}
		<div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
			{#each filteredResources as resource (resource.id)}
				<article
					class="flex flex-col gap-3 rounded-lg border bg-card p-4 transition-all hover:shadow-md"
				>
					<!-- Header -->
					<div class="flex items-start gap-3">
						<div
							class="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary"
						>
							<FileText class="h-5 w-5" aria-hidden="true" />
						</div>
						<div class="min-w-0 flex-1">
							<h3 class="truncate font-semibold leading-tight">
								{resource.name || 'Untitled Resource'}
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
							class="mt-auto rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
						>
							{resource.resource_type === 'file' ? 'View File' : 'Open Link'}
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
