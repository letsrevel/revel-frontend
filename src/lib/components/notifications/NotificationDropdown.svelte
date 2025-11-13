<script lang="ts">
	import { Bell } from 'lucide-svelte';
	import { goto } from '$app/navigation';
	import { Button } from '$lib/components/ui/button';
	import * as DropdownMenu from '$lib/components/ui/dropdown-menu';
	import NotificationBadge from './NotificationBadge.svelte';
	import NotificationList from './NotificationList.svelte';
	import * as m from '$lib/paraglide/messages.js';

	interface Props {
		authToken: string;
		pollingInterval?: number;
		maxItems?: number;
		class?: string;
	}

	let { authToken, pollingInterval = 60000, maxItems = 5, class: className }: Props = $props();

	// Navigate to full notifications page
	function handleViewAll(): void {
		goto('/account/notifications');
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
		class="max-h-[600px] w-[400px] max-w-[90vw] overflow-hidden p-0"
	>
		<!-- Header -->
		<div class="border-b px-4 py-3">
			<DropdownMenu.Label class="p-0 text-base font-semibold">
				{m['notificationDropdown.notifications']?.() || 'Notifications'}
			</DropdownMenu.Label>
		</div>

		<!-- Notification List (compact mode) -->
		<div class="max-h-[500px] overflow-y-auto">
			<NotificationList {authToken} compact={true} {maxItems} class="p-2" />
		</div>

		<!-- Footer with View All link -->
		<DropdownMenu.Separator />
		<DropdownMenu.Item
			onclick={handleViewAll}
			class="cursor-pointer justify-center rounded-none font-medium text-primary hover:text-primary"
		>
			{m['notificationDropdown.viewAll']?.() || 'View all notifications'}
		</DropdownMenu.Item>
	</DropdownMenu.Content>
</DropdownMenu.Root>
