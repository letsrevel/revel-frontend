<script lang="ts">
	import * as m from '$lib/paraglide/messages.js';
	import { authStore } from '$lib/stores/auth.svelte';
	import { Plus, Search, Vote } from '@lucide/svelte';
	import { Button } from '$lib/components/ui/button';
	import { Input } from '$lib/components/ui/input';
	import PollCard from '$lib/components/polls/PollCard.svelte';
	import PageHeader from '$lib/components/common/PageHeader.svelte';
	import EmptyState from '$lib/components/common/EmptyState.svelte';
	import type { PageData } from './$types';

	interface Props {
		data: PageData;
	}

	const { data }: Props = $props();

	let searchQuery = $state('');

	const filtered = $derived(
		data.polls.filter((p) => p.questionnaire_name.toLowerCase().includes(searchQuery.toLowerCase()))
	);
</script>

<svelte:head>
	<title>{m['orgAdmin.polls.pageTitle']()} - {data.organization.name} Admin</title>
</svelte:head>

<PageHeader
	title={m['orgAdmin.polls.pageTitle']()}
	subtitle={m['orgAdmin.polls.pageDescription']()}
	kicker={data.organization.name}
	class="mb-6"
>
	{#snippet actions()}
		<Button href="polls/new" class="gap-2">
			<Plus class="h-4 w-4" />
			{m['orgAdmin.polls.createPollButton']()}
		</Button>
	{/snippet}
</PageHeader>

<!-- Search Bar -->
<div class="mb-6">
	<div class="relative">
		<Search class="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
		<Input
			type="search"
			placeholder={m['orgAdmin.polls.searchPlaceholder']()}
			bind:value={searchQuery}
			class="pl-9"
		/>
	</div>
</div>

<!-- Polls List -->
{#if filtered.length === 0}
	{#if searchQuery}
		<!-- No search results -->
		<EmptyState
			icon={Search}
			tone="neutral"
			title={m['orgAdmin.polls.noResults.title']()}
			body={m['orgAdmin.polls.noResults.description']({ query: searchQuery })}
		>
			{#snippet action()}
				<Button variant="outline" onclick={() => (searchQuery = '')}>
					{m['orgAdmin.polls.noResults.clearButton']()}
				</Button>
			{/snippet}
		</EmptyState>
	{:else}
		<!-- Empty state -->
		<EmptyState
			icon={Vote}
			title={m['orgAdmin.polls.empty.title']()}
			body={m['orgAdmin.polls.empty.description']()}
		>
			{#snippet action()}
				<Button href="polls/new" class="gap-2">
					<Plus class="h-4 w-4" />
					{m['orgAdmin.polls.createPollButton']()}
				</Button>
			{/snippet}
		</EmptyState>
	{/if}
{:else}
	<!-- Polls Grid -->
	<div class="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
		{#each filtered as poll (poll.id)}
			<PollCard
				{poll}
				organizationSlug={data.organization.slug}
				isOwner={data.isOwner}
				accessToken={authStore.accessToken ?? undefined}
			/>
		{/each}
	</div>
{/if}
