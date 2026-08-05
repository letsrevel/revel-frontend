<script lang="ts">
	import * as m from '$lib/paraglide/messages.js';
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
		Lock,
		Ticket
	} from '@lucide/svelte';
	import { cn } from '$lib/utils/cn';
	import ToneTile from '$lib/components/common/ToneTile.svelte';
	import { getBackendUrl } from '$lib/config/api';
	import MarkdownContent from '$lib/components/common/MarkdownContent.svelte';

	interface Props {
		resource: AdditionalResourceSchema;
		onEdit?: (resource: AdditionalResourceSchema) => void;
		onDelete?: (resourceId: string) => void;
		isDeleting?: boolean;
	}

	const { resource, onEdit, onDelete, isDeleting = false }: Props = $props();

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

	/**
	 * Visibility, on semantic tokens instead of a hand-picked green/blue/orange/
	 * purple/grey ramp. Each row pairs its own icon AND its own label, so the
	 * colour is redundant reinforcement, never the message (WCAG 1.4.1).
	 *
	 * These are 12px text sitting DIRECTLY on the card — no tint underneath — so
	 * each needs >= 4.5:1 against the card itself. Hand-computed token-vs-card
	 * (light | dark); do NOT reuse ToneTile's table here, those numbers are for an
	 * icon on a 10% tint:
	 *   success 5.68 | 9.53 · info 11.13 | 8.71 · primary 6.99 | 6.27
	 *   muted-foreground 9.06 | 7.44
	 *   highlight-foreground 15.90 (light) / highlight 9.17 (dark) — amber itself
	 *   is 1.94:1 on a light card, which is why warning flips its token by mode.
	 */
	const visibilityInfo = $derived.by(() => {
		switch (resource.visibility) {
			case 'public':
				return {
					icon: Globe,
					label: m['resourceCard.visibilityPublic'](),
					color: 'text-success'
				};
			case 'members-only':
				return {
					icon: Users,
					label: m['resourceCard.visibilityMembersOnly'](),
					color: 'text-info'
				};
			case 'staff-only':
				return {
					icon: Shield,
					label: m['resourceCard.visibilityStaffOnly'](),
					color: 'text-highlight-foreground dark:text-highlight'
				};
			case 'attendees-only':
				return {
					icon: Ticket,
					label: m['resourceCard.visibilityAttendeesOnly'](),
					color: 'text-primary'
				};
			case 'private':
				return {
					icon: Lock,
					label: m['resourceCard.visibilityPrivate'](),
					color: 'text-muted-foreground'
				};
			default:
				return {
					icon: Lock,
					label: m['resourceCard.visibilityPrivate'](),
					color: 'text-muted-foreground'
				};
		}
	});

	// Get resource type label
	const typeLabel = $derived.by(() => {
		switch (resource.resource_type) {
			case 'file':
				return m['resourceCard.typeFile']();
			case 'link':
				return m['resourceCard.typeLink']();
			case 'text':
				return m['resourceCard.typeText']();
			default:
				return resource.resource_type;
		}
	});

	// Get resource content preview
	const contentPreview = $derived.by(() => {
		if (resource.resource_type === 'file') {
			if (!resource.file_url) return m['resourceCard.noFileAttached']();
			// Extract filename from path (handle both URLs and paths)
			try {
				// Try as URL first (for absolute URLs)
				return (
					new URL(resource.file_url).pathname.split('/').pop() || m['resourceCard.unknownFile']()
				);
			} catch {
				// If not a valid URL, treat as path
				return resource.file_url.split('/').pop() || m['resourceCard.unknownFile']();
			}
		} else if (resource.resource_type === 'link') {
			return resource.link || m['resourceCard.noLinkProvided']();
		} else if (resource.resource_type === 'text') {
			const text = resource.text || '';
			return text.length > 100
				? text.substring(0, 100) + '...'
				: text || m['resourceCard.noContent']();
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

	function handleResourceClick() {
		if (resource.resource_type === 'file' && resource.file_url) {
			// Open file in new tab (browser will download if it can't display)
			// file_url may be a relative path from the backend, so we need to prepend the API base URL
			window.open(getBackendUrl(resource.file_url), '_blank');
		} else if (resource.resource_type === 'link' && resource.link) {
			// Open link in new tab
			window.open(resource.link, '_blank');
		}
		// For text type, we don't open anything - the content is shown in the preview
	}

	const isClickable = $derived(
		(resource.resource_type === 'file' && resource.file_url) ||
			(resource.resource_type === 'link' && resource.link)
	);
</script>

<article
	class={cn(
		'group relative flex flex-col gap-4 rounded-lg border-2 bg-card p-4 shadow-poster transition-all hover:-translate-y-1 hover:shadow-poster-lg',
		isDeleting && 'opacity-50'
	)}
>
	<!-- Header -->
	<div class="flex items-start justify-between gap-3">
		<div class="flex min-w-0 flex-1 items-start gap-3">
			<!-- Icon -->
			{#if icon}
				{@const IconComponent = icon}
				<ToneTile tone="brand" icon={IconComponent} />
			{/if}

			<!-- Title and Type -->
			<div class="min-w-0 flex-1">
				<h3 class="truncate text-lg font-bold leading-tight">
					{resource.name || m['resourceCard.untitledResource']()}
				</h3>
				<p class="text-sm text-muted-foreground">
					{typeLabel}
				</p>
			</div>
		</div>

		<!-- Actions (only show if callbacks are provided) -->
		{#if onEdit || onDelete}
			<div class="flex shrink-0 items-center gap-1">
				{#if onEdit}
					<button
						type="button"
						onclick={handleEdit}
						disabled={isDeleting}
						class="rounded-md p-2 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
						aria-label={m['resourceCard.editResource']()}
					>
						<Edit class="h-4 w-4" aria-hidden="true" />
					</button>
				{/if}
				{#if onDelete}
					<button
						type="button"
						onclick={handleDelete}
						disabled={isDeleting}
						class="rounded-md p-2 text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
						aria-label={m['resourceCard.deleteResource']()}
					>
						<Trash2 class="h-4 w-4" aria-hidden="true" />
					</button>
				{/if}
			</div>
		{/if}
	</div>

	<!-- Description -->
	{#if resource.description}
		<MarkdownContent
			content={resource.description}
			inline
			class="!prose-sm line-clamp-2 text-muted-foreground [&>*]:m-0"
		/>{/if}

	<!-- Content Preview -->
	{#if isClickable}
		<button
			type="button"
			onclick={handleResourceClick}
			class="w-full rounded-md bg-muted/50 px-3 py-2 text-left text-sm transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
		>
			<p class="truncate text-muted-foreground">
				{contentPreview}
			</p>
		</button>
	{:else}
		<div class="rounded-md bg-muted/50 px-3 py-2 text-sm">
			<p class="truncate text-muted-foreground">
				{contentPreview}
			</p>
		</div>
	{/if}

	<!-- Footer Metadata -->
	<div class="flex flex-wrap items-center gap-3 text-xs">
		<!-- Visibility Badge -->
		{#if visibilityInfo.icon}
			{@const VisibilityIcon = visibilityInfo.icon}
			<div class="flex items-center gap-1.5 {visibilityInfo.color}">
				<VisibilityIcon class="h-3.5 w-3.5" aria-hidden="true" />
				<span>{visibilityInfo.label}</span>
			</div>
		{/if}

		<!-- Display on Org Page Badge -->
		{#if resource.display_on_organization_page}
			<div class="flex items-center gap-1.5 text-muted-foreground">
				<Eye class="h-3.5 w-3.5" aria-hidden="true" />
				<span>{m['resourceCard.shownOnOrgPage']()}</span>
			</div>
		{:else}
			<div class="flex items-center gap-1.5 text-muted-foreground">
				<EyeOff class="h-3.5 w-3.5" aria-hidden="true" />
				<span>{m['resourceCard.hiddenFromOrgPage']()}</span>
			</div>
		{/if}
	</div>
</article>
