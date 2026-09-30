<script lang="ts">
	import * as m from '$lib/paraglide/messages.js';
	import { createMutation, createQuery, useQueryClient } from '@tanstack/svelte-query';
	import { toast } from 'svelte-sonner';
	import { Bell, BellOff, Loader2 } from '@lucide/svelte';
	import { Button } from '$lib/components/ui/button';
	import { cn } from '$lib/utils';
	import { authStore } from '$lib/stores/auth.svelte';
	import type { OrganizationRetrieveSchema } from '$lib/api/generated/types.gen';
	import { followStatusQueryOptions } from '$lib/queries/follow-status';
	import {
		applyMuteResult,
		notificationPreferencesQueryOptions,
		setOrganizationMuted
	} from '$lib/queries/announcement-mute';

	/**
	 * Mute/unmute an organization's announcements from its page (#984), for
	 * members, attendees and anyone else signed in. Followers don't see it:
	 * their follow menu's "announcements" toggle is the same mute, and two
	 * controls for one setting would only compete.
	 */
	interface Props {
		organization: Pick<OrganizationRetrieveSchema, 'id' | 'slug' | 'name'>;
		class?: string;
	}

	const { organization, class: className }: Props = $props();

	const queryClient = useQueryClient();
	const accessToken = $derived(authStore.accessToken);

	const preferencesQuery = createQuery(() => notificationPreferencesQueryOptions(accessToken));
	const followQuery = createQuery(() =>
		followStatusQueryOptions('organization', organization.slug, accessToken)
	);

	const isMuted = $derived(
		// `?? []`: tolerate a backend that predates the field (deploy order).
		(preferencesQuery.data?.muted_organization_ids ?? []).includes(organization.id)
	);
	// Rendered only once both answers are in, so the button never flashes the
	// wrong label or appears for a follower and then vanishes.
	const visible = $derived(
		!!accessToken &&
			preferencesQuery.isSuccess &&
			followQuery.isSuccess &&
			!followQuery.data?.is_following
	);

	const muteMutation = createMutation(() => ({
		// The org is captured at click time: a client-side navigation to another
		// org page mid-request must not change whose name the toast shows.
		mutationFn: ({ id, muted }: { id: string; name: string; muted: boolean }) =>
			setOrganizationMuted(id, muted, accessToken),
		onSuccess: (prefs, { name, muted }) => {
			applyMuteResult(queryClient, prefs);
			toast.success(
				muted
					? m['announcementMute.mutedToast']({ name })
					: m['announcementMute.unmutedToast']({ name })
			);
		},
		onError: () => {
			toast.error(m['announcementMute.updateError']());
		}
	}));
</script>

{#if visible}
	<Button
		type="button"
		variant="outline"
		class={cn('aria-disabled:pointer-events-none aria-disabled:opacity-50', className)}
		aria-disabled={muteMutation.isPending}
		onclick={() => {
			if (!muteMutation.isPending)
				muteMutation.mutate({ id: organization.id, name: organization.name, muted: !isMuted });
		}}
	>
		{#if muteMutation.isPending}
			<Loader2 class="animate-spin" aria-hidden="true" />
		{:else if isMuted}
			<Bell aria-hidden="true" />
		{:else}
			<BellOff aria-hidden="true" />
		{/if}
		{isMuted ? m['announcementMute.unmute']() : m['announcementMute.mute']()}
	</Button>
{/if}
