<script lang="ts">
	import * as m from '$lib/paraglide/messages.js';
	import { authStore } from '$lib/stores/auth.svelte';
	import { Plus, Search, FileText } from '@lucide/svelte';
	import { Button } from '$lib/components/ui/button';
	import { Input } from '$lib/components/ui/input';
	import QuestionnaireCard from '$lib/components/questionnaires/QuestionnaireCard.svelte';
	import PageHeader from '$lib/components/common/PageHeader.svelte';
	import EmptyState from '$lib/components/common/EmptyState.svelte';
	import { useQueryClient } from '@tanstack/svelte-query';
	import { invalidateOrgQuestionnaires } from '$lib/queries/org-questionnaires';
	import type { PageData } from './$types';

	interface Props {
		data: PageData;
	}

	const { data }: Props = $props();

	const queryClient = useQueryClient();

	// Deleting a questionnaire happens inside `QuestionnaireCard`, which answers with
	// `invalidateAll()` — that re-runs *this* route's server load and nothing else.
	// The members admin's tier picker reads the same data from a TanStack cache with
	// a 60s staleTime, so a deleted (or renamed, or retyped) questionnaire would keep
	// showing up there (#722).
	//
	// This list is the authoritative server copy, so every (re)load of it is exactly
	// the moment the client copy stops being trustworthy — drop it. Cheap: with the
	// members admin unmounted this only marks the entry stale, so it refetches the
	// next time the picker opens.
	$effect(() => {
		void data.questionnaires; // tracked: a fresh array on load and on invalidateAll
		void invalidateOrgQuestionnaires(queryClient, data.organization.slug);
	});

	// Search state
	let searchQuery = $state('');

	// Filtered questionnaires based on search
	const filteredQuestionnaires = $derived(
		data.questionnaires.filter((q) =>
			q.questionnaire.name.toLowerCase().includes(searchQuery.toLowerCase())
		)
	);
</script>

<svelte:head>
	<title>{m['orgAdmin.questionnaires.pageTitle']()} - {data.organization.name} Admin</title>
</svelte:head>

<PageHeader
	title={m['orgAdmin.questionnaires.pageTitle']()}
	subtitle={m['orgAdmin.questionnaires.pageDescription']()}
	kicker={data.organization.name}
	class="mb-6"
>
	{#snippet actions()}
		<Button href="questionnaires/new" class="gap-2">
			<Plus class="h-4 w-4" />
			{m['orgAdmin.questionnaires.createQuestionnaireButton']()}
		</Button>
	{/snippet}
</PageHeader>

<!-- Search Bar -->
<div class="mb-6">
	<div class="relative">
		<Search class="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
		<Input
			type="search"
			placeholder={m['orgAdmin.questionnaires.searchPlaceholder']()}
			bind:value={searchQuery}
			class="pl-9"
		/>
	</div>
</div>

<!-- Questionnaires List -->
{#if filteredQuestionnaires.length === 0}
	{#if searchQuery}
		<!-- No search results -->
		<EmptyState
			icon={Search}
			tone="neutral"
			title={m['orgAdmin.questionnaires.noResults.title']()}
			body={m['orgAdmin.questionnaires.noResults.description']({ query: searchQuery })}
		>
			{#snippet action()}
				<Button variant="outline" onclick={() => (searchQuery = '')}>
					{m['orgAdmin.questionnaires.noResults.clearButton']()}
				</Button>
			{/snippet}
		</EmptyState>
	{:else}
		<!-- Empty state -->
		<EmptyState
			icon={FileText}
			title={m['orgAdmin.questionnaires.empty.title']()}
			body={m['orgAdmin.questionnaires.empty.description']()}
		>
			{#snippet action()}
				<Button href="questionnaires/new" class="gap-2">
					<Plus class="h-4 w-4" />
					{m['orgAdmin.questionnaires.createQuestionnaireButton']()}
				</Button>
			{/snippet}
		</EmptyState>
	{/if}
{:else}
	<!-- Questionnaires Grid -->
	<div class="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
		{#each filteredQuestionnaires as questionnaire (questionnaire.id)}
			<QuestionnaireCard
				{questionnaire}
				organizationSlug={data.organization.slug}
				organizationId={data.organization.id}
				accessToken={authStore.accessToken ?? ''}
			/>
		{/each}
	</div>
{/if}
