<script lang="ts">
	import * as m from '$lib/paraglide/messages.js';
	import { Plus, Search } from 'lucide-svelte';
	import { Button } from '$lib/components/ui/button';
	import { Input } from '$lib/components/ui/input';
	import PollCard from '$lib/components/polls/PollCard.svelte';
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

<!-- Page Header -->
<div class="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
	<div>
		<h1 class="text-3xl font-bold tracking-tight">{m['orgAdmin.polls.pageTitle']()}</h1>
		<p class="mt-2 text-sm text-muted-foreground">{m['orgAdmin.polls.pageDescription']()}</p>
	</div>
	<Button href="polls/new" class="gap-2">
		<Plus class="h-4 w-4" />
		{m['orgAdmin.polls.createPollButton']()}
	</Button>
</div>

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
		<div class="flex flex-col items-center justify-center rounded-lg border border-dashed p-12">
			<div class="mb-4 rounded-full bg-muted p-3">
				<Search class="h-6 w-6 text-muted-foreground" />
			</div>
			<h3 class="mb-2 text-lg font-semibold">{m['orgAdmin.polls.noResults.title']()}</h3>
			<p class="mb-4 text-center text-sm text-muted-foreground">
				{m['orgAdmin.polls.noResults.description']({ query: searchQuery })}
			</p>
			<Button variant="outline" onclick={() => (searchQuery = '')}>
				{m['orgAdmin.polls.noResults.clearButton']()}
			</Button>
		</div>
	{:else}
		<!-- Empty state -->
		<div class="flex flex-col items-center justify-center rounded-lg border border-dashed p-12">
			<h3 class="mb-2 text-lg font-semibold">{m['orgAdmin.polls.empty.title']()}</h3>
			<p class="mb-4 text-center text-sm text-muted-foreground">
				{m['orgAdmin.polls.empty.description']()}
			</p>
			<Button href="polls/new" class="gap-2">
				<Plus class="h-4 w-4" />
				{m['orgAdmin.polls.createPollButton']()}
			</Button>
		</div>
	{/if}
{:else}
	<!-- Polls Grid -->
	<div class="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
		{#each filtered as poll (poll.id)}
			<PollCard
				{poll}
				organizationSlug={data.organization.slug}
				isOwner={data.isOwner}
				accessToken={data.accessToken}
			/>
		{/each}
	</div>
{/if}
