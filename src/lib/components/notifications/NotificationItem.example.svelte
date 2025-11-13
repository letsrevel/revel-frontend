<script lang="ts">
	/**
	 * Example usage of NotificationItem component
	 * This file demonstrates different use cases and configurations
	 */

	import NotificationItem from './NotificationItem.svelte';
	import type { NotificationSchema } from '$lib/api/generated/types.gen';

	// Mock auth token (in real app, get from auth store)
	const authToken = 'your-auth-token-here';

	// Example 1: Unread event invitation notification
	const unreadNotification: NotificationSchema = {
		id: '123',
		notification_type: 'invitation_received',
		title: 'New Event Invitation',
		body: 'You have been invited to Summer BBQ on July 20th.',
		body_html: '<p>You have been invited to <strong>Summer BBQ</strong> on July 20th.</p>',
		context: { event_id: 'event-123' },
		read_at: null,
		created_at: new Date(Date.now() - 1000 * 60 * 30).toISOString() // 30 minutes ago
	};

	// Example 2: Read RSVP confirmation notification
	const readNotification: NotificationSchema = {
		id: '456',
		notification_type: 'rsvp_confirmation',
		title: 'RSVP Confirmed',
		body: 'Your RSVP to Tech Meetup has been confirmed.',
		body_html: '<p>Your RSVP to <strong>Tech Meetup</strong> has been confirmed.</p>',
		context: { event_id: 'event-456' },
		read_at: new Date(Date.now() - 1000 * 60 * 60).toISOString(), // Read 1 hour ago
		created_at: new Date(Date.now() - 1000 * 60 * 60 * 2).toISOString() // Created 2 hours ago
	};

	// Example 3: Notification without clickable context
	const infoNotification: NotificationSchema = {
		id: '789',
		notification_type: 'org_announcement',
		title: 'System Maintenance',
		body: 'The platform will undergo scheduled maintenance on Sunday at 2 AM.',
		body_html: '<p>The platform will undergo scheduled maintenance on Sunday at 2 AM.</p>',
		context: {}, // No URL
		read_at: null,
		created_at: new Date(Date.now() - 1000 * 60 * 60 * 24).toISOString() // 1 day ago
	};

	// Example 4: Organization-related notification
	const orgNotification: NotificationSchema = {
		id: '101',
		notification_type: 'membership_request_approved',
		title: 'Membership Approved',
		body: 'Your membership to Tech Community has been approved!',
		body_html: '<p>Your membership to <strong>Tech Community</strong> has been approved!</p>',
		context: { org_slug: 'tech-community' },
		read_at: null,
		created_at: new Date(Date.now() - 1000 * 60 * 5).toISOString() // 5 minutes ago
	};

	// Handle notification status change
	function handleStatusChange(notification: NotificationSchema): void {
		console.log('Notification status changed:', notification);
		// In real app, update cache/store
	}
</script>

<div class="mx-auto max-w-2xl space-y-4 p-4">
	<h1 class="mb-6 text-2xl font-bold">NotificationItem Examples</h1>

	<section class="space-y-2">
		<h2 class="text-lg font-semibold">1. Unread Event Invitation (Standard)</h2>
		<NotificationItem
			notification={unreadNotification}
			{authToken}
			onStatusChange={handleStatusChange}
		/>
	</section>

	<section class="space-y-2">
		<h2 class="text-lg font-semibold">2. Read RSVP Confirmation (Standard)</h2>
		<NotificationItem
			notification={readNotification}
			{authToken}
			onStatusChange={handleStatusChange}
		/>
	</section>

	<section class="space-y-2">
		<h2 class="text-lg font-semibold">3. Compact Mode (for dropdowns)</h2>
		<NotificationItem
			notification={unreadNotification}
			{authToken}
			onStatusChange={handleStatusChange}
			compact
		/>
	</section>

	<section class="space-y-2">
		<h2 class="text-lg font-semibold">4. Non-Clickable Notification</h2>
		<NotificationItem
			notification={infoNotification}
			{authToken}
			onStatusChange={handleStatusChange}
		/>
	</section>

	<section class="space-y-2">
		<h2 class="text-lg font-semibold">5. Organization Notification</h2>
		<NotificationItem
			notification={orgNotification}
			{authToken}
			onStatusChange={handleStatusChange}
		/>
	</section>

	<section class="space-y-2">
		<h2 class="text-lg font-semibold">6. With Custom Class</h2>
		<NotificationItem
			notification={readNotification}
			{authToken}
			onStatusChange={handleStatusChange}
			class="border-2 border-blue-500"
		/>
	</section>
</div>
