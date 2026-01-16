<script lang="ts">
	import * as m from '$lib/paraglide/messages.js';
	import { createMutation, createQuery, useQueryClient } from '@tanstack/svelte-query';
	import {
		organizationGetFollowStatus,
		organizationFollowOrganization,
		organizationUnfollowOrganization,
		organizationUpdateOrganizationFollow,
		eventseriesGetFollowStatus,
		eventseriesFollowEventSeries,
		eventseriesUnfollowEventSeries,
		eventseriesUpdateEventSeriesFollow
	} from '$lib/api/generated/sdk.gen';
	import { authStore } from '$lib/stores/auth.svelte';
	import { Heart, ChevronDown, Loader2 } from 'lucide-svelte';
	import { Button } from '$lib/components/ui/button';
	import * as DropdownMenu from '$lib/components/ui/dropdown-menu';
	import { toast } from 'svelte-sonner';

	interface Props {
		entityType: 'organization' | 'event-series';
		entityId: string; // slug for org, UUID for series
		entityName: string;
		isAuthenticated: boolean;
		variant?: 'default' | 'outline';
		class?: string;
	}

	let {
		entityType,
		entityId,
		entityName,
		isAuthenticated,
		variant = 'default',
		class: className
	}: Props = $props();

	const queryClient = useQueryClient();
	const accessToken = $derived(authStore.accessToken);

	// Query key for this entity's follow status (include auth state so it refetches on login)
	const queryKey = $derived(['follow-status', entityType, entityId, !!accessToken]);

	// Fetch follow status - include accessToken in key so it refetches when auth state changes
	const followStatusQuery = createQuery(() => ({
		queryKey: ['follow-status', entityType, entityId, !!accessToken],
		queryFn: async () => {
			if (!accessToken) return { is_following: false, follow: null };

			if (entityType === 'organization') {
				const response = await organizationGetFollowStatus({
					path: { slug: entityId },
					headers: { Authorization: `Bearer ${accessToken}` }
				});
				if (response.error) {
					// 404 means not following - this is expected
					return { is_following: false, follow: null };
				}
				return response.data;
			} else {
				const response = await eventseriesGetFollowStatus({
					path: { series_id: entityId },
					headers: { Authorization: `Bearer ${accessToken}` }
				});
				if (response.error) {
					return { is_following: false, follow: null };
				}
				return response.data;
			}
		},
		enabled: isAuthenticated && !!accessToken
	}));

	// Derived state - use .data directly without $ prefix
	let isFollowing = $derived(followStatusQuery.data?.is_following ?? false);
	let followData = $derived(followStatusQuery.data?.follow ?? null);
	let notifyNewEvents = $derived(followData?.notify_new_events ?? true);
	let notifyAnnouncements = $derived(
		entityType === 'organization' && followData && 'notify_announcements' in followData
			? (followData.notify_announcements ?? true)
			: false
	);

	// Follow mutation
	const followMutation = createMutation(() => ({
		mutationFn: async () => {
			if (!accessToken) throw new Error('Not authenticated');

			if (entityType === 'organization') {
				const response = await organizationFollowOrganization({
					path: { slug: entityId },
					body: { notify_new_events: true, notify_announcements: true },
					headers: { Authorization: `Bearer ${accessToken}` }
				});
				if (response.error) throw new Error('Failed to follow');
				return response.data;
			} else {
				const response = await eventseriesFollowEventSeries({
					path: { series_id: entityId },
					body: { notify_new_events: true },
					headers: { Authorization: `Bearer ${accessToken}` }
				});
				if (response.error) throw new Error('Failed to follow');
				return response.data;
			}
		},
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey });
			toast.success(m['follow.followSuccess']({ name: entityName }));
		},
		onError: () => {
			toast.error(m['follow.followError']());
		}
	}));

	// Unfollow mutation
	const unfollowMutation = createMutation(() => ({
		mutationFn: async () => {
			if (!accessToken) throw new Error('Not authenticated');

			if (entityType === 'organization') {
				const response = await organizationUnfollowOrganization({
					path: { slug: entityId },
					headers: { Authorization: `Bearer ${accessToken}` }
				});
				if (response.error) throw new Error('Failed to unfollow');
				return response.data;
			} else {
				const response = await eventseriesUnfollowEventSeries({
					path: { series_id: entityId },
					headers: { Authorization: `Bearer ${accessToken}` }
				});
				if (response.error) throw new Error('Failed to unfollow');
				return response.data;
			}
		},
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey });
			toast.success(m['follow.unfollowSuccess']({ name: entityName }));
		},
		onError: () => {
			toast.error(m['follow.unfollowError']());
		}
	}));

	// Update preferences mutation
	const updateMutation = createMutation(() => ({
		mutationFn: async (prefs: { notify_new_events?: boolean; notify_announcements?: boolean }) => {
			if (!accessToken) throw new Error('Not authenticated');

			if (entityType === 'organization') {
				const response = await organizationUpdateOrganizationFollow({
					path: { slug: entityId },
					body: prefs,
					headers: { Authorization: `Bearer ${accessToken}` }
				});
				if (response.error) throw new Error('Failed to update preferences');
				return response.data;
			} else {
				const response = await eventseriesUpdateEventSeriesFollow({
					path: { series_id: entityId },
					body: { notify_new_events: prefs.notify_new_events },
					headers: { Authorization: `Bearer ${accessToken}` }
				});
				if (response.error) throw new Error('Failed to update preferences');
				return response.data;
			}
		},
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey });
			toast.success(m['follow.preferencesUpdated']());
		},
		onError: () => {
			toast.error(m['follow.updateError']());
		}
	}));

	// Loading state - use .isPending directly without $ prefix
	let isLoading = $derived(
		followMutation.isPending || unfollowMutation.isPending || updateMutation.isPending
	);

	function handleFollowClick() {
		if (!isAuthenticated) {
			window.location.href = `/login?redirect=${encodeURIComponent(window.location.pathname)}`;
			return;
		}
		followMutation.mutate();
	}

	function handleUnfollow() {
		unfollowMutation.mutate();
	}

	function handleToggleNewEvents(checked: boolean) {
		updateMutation.mutate({ notify_new_events: checked });
	}

	function handleToggleAnnouncements(checked: boolean) {
		updateMutation.mutate({ notify_announcements: checked });
	}
</script>

{#if isFollowing}
	<!-- Following state - show dropdown with preferences -->
	<DropdownMenu.Root>
		<DropdownMenu.Trigger>
			{#snippet child({ props })}
				<Button
					{...props}
					variant="outline"
					class="gap-2 {className}"
					disabled={isLoading}
					aria-label={m['follow.following']()}
				>
					{#if isLoading}
						<Loader2 class="h-4 w-4 animate-spin" aria-hidden="true" />
					{:else}
						<Heart class="h-4 w-4 fill-current text-red-500" aria-hidden="true" />
					{/if}
					{m['follow.following']()}
					<ChevronDown class="h-4 w-4" aria-hidden="true" />
				</Button>
			{/snippet}
		</DropdownMenu.Trigger>
		<DropdownMenu.Content align="end" class="w-56">
			<DropdownMenu.CheckboxItem
				checked={notifyNewEvents}
				onCheckedChange={handleToggleNewEvents}
				disabled={updateMutation.isPending}
			>
				{m['follow.notifyNewEvents']()}
			</DropdownMenu.CheckboxItem>
			{#if entityType === 'organization'}
				<DropdownMenu.CheckboxItem
					checked={notifyAnnouncements}
					onCheckedChange={handleToggleAnnouncements}
					disabled={updateMutation.isPending}
				>
					{m['follow.notifyAnnouncements']()}
				</DropdownMenu.CheckboxItem>
			{/if}
			<DropdownMenu.Separator />
			<DropdownMenu.Item
				class="text-destructive focus:text-destructive"
				onclick={handleUnfollow}
				disabled={unfollowMutation.isPending}
			>
				{m['follow.unfollow']()}
			</DropdownMenu.Item>
		</DropdownMenu.Content>
	</DropdownMenu.Root>
{:else}
	<!-- Not following - show follow button -->
	<Button
		variant={variant === 'outline' ? 'outline' : 'default'}
		class="gap-2 {className}"
		onclick={handleFollowClick}
		disabled={isLoading}
		aria-label={m['follow.follow']()}
	>
		{#if isLoading}
			<Loader2 class="h-4 w-4 animate-spin" aria-hidden="true" />
		{:else}
			<Heart class="h-4 w-4" aria-hidden="true" />
		{/if}
		{m['follow.follow']()}
	</Button>
{/if}
