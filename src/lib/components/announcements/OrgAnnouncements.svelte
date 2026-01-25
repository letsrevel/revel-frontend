<script lang="ts">
	import * as m from '$lib/paraglide/messages.js';
	import type { AnnouncementPublicSchema } from '$lib/api/generated/types.gen';
	import { organizationListMemberAnnouncements } from '$lib/api/generated/sdk.gen';
	import { createQuery } from '@tanstack/svelte-query';
	import { authStore } from '$lib/stores/auth.svelte';
	import { Megaphone, Loader2 } from 'lucide-svelte';
	import AnnouncementPublicCard from './AnnouncementPublicCard.svelte';

	interface Props {
		organizationSlug: string;
	}

	let { organizationSlug }: Props = $props();

	// Derived
	let accessToken = $derived(authStore.accessToken);

	// Fetch announcements
	let announcementsQuery = createQuery(() => ({
		queryKey: ['org-member-announcements', organizationSlug],
		queryFn: async () => {
			const response = await organizationListMemberAnnouncements({
				path: { slug: organizationSlug },
				headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : undefined
			});
			if (response.error) throw response.error;
			return response.data;
		},
		enabled: !!accessToken // Only fetch if authenticated
	}));

	let announcements = $derived(announcementsQuery.data ?? []);
	let isLoading = $derived(announcementsQuery.isLoading);
	let hasAnnouncements = $derived(announcements.length > 0);
</script>

{#if hasAnnouncements || isLoading}
	<section class="space-y-4">
		<!-- Header -->
		<div class="flex items-center gap-2">
			<Megaphone class="h-5 w-5 text-muted-foreground" aria-hidden="true" />
			<h2 class="text-xl font-semibold">{m['announcements.public.title']()}</h2>
			{#if hasAnnouncements}
				<span class="rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
					{announcements.length}
				</span>
			{/if}
		</div>

		<!-- Content -->
		<div class="space-y-3">
			{#if isLoading}
				<div class="flex items-center justify-center py-8">
					<Loader2 class="h-6 w-6 animate-spin text-muted-foreground" />
				</div>
			{:else if announcements.length === 0}
				<p class="py-4 text-center text-sm text-muted-foreground">
					{m['announcements.public.empty']()}
				</p>
			{:else}
				{#each announcements as announcement (announcement.id)}
					<AnnouncementPublicCard {announcement} />
				{/each}
			{/if}
		</div>
	</section>
{/if}
