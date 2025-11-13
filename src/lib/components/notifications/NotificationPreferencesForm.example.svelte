<script lang="ts">
	/**
	 * Example usage of NotificationPreferencesForm component
	 * This demonstrates how to integrate the component in a page
	 */
	import { NotificationPreferencesForm } from '$lib/components/notifications';
	import { createQuery } from '@tanstack/svelte-query';
	import { notificationpreferenceGetPreferences } from '$lib/api';
	import { Loader2, AlertCircle } from 'lucide-svelte';
	import * as Card from '$lib/components/ui/card';

	interface Props {
		authToken: string;
	}

	let { authToken }: Props = $props();

	// Fetch current notification preferences
	const preferencesQuery = createQuery(() => ({
		queryKey: ['notification-preferences'],
		queryFn: async () => {
			const response = await notificationpreferenceGetPreferences({
				headers: { Authorization: `Bearer ${authToken}` }
			});
			return response.data;
		},
		staleTime: 5 * 60 * 1000, // Consider data fresh for 5 minutes
		refetchOnWindowFocus: true
	}));

	// Handle successful save
	function handlePreferencesSaved(updatedPreferences: any) {
		console.log('Notification preferences updated:', updatedPreferences);
		// Additional post-save logic here
		// For example, you might want to:
		// - Show a custom notification
		// - Track analytics event
		// - Navigate to another page
	}
</script>

<div class="container mx-auto max-w-4xl px-4 py-8">
	<!-- Page Header -->
	<div class="mb-8">
		<h1 class="text-3xl font-bold">Notification Preferences</h1>
		<p class="mt-2 text-muted-foreground">
			Manage how and when you receive notifications from Revel
		</p>
	</div>

	<!-- Loading State -->
	{#if preferencesQuery.isLoading}
		<Card.Root>
			<Card.Content class="flex items-center justify-center py-12">
				<div class="flex flex-col items-center gap-4">
					<Loader2 class="h-8 w-8 animate-spin text-muted-foreground" aria-hidden="true" />
					<p class="text-sm text-muted-foreground">Loading your preferences...</p>
				</div>
			</Card.Content>
		</Card.Root>

		<!-- Error State -->
	{:else if preferencesQuery.isError}
		<Card.Root class="border-destructive">
			<Card.Content class="flex items-center gap-4 py-8">
				<AlertCircle class="h-8 w-8 text-destructive" aria-hidden="true" />
				<div class="flex-1">
					<h3 class="font-semibold text-destructive">Failed to load preferences</h3>
					<p class="mt-1 text-sm text-muted-foreground">
						{preferencesQuery.error?.message ?? 'An unknown error occurred'}
					</p>
					<button
						type="button"
						onclick={() => preferencesQuery.refetch()}
						class="mt-4 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
					>
						Try Again
					</button>
				</div>
			</Card.Content>
		</Card.Root>

		<!-- Success State - Show Form -->
	{:else}
		<NotificationPreferencesForm
			preferences={preferencesQuery.data ?? null}
			{authToken}
			onSave={handlePreferencesSaved}
		/>
	{/if}

	<!-- Help Section -->
	<Card.Root class="mt-8">
		<Card.Header>
			<Card.Title>About Notifications</Card.Title>
		</Card.Header>
		<Card.Content class="space-y-4 text-sm text-muted-foreground">
			<p>
				<strong>Notification Channels:</strong> Choose how you want to receive notifications. You can
				enable multiple channels to ensure you never miss important updates.
			</p>
			<p>
				<strong>Digest Frequency:</strong> Control how often you receive notification digests. Set to
				"Immediate" to get notifications as they happen, or choose "Daily" or "Weekly" to receive a summary
				at your preferred time.
			</p>
			<p>
				<strong>Privacy:</strong> Control your visibility on event attendee lists. Choose who can see
				your attendance status for events.
			</p>
			<p>
				<strong>Event Reminders:</strong> When enabled, you'll receive automatic reminders 14, 7, and
				1 day before events you've RSVP'd to.
			</p>
		</Card.Content>
	</Card.Root>
</div>
