<script lang="ts">
	import * as m from '$lib/paraglide/messages.js';
	import type { NotificationSchema } from '$lib/api/generated/types.gen';
	import { notificationMarkRead, notificationMarkUnread } from '$lib/api/generated';
	import { Card } from '$lib/components/ui/card';
	import { Button } from '$lib/components/ui/button';
	import { Circle, Check, X, Clock, Ticket } from '@lucide/svelte';
	import { formatRelativeTime } from '$lib/utils/time';
	import { formatDateTime } from '$lib/utils/date';
	import { goto } from '$app/navigation';
	import { createMutation } from '@tanstack/svelte-query';
	import { toast } from 'svelte-sonner';
	import { cn } from '$lib/utils/cn';
	import MarkdownContent from '$lib/components/common/MarkdownContent.svelte';
	import OfferExpiryCountdown from '$lib/components/events/waitlist/OfferExpiryCountdown.svelte';

	interface Props {
		notification: NotificationSchema;
		authToken: string;
		onStatusChange?: (notification: NotificationSchema) => void;
		onNavigate?: () => void;
		compact?: boolean;
		class?: string;
	}

	const {
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
	const relativeTime = $derived(formatRelativeTime(notification.created_at));

	// Mark as read mutation
	const markReadMutation = createMutation(() => ({
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
		onSuccess: () => {
			// The mark-read endpoint returns no body, so set read_at locally
			const updatedNotification = {
				...notification,
				read_at: new Date().toISOString()
			};
			onStatusChange?.(updatedNotification);
		},
		onError: (error) => {
			// Revert optimistic update
			isRead = false;
			toast.error(m['notificationItem.toast_markReadFailed']());
			console.error('Failed to mark notification as read:', error);
		}
	}));

	// Mark as unread mutation
	const markUnreadMutation = createMutation(() => ({
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
		onError: (error) => {
			// Revert optimistic update
			isRead = true;
			toast.error(m['notificationItem.toast_markUnreadFailed']());
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

	// ===== Waitlist spot available =====
	const isWaitlistSpot = $derived(notification.notification_type === 'waitlist_spot_available');

	function readString(ctx: Record<string, unknown>, key: string): string | null {
		const v = ctx[key];
		return typeof v === 'string' && v.length > 0 ? v : null;
	}

	// Reactive clock — flips `expired` when the offer crosses its deadline so the
	// Claim CTA and styling stop misleading the user post-expiry.
	let waitlistNow = $state(Date.now());
	$effect(() => {
		if (!isWaitlistSpot) return;
		const expiresAt = readString(notification.context, 'expires_at');
		const targetMs = expiresAt ? Date.parse(expiresAt) : NaN;
		if (!Number.isFinite(targetMs)) return;
		if (Date.now() >= targetMs) return;
		const id = setInterval(() => {
			const next = Date.now();
			waitlistNow = next;
			if (next >= targetMs) clearInterval(id);
		}, 30_000);
		return () => clearInterval(id);
	});

	const waitlistSpotData = $derived.by(() => {
		if (!isWaitlistSpot) return null;
		const ctx = notification.context;
		const expiresAt = readString(ctx, 'expires_at');
		const expiresAtFormatted = readString(ctx, 'expires_at_formatted');
		const eventName = readString(ctx, 'event_name') ?? '';
		const claimUrl = extractUrlFromContext(ctx) ?? '/account/notifications';

		const expiresMs = expiresAt ? Date.parse(expiresAt) : NaN;
		const hasOffer = Number.isFinite(expiresMs);
		const expired = hasOffer ? expiresMs <= waitlistNow : false;

		// Localized absolute time string for the body. Prefer the
		// backend-provided pre-formatted string (already in event TZ); fall
		// back to client locale formatting if missing.
		let timeText = expiresAtFormatted ?? '';
		if (!timeText && expiresAt) {
			const d = new Date(expiresAt);
			if (!isNaN(d.getTime())) {
				timeText = formatDateTime(expiresAt);
			}
		}

		return {
			expiresAt,
			eventName,
			claimUrl,
			hasOffer,
			expired,
			timeText
		};
	});

	function handleClaim(event: MouseEvent): void {
		event.stopPropagation();
		const data = waitlistSpotData;
		if (!data) return;
		if (!isRead) {
			markReadMutation.mutate();
		}
		onNavigate?.();
		goto(data.claimUrl);
	}
</script>

<Card
	class={cn(
		'group cursor-pointer overflow-hidden transition-all hover:shadow-md',
		!isRead && 'border-l-4 border-l-primary bg-primary/5',
		isWaitlistSpot &&
			waitlistSpotData &&
			!waitlistSpotData.expired &&
			'border-l-4 border-l-amber-500 bg-amber-50 dark:bg-amber-950/30',
		isWaitlistSpot && waitlistSpotData?.expired && 'border-l-4 border-l-muted bg-muted/30',
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
	aria-label={m['notificationItem.cardAriaLabel']({
		title: isWaitlistSpot ? m['notifications.waitlistSpot.title']() : notification.title,
		status: isRead ? m['notificationItem.statusRead']() : m['notificationItem.statusUnread']()
	})}
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
						{isWaitlistSpot ? m['notifications.waitlistSpot.title']() : notification.title}
					</h3>
				</div>

				<!-- Timestamp -->
				<div class="flex items-center gap-1.5 text-xs text-muted-foreground">
					<Clock class="h-3.5 w-3.5" aria-hidden="true" />
					<time datetime={notification.created_at}>{relativeTime}</time>
				</div>
			</div>

			<!-- Body content -->
			{#if isWaitlistSpot && waitlistSpotData}
				<div class="space-y-3">
					<p class={cn('text-sm', compact && 'line-clamp-4')}>
						{m['notifications.waitlistSpot.body']({
							event: waitlistSpotData.eventName,
							time: waitlistSpotData.timeText
						})}
					</p>

					{#if waitlistSpotData.hasOffer}
						<div class="text-sm font-medium">
							{#if waitlistSpotData.expired}
								<span class="text-muted-foreground">{m['activeOffer.expired']()}</span>
							{:else}
								<OfferExpiryCountdown expiresAt={waitlistSpotData.expiresAt} />
							{/if}
						</div>
					{/if}

					{#if !waitlistSpotData.expired}
						<Button
							size={compact ? 'sm' : 'default'}
							class={cn(
								'min-h-11 w-full sm:w-auto',
								'bg-amber-600 text-white hover:bg-amber-700',
								'focus-visible:ring-2 focus-visible:ring-amber-500 focus-visible:ring-offset-2'
							)}
							onclick={handleClaim}
						>
							<Ticket class="mr-2 h-4 w-4" aria-hidden="true" />
							{m['notifications.waitlistSpot.cta']()}
						</Button>
					{/if}
				</div>
			{:else}
				<div class="notification-body">
					<MarkdownContent
						content={notification.body}
						class={cn('text-sm text-muted-foreground', compact && 'line-clamp-4')}
					/>
				</div>
			{/if}
		</div>

		<!-- Action button -->
		<div class="shrink-0">
			<Button
				variant="ghost"
				size="sm"
				onclick={toggleReadStatus}
				disabled={markReadMutation.isPending || markUnreadMutation.isPending}
				aria-label={isRead
					? m['notificationItem.markAsUnread']()
					: m['notificationItem.markAsRead']()}
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

	/* Flatten headings inside notification body to regular text size */
	.notification-body :global(h1),
	.notification-body :global(h2),
	.notification-body :global(h3),
	.notification-body :global(h4),
	.notification-body :global(h5),
	.notification-body :global(h6) {
		font-size: inherit;
		font-weight: 600;
		margin: 0;
		line-height: inherit;
	}

	/* Line clamp for compact (dropdown) mode — 4 lines so messages aren't cut mid-sentence */
	.line-clamp-4 {
		display: -webkit-box;
		-webkit-line-clamp: 4;
		line-clamp: 4;
		-webkit-box-orient: vertical;
		overflow: hidden;
	}
</style>
