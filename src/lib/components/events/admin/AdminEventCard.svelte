<script lang="ts">
	import * as m from '$lib/paraglide/messages.js';
	import { goto } from '$app/navigation';
	import type { EventInListSchema } from '$lib/api/generated/types.gen';
	import { cn } from '$lib/utils/cn';
	import { formatDateTime } from '$lib/utils/date';
	import { getEventStatusColor } from '$lib/utils/status-colors';
	import EventCoverImage from '$lib/components/events/EventCoverImage.svelte';
	import * as DropdownMenu from '$lib/components/ui/dropdown-menu';
	import {
		Calendar,
		MapPin,
		Users,
		Edit,
		Eye,
		Trash2,
		CheckCircle,
		XCircle,
		UserCheck,
		Mail,
		ListPlus,
		Ban,
		MoreVertical,
		Copy
	} from 'lucide-svelte';

	type CardVariant = 'draft' | 'open' | 'closed' | 'cancelled';

	interface Props {
		event: EventInListSchema;
		organizationSlug: string;
		variant: CardVariant;
		onPublish?: (eventId: string) => void;
		onClose?: (eventId: string) => void;
		onCancel?: (eventId: string) => void;
		onReopen?: (eventId: string) => void;
		onDelete?: (eventId: string) => void;
		onDuplicate?: (event: EventInListSchema) => void;
	}

	const {
		event,
		organizationSlug,
		variant,
		onPublish,
		onClose,
		onCancel,
		onReopen,
		onDelete,
		onDuplicate
	}: Props = $props();

	const faded = $derived(variant === 'closed' || variant === 'cancelled');

	const statusLabel = $derived.by(() => {
		switch (variant) {
			case 'draft':
				return m['orgAdmin.events.status.draft']();
			case 'open':
				return m['orgAdmin.events.status.published']();
			case 'closed':
				return m['orgAdmin.events.status.closed']();
			case 'cancelled':
				return m['orgAdmin.events.status.cancelled']();
		}
	});

	const showAttendeeCount = $derived(variant !== 'draft' && event.attendee_count !== undefined);

	const showEdit = $derived(variant === 'draft' || variant === 'open');
	const showManagement = $derived(variant !== 'draft');

	function viewEvent(): void {
		goto(`/events/${organizationSlug}/${event.slug}`);
	}

	function editEvent(): void {
		goto(`/org/${organizationSlug}/admin/events/${event.id}/edit`);
	}

	function manageTickets(): void {
		goto(`/org/${organizationSlug}/admin/events/${event.id}/tickets`);
	}

	function manageAttendees(): void {
		goto(`/org/${organizationSlug}/admin/events/${event.id}/attendees`);
	}

	function manageInvitations(): void {
		goto(`/org/${organizationSlug}/admin/events/${event.id}/invitations`);
	}

	function manageWaitlist(): void {
		goto(`/org/${organizationSlug}/admin/events/${event.id}/waitlist`);
	}
</script>

<div
	class={cn(
		'flex flex-col overflow-hidden rounded-lg border border-border bg-card shadow-sm transition-shadow hover:shadow-md',
		faded && 'opacity-75'
	)}
>
	<!-- Cover Image -->
	<EventCoverImage {event} />

	<!-- Card Content -->
	<div class="flex flex-1 flex-col gap-3 p-4">
		<!-- Header -->
		<div class="flex items-start justify-between gap-2">
			<h3 class="flex-1 font-semibold">{event.name}</h3>
			<div class="flex items-center gap-2">
				<span
					class={cn(
						'rounded-full px-2 py-1 text-xs font-medium',
						getEventStatusColor(event.status)
					)}
				>
					{statusLabel}
				</span>
				<!-- More Actions Dropdown -->
				<DropdownMenu.Root>
					<DropdownMenu.Trigger>
						{#snippet child({ props })}
							<button
								{...props}
								type="button"
								class="rounded-md p-1 text-muted-foreground hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
								aria-label={m['orgAdmin.events.actions.moreActions']()}
							>
								<MoreVertical class="h-4 w-4" aria-hidden="true" />
							</button>
						{/snippet}
					</DropdownMenu.Trigger>
					<DropdownMenu.Content align="end" class="w-48">
						<DropdownMenu.Item onclick={() => onDuplicate?.(event)}>
							<Copy class="mr-2 h-4 w-4" />
							{m['orgAdmin.events.actions.duplicate']()}
						</DropdownMenu.Item>
						<DropdownMenu.Separator />
						{#if variant === 'open' && onClose}
							<DropdownMenu.Item
								onclick={() => onClose(event.id)}
								class="text-red-600 focus:text-red-600"
							>
								<XCircle class="mr-2 h-4 w-4" />
								{m['orgAdmin.events.actions.close']()}
							</DropdownMenu.Item>
						{/if}
						{#if variant !== 'cancelled' && onCancel}
							<DropdownMenu.Item
								onclick={() => onCancel(event.id)}
								class="text-orange-600 focus:text-orange-600"
							>
								<Ban class="mr-2 h-4 w-4" />
								{m['orgAdmin.events.actions.cancel']()}
							</DropdownMenu.Item>
						{/if}
						{#if onDelete}
							<DropdownMenu.Item
								onclick={() => onDelete(event.id)}
								class="text-destructive focus:text-destructive"
							>
								<Trash2 class="mr-2 h-4 w-4" />
								{m['orgAdmin.events.actions.delete']()}
							</DropdownMenu.Item>
						{/if}
					</DropdownMenu.Content>
				</DropdownMenu.Root>
			</div>
		</div>

		<!-- Event details -->
		<div class="space-y-2 text-sm text-muted-foreground">
			<div class="flex items-center gap-2">
				<Calendar class="h-4 w-4" aria-hidden="true" />
				{formatDateTime(event.start)}
			</div>
			{#if event.city}
				<div class="flex items-center gap-2">
					<MapPin class="h-4 w-4" aria-hidden="true" />
					{event.city.name}, {event.city.country}
				</div>
			{/if}
			{#if showAttendeeCount}
				<div class="flex items-center gap-2">
					<Users class="h-4 w-4" aria-hidden="true" />
					{event.attendee_count}
					{event.requires_ticket
						? m['orgAdmin.events.attendeeCount.attendees']()
						: m['orgAdmin.events.attendeeCount.rsvps']()}
				</div>
			{/if}
		</div>

		<!-- Actions -->
		<div class="flex flex-wrap gap-2 border-t border-border pt-3">
			<button
				type="button"
				onclick={viewEvent}
				class="inline-flex items-center gap-1 rounded-md bg-secondary px-3 py-1 text-sm font-medium text-secondary-foreground transition-colors hover:bg-secondary/80"
			>
				<Eye class="h-4 w-4" aria-hidden="true" />
				{variant === 'draft'
					? m['orgAdmin.events.actions.preview']()
					: m['orgAdmin.events.actions.view']()}
			</button>
			{#if showEdit}
				<button
					type="button"
					onclick={editEvent}
					class="inline-flex items-center gap-1 rounded-md bg-secondary px-3 py-1 text-sm font-medium text-secondary-foreground transition-colors hover:bg-secondary/80"
				>
					<Edit class="h-4 w-4" aria-hidden="true" />
					{m['orgAdmin.events.actions.edit']()}
				</button>
			{/if}
			{#if variant === 'draft' && onPublish}
				<button
					type="button"
					onclick={() => onPublish(event.id)}
					class="inline-flex items-center gap-1 rounded-md bg-green-600 px-3 py-1 text-sm font-medium text-white transition-colors hover:bg-green-700"
				>
					<CheckCircle class="h-4 w-4" aria-hidden="true" />
					{m['orgAdmin.events.actions.publish']()}
				</button>
			{/if}
			{#if showManagement}
				{#if event.requires_ticket}
					<button
						type="button"
						onclick={manageTickets}
						class="inline-flex items-center gap-1 rounded-md bg-blue-600 px-3 py-1 text-sm font-medium text-white transition-colors hover:bg-blue-700"
					>
						<UserCheck class="h-4 w-4" aria-hidden="true" />
						{m['orgAdmin.events.actions.tickets']()}
					</button>
				{:else}
					<button
						type="button"
						onclick={manageAttendees}
						class="inline-flex items-center gap-1 rounded-md bg-blue-600 px-3 py-1 text-sm font-medium text-white transition-colors hover:bg-blue-700"
					>
						<UserCheck class="h-4 w-4" aria-hidden="true" />
						{m['orgAdmin.events.actions.attendees']()}
					</button>
				{/if}
				<button
					type="button"
					onclick={manageInvitations}
					class="inline-flex items-center gap-1 rounded-md bg-purple-600 px-3 py-1 text-sm font-medium text-white transition-colors hover:bg-purple-700"
				>
					<Mail class="h-4 w-4" aria-hidden="true" />
					{m['orgAdmin.events.actions.invitations']()}
				</button>
				{#if event.waitlist_open}
					<button
						type="button"
						onclick={manageWaitlist}
						class="inline-flex items-center gap-1 rounded-md bg-amber-600 px-3 py-1 text-sm font-medium text-white transition-colors hover:bg-amber-700"
					>
						<ListPlus class="h-4 w-4" aria-hidden="true" />
						{m['orgAdmin.events.actions.waitlist']()}
					</button>
				{/if}
			{/if}
			{#if (variant === 'closed' || variant === 'cancelled') && onReopen}
				<button
					type="button"
					onclick={() => onReopen(event.id)}
					class="inline-flex items-center gap-1 rounded-md bg-green-600 px-3 py-1 text-sm font-medium text-white transition-colors hover:bg-green-700"
				>
					<CheckCircle class="h-4 w-4" aria-hidden="true" />
					{m['orgAdmin.events.actions.reopen']()}
				</button>
			{/if}
		</div>
	</div>
</div>
