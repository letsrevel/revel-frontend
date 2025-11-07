<script lang="ts">
	import * as m from '$lib/paraglide/messages.js';
	import type { AdditionalResourceSchema } from '$lib/api/generated/types.gen';
	import ResourceCard from './ResourceCard.svelte';
	import { cn } from '$lib/utils/cn';

	interface Props {
		resources: AdditionalResourceSchema[];
		onEdit?: (resource: AdditionalResourceSchema) => void;
		onDelete?: (resourceId: string) => void;
		isDeleting?: boolean;
		class?: string;
	}

	let { resources, onEdit, onDelete, isDeleting = false, class: className }: Props = $props();

	// Group resources by type for better organization (optional)
	// Currently unused but kept for potential future use
	// eslint-disable-next-line @typescript-eslint/no-unused-vars
	const _groupedResources = $derived.by(() => {
		const groups: Record<string, AdditionalResourceSchema[]> = {
			file: [],
			link: [],
			text: []
		};

		resources.forEach((resource) => {
			const type = resource.resource_type || 'text';
			if (!groups[type]) {
				groups[type] = [];
			}
			groups[type].push(resource);
		});

		return groups;
	});
</script>

<div class={cn('space-y-6', className)}>
	<!-- Grid Layout for Cards -->
	<div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
		{#each resources as resource (resource.id)}
			<ResourceCard {resource} {onEdit} {onDelete} {isDeleting} />
		{/each}
	</div>

	<!-- Count -->
	<p class="text-sm text-muted-foreground">
		{m['resourceList.showingCount']({
			count: resources.length,
			plural: resources.length === 1 ? '' : m['resourceList.showingCount_plural']()
		})}
	</p>
</div>
