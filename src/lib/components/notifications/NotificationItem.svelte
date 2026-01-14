<script lang="ts">
	import * as m from '$lib/paraglide/messages.js';
	import type { NotificationSchema } from '$lib/api/generated/types.gen';
	import { notificationMarkRead, notificationMarkUnread } from '$lib/api/generated';
	import { Card } from '$lib/components/ui/card';
	import { Button } from '$lib/components/ui/button';
	import { Badge } from '$lib/components/ui/badge';
	import { Circle, Check, X, Clock } from 'lucide-svelte';
	import { formatRelativeTime } from '$lib/utils/time';
	import { goto } from '$app/navigation';
	import { createMutation } from '@tanstack/svelte-query';
	import { toast } from 'svelte-sonner';
	import { cn } from '$lib/utils/cn';
	import MarkdownContent from '$lib/components/common/MarkdownContent.svelte';

	interface Props {
		notification: NotificationSchema;
		authToken: string;
		onStatusChange?: (notification: NotificationSchema) => void;
		onNavigate?: () => void;
		compact?: boolean;
		class?: string;
	}

	let {
		notification,
		authToken,
		onStatusChange,
		onNavigate,
		compact = false,
		class: className
	}: Props = $props();

	// Reactive state for optimistic updates
	let isRead = $state(notification.read_at !== null);

	// Derived values
	let relativeTime = $derived(formatRelativeTime(notification.created_at));

	// Mark as read mutation
	let markReadMutation = createMutation(() => ({
		mutationFn: async () => {
			return await notificationMarkRead({
				path: { notification_id: notification.id },
				headers: { Authorization: `Bearer ${authToken}` }
			});
		},
		onMutate: () => {
			// Optimistic update
			isRead = true;
		},
		onSuccess: (data: any) => {
			// Update the notification with the new read_at value
			const updatedNotification = {
				...notification,
				read_at: data.data?.read_at || new Date().toISOString()
			};
			onStatusChange?.(updatedNotification);
		},
		onError: (error: any) => {
			// Revert optimistic update
			isRead = false;
			toast.error('Failed to mark notification as read');
			console.error('Failed to mark notification as read:', error);
		}
	}));

	// Mark as unread mutation
	let markUnreadMutation = createMutation(() => ({
		mutationFn: async () => {
			return await notificationMarkUnread({
				path: { notification_id: notification.id },
				headers: { Authorization: `Bearer ${authToken}` }
			});
		},
		onMutate: () => {
			// Optimistic update
			isRead = false;
		},
		onSuccess: () => {
			// Update the notification with read_at set to null
			const updatedNotification = {
				...notification,
				read_at: null
			};
			onStatusChange?.(updatedNotification);
		},
		onError: (error: any) => {
			// Revert optimistic update
			isRead = true;
			toast.error('Failed to mark notification as unread');
			console.error('Failed to mark notification as unread:', error);
		}
	}));

	// Toggle read/unread status
	function toggleReadStatus(event: MouseEvent): void {
		event.stopPropagation();

		if (isRead) {
			markUnreadMutation.mutate();
		} else {
			markReadMutation.mutate();
		}
	}

	// Handle navigation to related content
	function handleClick(event: MouseEvent): void {
		// Check if the click was on a link inside the notification body
		// If so, let the link handle its own navigation
		const target = event.target as HTMLElement;
		if (target.tagName === 'A' || target.closest('a')) {
			// Mark as read but don't navigate - let the link handle it
			if (!isRead) {
				markReadMutation.mutate();
			}
			// Close the dropdown if callback provided
			onNavigate?.();
			return;
		}

		// Mark as read on click (if not already)
		if (!isRead) {
			markReadMutation.mutate();
		}

		// Extract URL from context if available
		const url = extractUrlFromContext(notification.context);
		if (url) {
			// Close the dropdown before navigating
			onNavigate?.();
			goto(url);
		} else {
			// Fallback: navigate to notifications page
			onNavigate?.();
			goto('/account/notifications');
		}
	}

	// Convert absolute URL to relative path for SvelteKit navigation
	function toRelativePath(url: string): string {
		// If it's already a relative path, return as-is
		if (url.startsWith('/')) {
			return url;
		}

		// Try to parse as URL and extract pathname
		try {
			const parsed = new URL(url);
			// Return the pathname (and search/hash if present)
			return parsed.pathname + parsed.search + parsed.hash;
		} catch {
			// If parsing fails, return original (might be a relative path without leading /)
			return url.startsWith('/') ? url : `/${url}`;
		}
	}

	// Extract URL from notification context
	function extractUrlFromContext(context: Record<string, unknown>): string | null {
		// Backend provides frontend_url with correct routing
		if (context.frontend_url && typeof context.frontend_url === 'string') {
			return toRelativePath(context.frontend_url);
		}

		// Check for submission_url (questionnaire notifications) - prioritize this for admin actions
		if (context.submission_url && typeof context.submission_url === 'string') {
			return toRelativePath(context.submission_url);
		}

		// Check for event_url (provided in many notification contexts)
		if (context.event_url && typeof context.event_url === 'string') {
			return toRelativePath(context.event_url);
		}

		// Fallback to context patterns for older notifications
		if (context.event_id) {
			return `/events/${context.event_id}`;
		}
		if (context.org_slug) {
			return `/org/${context.org_slug}`;
		}
		if (context.invitation_id) {
			return `/invitations/${context.invitation_id}`;
		}
		if (context.url && typeof context.url === 'string') {
			return toRelativePath(context.url);
		}
		return null;
	}

	// Compute notification type badge variant
	let notificationTypeVariant = $derived.by(() => {
		const type = notification.notification_type.toLowerCase();
		if (type.includes('invitation')) return 'default' as const;
		if (type.includes('event')) return 'secondary' as const;
		if (type.includes('rsvp')) return 'outline' as const;
		return 'secondary' as const;
	});
</script>

<Card
	class={cn(
		'group cursor-pointer overflow-hidden transition-all hover:shadow-md',
		!isRead && 'border-l-4 border-l-primary bg-primary/5',
		compact ? 'p-3' : 'p-4 md:p-6',
		className
	)}
	role="button"
	tabindex={0}
	onclick={(e) => handleClick(e)}
	onkeydown={(e) => {
		if (e.key === 'Enter' || e.key === ' ') {
			e.preventDefault();
			handleClick(e as unknown as MouseEvent);
		}
	}}
	aria-label={`${notification.title}. ${isRead ? 'Read' : 'Unread'}. Click to view details.`}
>
	<div class="flex items-start gap-3">
		<!-- Unread indicator -->
		<div class="shrink-0 pt-1" aria-hidden="true">
			{#if !isRead}
				<Circle class="h-2.5 w-2.5 fill-primary text-primary" />
			{:else}
				<div class="h-2.5 w-2.5"></div>
			{/if}
		</div>

		<!-- Notification content -->
		<div class="min-w-0 flex-1">
			<!-- Header with title and badge -->
			<div class="mb-2 flex flex-wrap items-start justify-between gap-2">
				<div class="min-w-0 flex-1">
					<h3 class={cn('text-base font-semibold leading-tight', !isRead && 'font-bold')}>
						{notification.title}
					</h3>
					<Badge variant={notificationTypeVariant} class="mt-1 text-xs">
						{notification.notification_type}
					</Badge>
				</div>

				<!-- Timestamp -->
				<div class="flex items-center gap-1.5 text-xs text-muted-foreground">
					<Clock class="h-3.5 w-3.5" aria-hidden="true" />
					<time datetime={notification.created_at}>{relativeTime}</time>
				</div>
			</div>

			<!-- Body content -->
			<MarkdownContent
				content={notification.body}
				class={cn('text-sm text-muted-foreground', compact && 'line-clamp-2')}
			/>
		</div>

		<!-- Action button -->
		<div class="shrink-0">
			<Button
				variant="ghost"
				size="sm"
				onclick={toggleReadStatus}
				disabled={markReadMutation.isPending || markUnreadMutation.isPending}
				aria-label={isRead ? 'Mark as unread' : 'Mark as read'}
				class="h-8 w-8 p-0"
			>
				{#if isRead}
					<X class="h-4 w-4" aria-hidden="true" />
				{:else}
					<Check class="h-4 w-4" aria-hidden="true" />
				{/if}
			</Button>
		</div>
	</div>
</Card>

<style>
	/* Ensure HTML content in body doesn't break layout */
	:global(.prose) {
		word-break: break-word;
		overflow-wrap: break-word;
	}

	/* Line clamp for compact mode */
	.line-clamp-2 {
		display: -webkit-box;
		-webkit-line-clamp: 2;
		line-clamp: 2;
		-webkit-box-orient: vertical;
		overflow: hidden;
	}
</style>
