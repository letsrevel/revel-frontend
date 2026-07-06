<script lang="ts">
	import * as m from '$lib/paraglide/messages.js';
	import type { NotificationSchema, NotificationType } from '$lib/api/generated/types.gen';
	import { notificationListNotifications, notificationMarkAllRead } from '$lib/api/generated';
	import { createQuery, createMutation, useQueryClient } from '@tanstack/svelte-query';
	import { Button } from '$lib/components/ui/button';
	import { Badge } from '$lib/components/ui/badge';
	import { Card } from '$lib/components/ui/card';
	import { Select, SelectContent, SelectItem, SelectTrigger } from '$lib/components/ui/select';
	import { CheckCheck, Filter, BellOff, Loader2 } from '@lucide/svelte';
	import { cn } from '$lib/utils/cn';
	import { toast } from 'svelte-sonner';
	import NotificationItem from './NotificationItem.svelte';

	interface Props {
		authToken: string;
		compact?: boolean;
		maxItems?: number;
		class?: string;
		onNavigate?: () => void;
	}

	const {
		authToken,
		compact = false,
		maxItems = 5,
		class: className,
		onNavigate
	}: Props = $props();

	// Query client for invalidation
	const queryClient = useQueryClient();

	// State
	let unreadOnly = $state(false);
	let notificationType = $state<NotificationType | null>(null);
	let currentPage = $state(1);
	const pageSize = compact ? maxItems : 20;

	// Query key
	const queryKey = $derived([
		'notifications',
		{ unread_only: unreadOnly, notification_type: notificationType, page: currentPage }
	]);

	// Fetch notifications
	const notificationsQuery = createQuery(() => ({
		queryKey,
		queryFn: async () => {
			return await notificationListNotifications({
				query: {
					unread_only: unreadOnly || undefined,
					notification_type: notificationType || undefined,
					page: currentPage,
					page_size: pageSize
				},
				headers: { Authorization: `Bearer ${authToken}` }
			});
		}
	}));

	// Derived values
	const notifications = $derived(notificationsQuery.data?.data?.results ?? []);
	const totalCount = $derived(notificationsQuery.data?.data?.count ?? 0);
	const totalPages = $derived(Math.ceil(totalCount / pageSize));
	const hasUnread = $derived(notifications.some((n) => n.read_at === null));
	const isLoading = $derived(notificationsQuery.isLoading);
	const isError = $derived(notificationsQuery.isError);
	const selectedTypeLabel = $derived(notificationType || m['notificationList.allTypes']());

	// Mark all as read mutation
	const markAllReadMutation = createMutation(() => ({
		mutationFn: async () => {
			return await notificationMarkAllRead({
				headers: { Authorization: `Bearer ${authToken}` }
			});
		},
		onSuccess: () => {
			// Invalidate all notification-related queries to trigger refetch
			queryClient.invalidateQueries({ queryKey: ['notifications'], refetchType: 'active' });
			toast.success(m['notificationList.toast_allMarkedRead']());
		},
		onError: (error) => {
			toast.error(m['notificationList.toast_markAllFailed']());
			console.error('Failed to mark all as read:', error);
		}
	}));

	// Handlers
	function handleFilterToggle(): void {
		unreadOnly = !unreadOnly;
		currentPage = 1; // Reset to first page when filter changes
	}

	function handleTypeFilterChange(value: string): void {
		notificationType = value === 'all' ? null : (value as NotificationType);
		currentPage = 1;
	}

	function handlePageChange(page: number): void {
		currentPage = page;
	}

	function handleMarkAllRead(): void {
		if (!hasUnread) return;

		markAllReadMutation.mutate();
	}

	function handleStatusChange(_updatedNotification: NotificationSchema): void {
		// Invalidate the query to refetch
		queryClient.invalidateQueries({ queryKey: ['notifications'] });
	}

	// Get unique notification types from current results
	const notificationTypes = $derived.by(() => {
		if (!notifications || notifications.length === 0) return [];
		const types = new Set(notifications.map((n) => n.notification_type));
		return Array.from(types).sort();
	});

	// Empty state messages
	const emptyMessage = $derived.by(() => {
		if (unreadOnly) {
			return m['notificationList.emptyUnread']();
		}
		return m['notificationList.emptyAll']();
	});
</script>

<div
	class={cn(
		'notification-list flex flex-col',
		compact ? 'max-h-[400px]' : 'min-h-[400px]',
		className
	)}
	role="region"
	aria-label={m['notificationList.regionAriaLabel']()}
	aria-live="polite"
>
	<!-- Header with filters and actions -->
	{#if !compact}
		<div class="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
			<!-- Left side: Filters -->
			<div class="flex flex-wrap items-center gap-2">
				<!-- Unread toggle -->
				<Button
					variant={unreadOnly ? 'default' : 'outline'}
					size="sm"
					onclick={handleFilterToggle}
					aria-pressed={unreadOnly}
					class="text-xs transition-all {unreadOnly
						? 'bg-primary text-primary-foreground hover:bg-primary/90'
						: 'hover:bg-accent hover:text-accent-foreground'}"
				>
					<Filter class="mr-1.5 h-3.5 w-3.5" aria-hidden="true" />
					{unreadOnly
						? m['notificationList.showingUnreadOnly']()
						: m['notificationList.showUnreadOnly']()}
				</Button>

				<!-- Type filter (only show if we have notifications) -->
				{#if notificationTypes.length > 0}
					<Select
						type="single"
						onValueChange={handleTypeFilterChange}
						value={notificationType || 'all'}
					>
						<SelectTrigger class="h-8 w-[180px] text-xs">
							{selectedTypeLabel}
						</SelectTrigger>
						<SelectContent>
							<SelectItem value="all">{m['notificationList.allTypes']()}</SelectItem>
							{#each notificationTypes as type (type)}
								<SelectItem value={type}>{type}</SelectItem>
							{/each}
						</SelectContent>
					</Select>
				{/if}

				<!-- Count badge -->
				{#if totalCount > 0}
					<Badge variant="secondary" class="ml-1 text-xs">
						{totalCount === 1
							? m['notificationList.countSingular']({ count: totalCount })
							: m['notificationList.countPlural']({ count: totalCount })}
						{#if unreadOnly}
							<span class="sr-only">{m['notificationList.unreadSrLabel']()}</span>
						{/if}
					</Badge>
				{/if}
			</div>

			<!-- Right side: Actions -->
			<div class="flex items-center gap-2">
				{#if hasUnread}
					<Button
						variant="ghost"
						size="sm"
						onclick={handleMarkAllRead}
						disabled={markAllReadMutation.isPending}
						aria-label={m['notificationList.markAllAsRead']()}
						class="text-xs"
					>
						{#if markAllReadMutation.isPending}
							<Loader2 class="mr-1.5 h-3.5 w-3.5 animate-spin" aria-hidden="true" />
						{:else}
							<CheckCheck class="mr-1.5 h-3.5 w-3.5" aria-hidden="true" />
						{/if}
						{m['notificationList.markAllAsRead']()}
					</Button>
				{/if}
			</div>
		</div>
	{/if}

	<!-- Notifications list -->
	<div
		class={cn(
			'flex-1',
			compact && 'overflow-y-auto',
			'scrollbar-thin scrollbar-thumb-muted scrollbar-track-transparent'
		)}
	>
		{#if isLoading}
			<!-- Skeleton loaders -->
			<div class="space-y-3" role="status" aria-label={m['notificationList.loading']()}>
				{#each Array(compact ? 3 : 5) as _, i (i)}
					<Card class="p-4 md:p-6">
						<div class="flex animate-pulse items-start gap-3">
							<!-- Indicator skeleton -->
							<div class="mt-1 h-2.5 w-2.5 shrink-0 rounded-full bg-muted"></div>

							<!-- Content skeleton -->
							<div class="flex-1 space-y-2">
								<div class="flex items-start justify-between gap-2">
									<div class="flex-1 space-y-2">
										<div class="h-4 w-3/4 rounded bg-muted"></div>
										<div class="h-3 w-20 rounded bg-muted"></div>
									</div>
									<div class="h-3 w-16 rounded bg-muted"></div>
								</div>
								<div class="space-y-1.5">
									<div class="h-3 w-full rounded bg-muted"></div>
									<div class="h-3 w-5/6 rounded bg-muted"></div>
								</div>
							</div>

							<!-- Action skeleton -->
							<div class="h-8 w-8 shrink-0 rounded bg-muted"></div>
						</div>
					</Card>
				{/each}
				<span class="sr-only">{m['notificationList.loadingEllipsis']()}</span>
			</div>
		{:else if isError}
			<!-- Error state -->
			<Card class="p-8 text-center">
				<div class="flex flex-col items-center gap-3">
					<BellOff class="h-12 w-12 text-muted-foreground" aria-hidden="true" />
					<div>
						<h3 class="text-lg font-semibold">{m['notificationList.errorTitle']()}</h3>
						<p class="mt-1 text-sm text-muted-foreground">
							{m['notificationList.errorBody']()}
						</p>
					</div>
					<Button
						variant="outline"
						size="sm"
						onclick={() => queryClient.invalidateQueries({ queryKey: ['notifications'] })}
					>
						{m['notificationList.tryAgain']()}
					</Button>
				</div>
			</Card>
		{:else if notifications.length === 0}
			<!-- Empty state -->
			<Card class="p-8 text-center">
				<div class="flex flex-col items-center gap-3">
					<BellOff class="h-12 w-12 text-muted-foreground" aria-hidden="true" />
					<div>
						<h3 class="text-lg font-semibold">{emptyMessage}</h3>
						<p class="mt-1 text-sm text-muted-foreground">
							{#if unreadOnly}
								{m['notificationList.emptyUnreadBody']()}
							{:else}
								{m['notificationList.emptyAllBody']()}
							{/if}
						</p>
					</div>
					{#if unreadOnly}
						<Button variant="outline" size="sm" onclick={handleFilterToggle}>
							{m['notificationList.showAllNotifications']()}
						</Button>
					{/if}
				</div>
			</Card>
		{:else}
			<!-- Notifications -->
			<div
				class="space-y-3"
				role="list"
				aria-label={notifications.length === 1
					? m['notificationList.countSingular']({ count: notifications.length })
					: m['notificationList.countPlural']({ count: notifications.length })}
			>
				{#each notifications as notification (notification.id)}
					<div role="listitem">
						<NotificationItem
							{notification}
							{authToken}
							onStatusChange={handleStatusChange}
							{compact}
							{onNavigate}
						/>
					</div>
				{/each}
			</div>
		{/if}
	</div>

	<!-- Pagination (not in compact mode) -->
	{#if !compact && !isLoading && !isError && notifications.length > 0 && totalPages > 1}
		<div
			class="mt-4 flex items-center justify-center gap-2"
			role="navigation"
			aria-label={m['notificationList.pagination']()}
		>
			<!-- Previous button -->
			<Button
				variant="outline"
				size="sm"
				onclick={() => handlePageChange(currentPage - 1)}
				disabled={currentPage === 1}
				aria-label={m['notificationList.previousPage']()}
			>
				{m['notificationList.previous']()}
			</Button>

			<!-- Page numbers -->
			<div class="flex items-center gap-1">
				{#each Array(totalPages) as _, i (i)}
					{@const page = i + 1}
					{#if page === 1 || page === totalPages || (page >= currentPage - 1 && page <= currentPage + 1)}
						<Button
							variant={page === currentPage ? 'default' : 'outline'}
							size="sm"
							onclick={() => handlePageChange(page)}
							aria-label={m['notificationList.page']({ page })}
							aria-current={page === currentPage ? 'page' : undefined}
							class="h-8 w-8 p-0"
						>
							{page}
						</Button>
					{:else if page === currentPage - 2 || page === currentPage + 2}
						<span class="px-1 text-muted-foreground" aria-hidden="true">...</span>
					{/if}
				{/each}
			</div>

			<!-- Next button -->
			<Button
				variant="outline"
				size="sm"
				onclick={() => handlePageChange(currentPage + 1)}
				disabled={currentPage === totalPages}
				aria-label={m['notificationList.nextPage']()}
			>
				{m['notificationList.next']()}
			</Button>
		</div>
	{/if}
</div>

<style>
	/* Custom scrollbar for compact mode */
	.scrollbar-thin {
		scrollbar-width: thin;
	}

	.scrollbar-thumb-muted::-webkit-scrollbar-thumb {
		background-color: hsl(var(--muted));
		border-radius: 0.25rem;
	}

	.scrollbar-track-transparent::-webkit-scrollbar-track {
		background-color: transparent;
	}

	.scrollbar-thin::-webkit-scrollbar {
		width: 6px;
		height: 6px;
	}
</style>
