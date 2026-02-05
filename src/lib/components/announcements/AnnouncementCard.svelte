<script lang="ts">
	import * as m from '$lib/paraglide/messages.js';
	import type { AnnouncementListSchema } from '$lib/api/generated/types.gen';
	import { Button } from '$lib/components/ui/button';
	import { Badge } from '$lib/components/ui/badge';
	import {
		Edit,
		Trash2,
		Send,
		Users,
		UserCog,
		Calendar,
		Layers,
		MoreHorizontal,
		Eye,
		Loader2
	} from 'lucide-svelte';
	import * as DropdownMenu from '$lib/components/ui/dropdown-menu';
	import { formatRelativeTime } from '$lib/utils/time';

	interface Props {
		announcement: AnnouncementListSchema;
		isLoadingEdit?: boolean;
		onView?: () => void;
		onEdit?: () => void;
		onDelete?: () => void;
		onSend?: () => void;
	}

	let { announcement, isLoadingEdit = false, onView, onEdit, onDelete, onSend }: Props = $props();

	let isDraft = $derived(announcement.status === 'draft');

	// Determine target description
	let targetInfo = $derived.by(() => {
		if (announcement.event_name) {
			return {
				icon: Calendar,
				text: m['announcements.card.targetEvent']({ name: announcement.event_name })
			};
		}
		if (announcement.target_staff_only) {
			return {
				icon: UserCog,
				text: m['announcements.card.targetStaff']()
			};
		}
		if (announcement.target_all_members) {
			return {
				icon: Users,
				text: m['announcements.card.targetAllMembers']()
			};
		}
		// Must be specific tiers
		return {
			icon: Layers,
			text: m['announcements.card.targetTiers']({ count: '?' })
		};
	});
</script>

<div class="flex items-start gap-4 rounded-lg border bg-card p-4">
	<!-- Content -->
	<div class="min-w-0 flex-1">
		<div class="mb-2 flex items-center gap-2">
			<h3 class="truncate font-medium">{announcement.title}</h3>
			<Badge variant={isDraft ? 'secondary' : 'default'}>
				{isDraft ? m['announcements.card.draft']() : m['announcements.card.sent']()}
			</Badge>
		</div>

		<div class="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground">
			<!-- Target -->
			<div class="flex items-center gap-1.5">
				<targetInfo.icon class="h-4 w-4" aria-hidden="true" />
				<span>{targetInfo.text}</span>
			</div>

			<!-- Date -->
			{#if isDraft}
				<span
					>{m['announcements.card.createdAt']({
						date: formatRelativeTime(announcement.created_at)
					})}</span
				>
			{:else if announcement.sent_at}
				<span
					>{m['announcements.card.sentAt']({
						date: formatRelativeTime(announcement.sent_at)
					})}</span
				>
			{/if}

			<!-- Recipient count (only for sent) -->
			{#if !isDraft && announcement.recipient_count && announcement.recipient_count > 0}
				<span
					>{m['announcements.card.recipients']({
						count: String(announcement.recipient_count)
					})}</span
				>
			{/if}
		</div>
	</div>

	<!-- Actions -->
	<div class="flex shrink-0 items-center gap-2">
		{#if isDraft}
			<!-- Quick actions for drafts -->
			<Button variant="outline" size="sm" onclick={onEdit} disabled={isLoadingEdit}>
				{#if isLoadingEdit}
					<Loader2 class="mr-1.5 h-4 w-4 animate-spin" aria-hidden="true" />
				{:else}
					<Edit class="mr-1.5 h-4 w-4" aria-hidden="true" />
				{/if}
				{m['announcements.edit']()}
			</Button>
			<Button variant="default" size="sm" onclick={onSend}>
				<Send class="mr-1.5 h-4 w-4" aria-hidden="true" />
				{m['announcements.send']()}
			</Button>
		{:else}
			<!-- Quick action for sent announcements -->
			<Button variant="outline" size="sm" onclick={onView}>
				<Eye class="mr-1.5 h-4 w-4" aria-hidden="true" />
				{m['announcements.view']()}
			</Button>
		{/if}

		<!-- Dropdown for additional actions -->
		<DropdownMenu.Root>
			<DropdownMenu.Trigger>
				{#snippet child({ props })}
					<Button variant="ghost" size="icon" {...props}>
						<MoreHorizontal class="h-4 w-4" />
						<span class="sr-only">More actions</span>
					</Button>
				{/snippet}
			</DropdownMenu.Trigger>
			<DropdownMenu.Content align="end">
				{#if isDraft}
					<DropdownMenu.Item onclick={onView}>
						<Eye class="mr-2 h-4 w-4" />
						{m['announcements.view']()}
					</DropdownMenu.Item>
					<DropdownMenu.Item onclick={onEdit}>
						<Edit class="mr-2 h-4 w-4" />
						{m['announcements.edit']()}
					</DropdownMenu.Item>
					<DropdownMenu.Item onclick={onSend}>
						<Send class="mr-2 h-4 w-4" />
						{m['announcements.send']()}
					</DropdownMenu.Item>
					<DropdownMenu.Separator />
					<DropdownMenu.Item onclick={onDelete} class="text-destructive focus:text-destructive">
						<Trash2 class="mr-2 h-4 w-4" />
						{m['announcements.delete']()}
					</DropdownMenu.Item>
				{:else}
					<!-- Sent announcements - view only -->
					<DropdownMenu.Item onclick={onView}>
						<Eye class="mr-2 h-4 w-4" />
						{m['announcements.view']()}
					</DropdownMenu.Item>
				{/if}
			</DropdownMenu.Content>
		</DropdownMenu.Root>
	</div>
</div>
