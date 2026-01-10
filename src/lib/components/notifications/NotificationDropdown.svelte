<script lang="ts">
	import { Bell, CheckCheck } from 'lucide-svelte';
	import { goto } from '$app/navigation';
	import { Button } from '$lib/components/ui/button';
	import * as DropdownMenu from '$lib/components/ui/dropdown-menu';
	import NotificationBadge from './NotificationBadge.svelte';
	import NotificationList from './NotificationList.svelte';
	import * as m from '$lib/paraglide/messages.js';
	import { notificationMarkAllRead } from '$lib/api/generated';
	import { createMutation, useQueryClient } from '@tanstack/svelte-query';
	import { toast } from 'svelte-sonner';

	interface Props {
		authToken: string;
		pollingInterval?: number;
		maxItems?: number;
		class?: string;
	}

	let { authToken, pollingInterval = 60000, maxItems = 5, class: className }: Props = $props();

	const queryClient = useQueryClient();

	// Mark all as read mutation
	let markAllReadMutation = createMutation(() => ({
		mutationFn: async () => {
			return await notificationMarkAllRead({
				headers: { Authorization: `Bearer ${authToken}` }
			});
		},
		onSuccess: () => {
			// Invalidate notification queries to refresh the list
			queryClient.invalidateQueries({ queryKey: ['notifications'] });
			queryClient.invalidateQueries({ queryKey: ['unreadNotificationCount'] });
			toast.success(
				m['notificationList.markAllReadSuccess']?.() || 'All notifications marked as read'
			);
		},
		onError: () => {
			toast.error(m['notificationList.markAllReadError']?.() || 'Failed to mark all as read');
		}
	}));

	// Navigate to full notifications page
	function handleViewAll(): void {
		goto('/account/notifications');
	}

	function handleMarkAllRead(): void {
		markAllReadMutation.mutate();
	}
</script>

<DropdownMenu.Root>
	<DropdownMenu.Trigger>
		{#snippet child({ props })}
			<Button
				{...props}
				variant="ghost"
				size="icon"
				class="relative h-10 w-10"
				aria-label={m['notificationDropdown.openNotifications']?.() || 'Open notifications'}
			>
				<Bell class="h-5 w-5" aria-hidden="true" />
				<NotificationBadge {authToken} {pollingInterval} />
			</Button>
		{/snippet}
	</DropdownMenu.Trigger>

	<DropdownMenu.Content
		align="end"
		sideOffset={8}
		class="flex max-h-[80vh] w-[400px] max-w-[90vw] flex-col overflow-hidden p-0 md:max-h-[600px]"
	>
		<!-- Header -->
		<div class="flex shrink-0 items-center justify-between border-b px-4 py-3">
			<DropdownMenu.Label class="p-0 text-base font-semibold">
				{m['notificationDropdown.notifications']?.() || 'Notifications'}
			</DropdownMenu.Label>
			<Button
				variant="ghost"
				size="sm"
				onclick={handleMarkAllRead}
				disabled={markAllReadMutation.isPending}
				class="h-8 gap-1.5 px-2 text-xs text-muted-foreground hover:text-foreground"
				aria-label={m['notificationList.markAllAsRead']?.() || 'Mark all as read'}
			>
				<CheckCheck class="h-3.5 w-3.5" aria-hidden="true" />
				<span class="hidden sm:inline"
					>{m['notificationList.markAllAsRead']?.() || 'Mark all as read'}</span
				>
			</Button>
		</div>

		<!-- Notification List (compact mode) -->
		<div class="min-h-0 flex-1 overflow-y-auto">
			<NotificationList {authToken} compact={true} {maxItems} class="p-2" />
		</div>

		<!-- Footer with View All link -->
		<DropdownMenu.Separator />
		<div class="shrink-0">
			<DropdownMenu.Item
				onclick={handleViewAll}
				class="cursor-pointer justify-center rounded-none font-medium text-primary hover:text-primary"
			>
				{m['notificationDropdown.viewAll']?.() || 'View all notifications'}
			</DropdownMenu.Item>
		</div>
	</DropdownMenu.Content>
</DropdownMenu.Root>
