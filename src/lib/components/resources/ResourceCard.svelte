<script lang="ts">
	import type { AdditionalResourceSchema } from '$lib/api/generated/types.gen';
	import {
		FileText,
		Link as LinkIcon,
		AlignLeft,
		Edit,
		Trash2,
		Eye,
		EyeOff,
		Globe,
		Users,
		Shield,
		Lock
	} from 'lucide-svelte';
	import { cn } from '$lib/utils/cn';

	interface Props {
		resource: AdditionalResourceSchema;
		onEdit?: (resource: AdditionalResourceSchema) => void;
		onDelete?: (resourceId: string) => void;
		isDeleting?: boolean;
	}

	let { resource, onEdit, onDelete, isDeleting = false }: Props = $props();

	// Get icon based on resource type
	const icon = $derived.by(() => {
		switch (resource.resource_type) {
			case 'file':
				return FileText;
			case 'link':
				return LinkIcon;
			case 'text':
				return AlignLeft;
			default:
				return FileText;
		}
	});

	// Get visibility icon and label
	const visibilityInfo = $derived.by(() => {
		switch (resource.visibility) {
			case 'public':
				return { icon: Globe, label: 'Public', color: 'text-green-600 dark:text-green-400' };
			case 'members-only':
				return { icon: Users, label: 'Members Only', color: 'text-blue-600 dark:text-blue-400' };
			case 'staff-only':
				return { icon: Shield, label: 'Staff Only', color: 'text-orange-600 dark:text-orange-400' };
			case 'private':
				return { icon: Lock, label: 'Private', color: 'text-gray-600 dark:text-gray-400' };
			default:
				return { icon: Lock, label: 'Private', color: 'text-gray-600 dark:text-gray-400' };
		}
	});

	// Get resource type label
	const typeLabel = $derived.by(() => {
		switch (resource.resource_type) {
			case 'file':
				return 'File';
			case 'link':
				return 'Link';
			case 'text':
				return 'Text';
			default:
				return resource.resource_type;
		}
	});

	// Get resource content preview
	const contentPreview = $derived.by(() => {
		if (resource.resource_type === 'file') {
			return resource.file ? new URL(resource.file).pathname.split('/').pop() : 'No file attached';
		} else if (resource.resource_type === 'link') {
			return resource.link || 'No link provided';
		} else if (resource.resource_type === 'text') {
			const text = resource.text || '';
			return text.length > 100 ? text.substring(0, 100) + '...' : text || 'No content';
		}
		return '';
	});

	function handleEdit() {
		onEdit?.(resource);
	}

	function handleDelete() {
		if (resource.id) {
			onDelete?.(resource.id);
		}
	}
</script>

<article
	class={cn(
		'group relative flex flex-col gap-4 rounded-lg border bg-card p-4 transition-all hover:shadow-md',
		isDeleting && 'opacity-50'
	)}
>
	<!-- Header -->
	<div class="flex items-start justify-between gap-3">
		<div class="flex min-w-0 flex-1 items-start gap-3">
			<!-- Icon -->
			<div
				class="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary"
			>
				<svelte:component this={icon} class="h-5 w-5" aria-hidden="true" />
			</div>

			<!-- Title and Type -->
			<div class="min-w-0 flex-1">
				<h3 class="truncate text-lg font-semibold leading-tight">
					{resource.name || 'Untitled Resource'}
				</h3>
				<p class="text-sm text-muted-foreground">
					{typeLabel}
				</p>
			</div>
		</div>

		<!-- Actions -->
		<div class="flex shrink-0 items-center gap-1">
			<button
				type="button"
				onclick={handleEdit}
				disabled={isDeleting}
				class="rounded-md p-2 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
				aria-label="Edit resource"
			>
				<Edit class="h-4 w-4" aria-hidden="true" />
			</button>
			<button
				type="button"
				onclick={handleDelete}
				disabled={isDeleting}
				class="rounded-md p-2 text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
				aria-label="Delete resource"
			>
				<Trash2 class="h-4 w-4" aria-hidden="true" />
			</button>
		</div>
	</div>

	<!-- Description -->
	{#if resource.description}
		<p class="line-clamp-2 text-sm text-muted-foreground">
			{resource.description}
		</p>
	{/if}

	<!-- Content Preview -->
	<div class="rounded-md bg-muted/50 px-3 py-2 text-sm">
		<p class="truncate text-muted-foreground">
			{contentPreview}
		</p>
	</div>

	<!-- Footer Metadata -->
	<div class="flex flex-wrap items-center gap-3 text-xs">
		<!-- Visibility Badge -->
		<div class="flex items-center gap-1.5 {visibilityInfo.color}">
			<svelte:component this={visibilityInfo.icon} class="h-3.5 w-3.5" aria-hidden="true" />
			<span>{visibilityInfo.label}</span>
		</div>

		<!-- Display on Org Page Badge -->
		{#if resource.display_on_organization_page}
			<div class="flex items-center gap-1.5 text-muted-foreground">
				<Eye class="h-3.5 w-3.5" aria-hidden="true" />
				<span>Shown on org page</span>
			</div>
		{:else}
			<div class="flex items-center gap-1.5 text-muted-foreground">
				<EyeOff class="h-3.5 w-3.5" aria-hidden="true" />
				<span>Hidden from org page</span>
			</div>
		{/if}
	</div>
</article>
