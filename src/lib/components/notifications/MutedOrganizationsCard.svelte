<script lang="ts">
	import * as m from '$lib/paraglide/messages.js';
	import { resolve } from '$app/paths';
	import { createMutation, createQuery, useQueryClient } from '@tanstack/svelte-query';
	import { toast } from 'svelte-sonner';
	import { BellOff, Loader2 } from '@lucide/svelte';
	import { Button } from '$lib/components/ui/button';
	import SectionHeader from '$lib/components/common/SectionHeader.svelte';
	import EmptyState from '$lib/components/common/EmptyState.svelte';
	import type { NotificationPreferenceSchema } from '$lib/api/generated/types.gen';
	import {
		applyMuteResult,
		mutedOrganizationsQueryOptions,
		notificationPreferencesQueryOptions,
		setOrganizationMuted,
		type MutedOrganization
	} from '$lib/queries/announcement-mute';

	/**
	 * Settings list of organizations whose announcements the viewer muted
	 * (#984), each with an unmute action. Muting itself happens on the org page.
	 */
	interface Props {
		authToken: string | null;
		/** SSR-loaded preferences, used as the query's initial data. */
		initialPreferences: NotificationPreferenceSchema | null;
	}

	const { authToken, initialPreferences }: Props = $props();

	const queryClient = useQueryClient();

	const preferencesQuery = createQuery(() => ({
		...notificationPreferencesQueryOptions(authToken),
		initialData: initialPreferences ?? undefined
	}));

	const mutedIds = $derived(preferencesQuery.data?.muted_organization_ids ?? []);
	const organizationsQuery = createQuery(() => mutedOrganizationsQueryOptions(mutedIds, authToken));

	// IDs first (instant from the preferences), names filled in once resolved.
	const rows = $derived<MutedOrganization[]>(
		mutedIds.map(
			(id) =>
				organizationsQuery.data?.find((org) => org.id === id) ?? { id, name: null, slug: null }
		)
	);

	let pendingId = $state<string | null>(null);

	const unmuteMutation = createMutation(() => ({
		mutationFn: (org: MutedOrganization) => setOrganizationMuted(org.id, false, authToken),
		onMutate: (org) => {
			pendingId = org.id;
		},
		onSuccess: (prefs, org) => {
			applyMuteResult(queryClient, prefs);
			toast.success(
				m['announcementMute.unmutedToast']({
					name: org.name ?? m['announcementMute.unknownOrganization']()
				})
			);
		},
		onError: () => {
			toast.error(m['announcementMute.updateError']());
		},
		onSettled: () => {
			pendingId = null;
		}
	}));
</script>

<section class="mt-8 rounded-lg border bg-card p-6" aria-labelledby="muted-organizations-title">
	<SectionHeader
		id="muted-organizations-title"
		title={m['announcementMute.settingsTitle']()}
		subtitle={m['announcementMute.settingsDescription']()}
		class="mb-4"
	/>

	{#if rows.length === 0}
		<EmptyState
			level={3}
			tone="neutral"
			icon={BellOff}
			title={m['announcementMute.emptyTitle']()}
			body={m['announcementMute.emptyBody']()}
		/>
	{:else}
		<ul class="divide-y rounded-md border">
			{#each rows as org (org.id)}
				{@const label =
					org.name ??
					(organizationsQuery.isPending
						? m['announcementMute.loading']()
						: m['announcementMute.unknownOrganization']())}
				<li class="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
					{#if org.slug}
						<a
							href={resolve('/(public)/org/[slug]', { slug: org.slug })}
							class="min-w-0 break-words font-bold text-primary underline-offset-4 hover:underline"
						>
							{label}
						</a>
					{:else}
						<span class="font-bold text-muted-foreground">{label}</span>
					{/if}
					<Button
						type="button"
						variant="outline"
						size="sm"
						class="w-full sm:w-auto"
						aria-label={m['announcementMute.unmuteNamed']({ name: label })}
						aria-disabled={pendingId === org.id}
						onclick={() => {
							if (pendingId === null) unmuteMutation.mutate(org);
						}}
					>
						{#if pendingId === org.id}
							<Loader2 class="animate-spin" aria-hidden="true" />
						{/if}
						{m['announcementMute.unmuteShort']()}
					</Button>
				</li>
			{/each}
		</ul>
	{/if}
</section>
