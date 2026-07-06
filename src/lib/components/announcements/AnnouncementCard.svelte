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
		CalendarOff,
		Loader2
	} from '@lucide/svelte';
	import * as DropdownMenu from '$lib/components/ui/dropdown-menu';
	import { formatRelativeTime } from '$lib/utils/time';

	interface Props {
		announcement: AnnouncementListSchema;
		isLoadingEdit?: boolean;
		onView?: () => void;
		onEdit?: () => void;
		onDelete?: () => void;
		onSend?: () => void;
		onUnschedule?: () => void;
	}

	const {
		announcement,
		isLoadingEdit = false,
		onView,
		onEdit,
		onDelete,
		onSend,
		onUnschedule
	}: Props = $props();

	const isDraft = $derived(announcement.status === 'draft');
	const isScheduled = $derived(announcement.status === 'scheduled');

	// Determine target description
	const targetInfo = $derived.by(() => {
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
			<Badge variant={isDraft ? 'secondary' : isScheduled ? 'outline' : 'default'}>
				{#if isDraft}
					{m['announcements.card.draft']()}
				{:else if isScheduled}
					{m['announcements.card.scheduled']()}
				{:else}
					{m['announcements.card.sent']()}
				{/if}
			</Badge>
		</div>

		<div class="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground">
			<!-- Target / audience -->
			<Badge variant="outline" class="gap-1.5 font-normal">
				<targetInfo.icon class="h-3.5 w-3.5" aria-hidden="true" />
				<span>{targetInfo.text}</span>
			</Badge>

			<!-- Date -->
			{#if isScheduled}
				{#if announcement.scheduled_at}
					<span
						>{m['announcements.card.scheduledFor']({
							date: formatRelativeTime(announcement.scheduled_at)
						})}</span
					>
				{:else}
					<span>{m['announcements.card.scheduledRelative']()}</span>
				{/if}
			{:else if isDraft}
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
			{#if announcement.status === 'sent' && announcement.recipient_count && announcement.recipient_count > 0}
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
		{:else if isScheduled}
			<!-- Quick actions for scheduled announcements -->
			<Button variant="outline" size="sm" onclick={onEdit} disabled={isLoadingEdit}>
				{#if isLoadingEdit}
					<Loader2 class="mr-1.5 h-4 w-4 animate-spin" aria-hidden="true" />
				{:else}
					<Edit class="mr-1.5 h-4 w-4" aria-hidden="true" />
				{/if}
				{m['announcements.edit']()}
			</Button>
			<Button variant="outline" size="sm" onclick={onUnschedule}>
				<CalendarOff class="mr-1.5 h-4 w-4" aria-hidden="true" />
				{m['announcements.unschedule']()}
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
						<span class="sr-only">{m['announcementCard.moreActions']()}</span>
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
				{:else if isScheduled}
					<DropdownMenu.Item onclick={onView}>
						<Eye class="mr-2 h-4 w-4" />
						{m['announcements.view']()}
					</DropdownMenu.Item>
					<DropdownMenu.Item onclick={onEdit}>
						<Edit class="mr-2 h-4 w-4" />
						{m['announcements.edit']()}
					</DropdownMenu.Item>
					<DropdownMenu.Item onclick={onUnschedule}>
						<CalendarOff class="mr-2 h-4 w-4" />
						{m['announcements.unschedule']()}
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
