<script lang="ts">
	import { Plus, Search } from 'lucide-svelte';
	import { Button } from '$lib/components/ui/button';
	import { Input } from '$lib/components/ui/input';
	import QuestionnaireCard from '$lib/components/questionnaires/QuestionnaireCard.svelte';
	import type { PageData } from './$types';

	interface Props {
		data: PageData;
	}

	let { data }: Props = $props();

	// Search state
	let searchQuery = $state('');

	// Filtered questionnaires based on search
	let filteredQuestionnaires = $derived(
		data.questionnaires.filter((q) =>
			q.questionnaire.name.toLowerCase().includes(searchQuery.toLowerCase())
		)
	);
</script>

<svelte:head>
	<title>Questionnaires - {data.organization.name} Admin</title>
</svelte:head>

<!-- Page Header -->
<div class="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
	<div>
		<h1 class="text-3xl font-bold tracking-tight">Questionnaires</h1>
		<p class="mt-2 text-sm text-muted-foreground">
			Manage admission forms, applications, and surveys for your events
		</p>
	</div>
	<Button href="questionnaires/new" class="gap-2">
		<Plus class="h-4 w-4" />
		Create Questionnaire
	</Button>
</div>

<!-- Search Bar -->
<div class="mb-6">
	<div class="relative">
		<Search class="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
		<Input
			type="search"
			placeholder="Search questionnaires..."
			bind:value={searchQuery}
			class="pl-9"
		/>
	</div>
</div>

<!-- Questionnaires List -->
{#if filteredQuestionnaires.length === 0}
	{#if searchQuery}
		<!-- No search results -->
		<div class="flex flex-col items-center justify-center rounded-lg border border-dashed p-12">
			<div class="mb-4 rounded-full bg-muted p-3">
				<Search class="h-6 w-6 text-muted-foreground" />
			</div>
			<h3 class="mb-2 text-lg font-semibold">No questionnaires found</h3>
			<p class="mb-4 text-center text-sm text-muted-foreground">
				No questionnaires match "{searchQuery}"
			</p>
			<Button variant="outline" onclick={() => (searchQuery = '')}>Clear search</Button>
		</div>
	{:else}
		<!-- Empty state -->
		<div class="flex flex-col items-center justify-center rounded-lg border border-dashed p-12">
			<div class="mb-4 rounded-full bg-muted p-3">
				<svg
					class="h-6 w-6 text-muted-foreground"
					fill="none"
					stroke="currentColor"
					viewBox="0 0 24 24"
					aria-hidden="true"
				>
					<path
						stroke-linecap="round"
						stroke-linejoin="round"
						stroke-width="2"
						d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
					/>
				</svg>
			</div>
			<h3 class="mb-2 text-lg font-semibold">No questionnaires yet</h3>
			<p class="mb-4 text-center text-sm text-muted-foreground">
				Create your first admission form or membership application to get started
			</p>
			<Button href="questionnaires/new" class="gap-2">
				<Plus class="h-4 w-4" />
				Create Questionnaire
			</Button>
		</div>
	{/if}
{:else}
	<!-- Questionnaires Grid -->
	<div class="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
		{#each filteredQuestionnaires as questionnaire (questionnaire.id)}
			<QuestionnaireCard {questionnaire} organizationSlug={data.organization.slug} />
		{/each}
	</div>
{/if}
