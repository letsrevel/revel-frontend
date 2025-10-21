<script lang="ts">
	import type { AdditionalResourceSchema } from '$lib/api/generated/types.gen';
	import { FileText, Link as LinkIcon, AlignLeft, ExternalLink, Download } from 'lucide-svelte';

	interface Props {
		resources: AdditionalResourceSchema[];
	}

	let { resources = [] }: Props = $props();

	function getIcon(type: string) {
		switch (type) {
			case 'file':
				return FileText;
			case 'link':
				return LinkIcon;
			case 'text':
				return AlignLeft;
			default:
				return FileText;
		}
	}

	function openResource(resource: AdditionalResourceSchema) {
		if (resource.resource_type === 'file' && resource.file) {
			const fileUrl = resource.file.startsWith('http')
				? resource.file
				: `http://localhost:8000${resource.file}`;
			window.open(fileUrl, '_blank');
		} else if (resource.resource_type === 'link' && resource.link) {
			window.open(resource.link, '_blank');
		}
	}

	// Only show the section if there are resources
	const hasResources = $derived(resources.length > 0);
</script>

{#if hasResources}
	<section class="rounded-lg border bg-card p-6">
		<h2 class="mb-4 text-xl font-bold">Event Resources</h2>
		<p class="mb-6 text-sm text-muted-foreground">Files, links, and documents for this event</p>

		<div class="space-y-3">
			{#each resources as resource (resource.id)}
				<article
					class="flex items-start gap-4 rounded-md border p-4 transition-all hover:bg-accent/50"
				>
					<!-- Icon -->
					<div
						class="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary"
					>
						<svelte:component
							this={getIcon(resource.resource_type)}
							class="h-5 w-5"
							aria-hidden="true"
						/>
					</div>

					<!-- Content -->
					<div class="min-w-0 flex-1">
						<h3 class="font-semibold leading-tight">
							{resource.name || 'Untitled Resource'}
						</h3>
						{#if resource.description}
							<p class="mt-1 line-clamp-2 text-sm text-muted-foreground">
								{resource.description}
							</p>
						{/if}

						{#if resource.resource_type === 'text' && resource.text}
							<div class="mt-2 rounded-md bg-muted/50 p-3 text-sm">
								<p class="line-clamp-3 text-muted-foreground">
									{resource.text}
								</p>
							</div>
						{/if}
					</div>

					<!-- Action Button -->
					{#if resource.resource_type !== 'text'}
						<button
							type="button"
							onclick={() => openResource(resource)}
							class="shrink-0 rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
							aria-label={resource.resource_type === 'file' ? 'Download file' : 'Open link'}
						>
							<span class="flex items-center gap-2">
								{#if resource.resource_type === 'file'}
									<Download class="h-4 w-4" aria-hidden="true" />
									<span class="hidden sm:inline">Download</span>
								{:else}
									<ExternalLink class="h-4 w-4" aria-hidden="true" />
									<span class="hidden sm:inline">Open</span>
								{/if}
							</span>
						</button>
					{/if}
				</article>
			{/each}
		</div>
	</section>
{/if}
