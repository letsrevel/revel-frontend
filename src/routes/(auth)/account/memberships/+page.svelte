<script lang="ts">
	import * as m from '$lib/paraglide/messages.js';
	import { createQuery } from '@tanstack/svelte-query';
	import { mesubscriptionsListMyMemberships } from '$lib/api/generated/sdk.gen';
	import type { MyMembershipSchema } from '$lib/api/generated/types.gen';
	import { authStore } from '$lib/stores/auth.svelte';
	import MembershipCard from '$lib/components/account/MembershipCard.svelte';
	import { Button } from '$lib/components/ui/button';
	import { Loader2 } from '@lucide/svelte';

	const accessToken = $derived(authStore.accessToken);

	const membershipsQuery = createQuery(() => ({
		queryKey: ['me', 'memberships'],
		queryFn: async () => {
			const res = await mesubscriptionsListMyMemberships({
				query: { page_size: 50 },
				headers: { Authorization: `Bearer ${accessToken}` }
			});
			if (res.error) throw new Error('Failed to load memberships');
			return (res.data?.results ?? []) as MyMembershipSchema[];
		},
		enabled: !!accessToken
	}));

	const memberships = $derived(membershipsQuery.data ?? []);
</script>

<svelte:head>
	<title>{m['account.memberships.title']()}</title>
</svelte:head>

<div class="container mx-auto max-w-3xl space-y-4 px-4 py-6">
	<h1 class="text-2xl font-bold">{m['account.memberships.title']()}</h1>

	{#if membershipsQuery.isLoading}
		<Loader2 class="h-5 w-5 animate-spin" />
	{:else if memberships.length === 0}
		<div class="rounded-lg border p-6 text-center">
			<p class="font-medium">{m['account.memberships.empty.title']()}</p>
			<p class="mt-1 text-sm text-muted-foreground">{m['account.memberships.empty.body']()}</p>
			<Button href="/organizations" variant="outline" class="mt-4">
				{m['account.memberships.empty.cta']()}
			</Button>
		</div>
	{:else}
		<div class="space-y-3">
			{#each memberships as mb (mb.organization_id)}
				<MembershipCard membership={mb} />
			{/each}
		</div>
	{/if}
</div>
