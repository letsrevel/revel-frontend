<script lang="ts">
	import * as m from '$lib/paraglide/messages.js';
	import { ArrowLeft, Lock, Trash2 } from 'lucide-svelte';
	import { Button } from '$lib/components/ui/button';
	import {
		Card,
		CardContent,
		CardDescription,
		CardHeader,
		CardTitle
	} from '$lib/components/ui/card';
	import { Input } from '$lib/components/ui/input';
	import { Label } from '$lib/components/ui/label';
	import { toast } from 'svelte-sonner';
	import { page } from '$app/stores';
	import { goto, invalidateAll } from '$app/navigation';
	import PollStatusBar from '$lib/components/polls/PollStatusBar.svelte';
	import PollAudienceCard from '$lib/components/polls/PollAudienceCard.svelte';
	import PollAnonymityCard from '$lib/components/polls/PollAnonymityCard.svelte';
	import PollScheduleCard from '$lib/components/polls/PollScheduleCard.svelte';
	import { pollPatchPoll, pollDeletePollAction } from '$lib/api/generated/sdk.gen';
	import { buildPollVoterUrl, isPollDraft, validateClosesAt } from '$lib/utils/polls';
	import type { PageData } from './$types';

	interface Props {
		data: PageData;
	}
	const { data }: Props = $props();

	const poll = $derived(data.poll);
	const isDraft = $derived(isPollDraft(poll.status));
	const voterUrl = $derived(buildPollVoterUrl($page.url.origin, data.organization.slug, poll.id));

	// Editable state initialized from poll
	let voteVisibility = $state(poll.vote_visibility);
	let resultVisibility = $state(poll.result_visibility);
	let eventId = $state<string | null>(poll.event_id);
	let voteTierIds = $state<string[]>(poll.vote_membership_tier_ids);
	let resultTierIds = $state<string[]>(poll.result_membership_tier_ids);
	let resultTiming = $state(poll.result_timing);
	let staffAnonymous = $state(poll.staff_anonymous);
	let publicAnonymous = $state(poll.public_anonymous);
	let allowVoteChanges = $state(poll.allow_vote_changes);
	let closesAt = $state<string | null>(
		poll.closes_at ? new Date(poll.closes_at).toISOString().slice(0, 16) : null
	);
	let closesAtError = $state<string | null>(null);
	let saving = $state(false);
	let deleting = $state(false);

	async function save() {
		const err = validateClosesAt(closesAt);
		closesAtError = err ? m['pollNewPage.closesAtPast']() : null;
		if (closesAtError) return;
		saving = true;
		try {
			const res = await pollPatchPoll({
				path: { poll_id: poll.id },
				headers: { Authorization: `Bearer ${data.accessToken}` },
				body: {
					vote_visibility: voteVisibility,
					result_visibility: resultVisibility,
					event_id: eventId,
					vote_membership_tier_ids: voteTierIds,
					result_membership_tier_ids: resultTierIds,
					result_timing: resultTiming,
					allow_vote_changes: allowVoteChanges,
					closes_at: closesAt ? new Date(closesAt).toISOString() : null
				}
			});
			if (res.error) throw new Error('patch');
			toast.success(m['pollEditPage.saveSuccess']());
			await invalidateAll();
		} catch (e) {
			console.error(e);
			toast.error(m['pollEditPage.saveError']());
		} finally {
			saving = false;
		}
	}

	async function deletePoll() {
		const confirmed = confirm(
			m['pollEditPage.deleteConfirm']({ name: poll.questionnaire?.name ?? '' })
		);
		if (!confirmed) return;
		deleting = true;
		try {
			const res = await pollDeletePollAction({
				path: { poll_id: poll.id },
				headers: { Authorization: `Bearer ${data.accessToken}` }
			});
			if (res.error) throw new Error('delete');
			await goto(`/org/${data.organization.slug}/admin/polls`);
		} catch (e) {
			console.error(e);
			toast.error(m['pollEditPage.saveError']());
		} finally {
			deleting = false;
		}
	}
</script>

<svelte:head>
	<title>{m['pollEditPage.pageTitle']()} - {data.organization.name} Admin</title>
</svelte:head>

<div class="mb-6">
	<Button
		href="/org/{data.organization.slug}/admin/polls"
		variant="ghost"
		size="sm"
		class="mb-4 gap-2"
	>
		<ArrowLeft class="h-4 w-4" />
		{m['pollEditPage.backToList']()}
	</Button>
	<h1 class="text-3xl font-bold tracking-tight">
		{poll.questionnaire?.name ?? m['pollEditPage.pageTitle']()}
	</h1>
</div>

<div class="mx-auto max-w-4xl space-y-6">
	<PollStatusBar {poll} {voterUrl} accessToken={data.accessToken ?? ''} />

	<!-- Basics — read-only -->
	<Card>
		<CardHeader>
			<CardTitle class="flex items-center gap-2">
				{m['pollNewPage.basicsTitle']()}
				<Lock class="h-4 w-4 text-muted-foreground" />
			</CardTitle>
			<CardDescription>{m['pollEditPage.nameLockTooltip']()}</CardDescription>
		</CardHeader>
		<CardContent class="space-y-4">
			<div class="space-y-2">
				<Label for="name">{m['pollNewPage.nameLabel']()}</Label>
				<Input id="name" value={poll.questionnaire?.name ?? ''} readonly />
			</div>
			{#if poll.questionnaire?.description}
				<div class="space-y-2">
					<Label>{m['pollNewPage.descriptionLabel']()}</Label>
					<div class="rounded-md border bg-muted/40 p-3 text-sm">
						{poll.questionnaire.description}
					</div>
				</div>
			{/if}
		</CardContent>
	</Card>

	<PollAudienceCard
		bind:voteVisibility
		bind:resultVisibility
		bind:eventId
		bind:voteTierIds
		bind:resultTierIds
		events={data.events}
		tiers={data.tiers}
	/>

	<PollAnonymityCard
		bind:resultTiming
		bind:staffAnonymous
		bind:publicAnonymous
		bind:allowVoteChanges
		{resultVisibility}
		mode="edit"
	/>

	<PollScheduleCard bind:closesAt error={closesAtError} />

	<!-- Questions — read-only view (Task 12 will add full results; here we show raw schema data) -->
	<Card>
		<CardHeader>
			<CardTitle>{m['pollNewPage.questionsTitle']()}</CardTitle>
			{#if !isDraft}
				<CardDescription
					class="rounded-md bg-amber-50 p-2 text-amber-900 dark:bg-amber-950/30 dark:text-amber-200"
				>
					{m['pollEditPage.questionsLockedBanner']()}
				</CardDescription>
			{/if}
		</CardHeader>
		<CardContent>
			{#if poll.questionnaire}
				{@const q = poll.questionnaire}
				{@const allMc = q.multiplechoicequestion_questions ?? []}
				{@const allFt = q.freetextquestion_questions ?? []}
				{@const allFu = q.fileuploadquestion_questions ?? []}
				{#if allMc.length + allFt.length + allFu.length > 0}
					<div class="space-y-3">
						{#each allMc as question (question.id)}
							<div class="rounded-lg border p-4">
								<span
									class="mb-2 inline-block rounded bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-700"
									>Multiple Choice</span
								>
								<p class="font-medium">{question.question}</p>
								{#if question.options}
									<div class="mt-2 space-y-1">
										{#each question.options as opt}
											<div class="flex items-center gap-2 text-sm text-muted-foreground">
												<span>&#9675;</span>
												<span>{opt.option}</span>
											</div>
										{/each}
									</div>
								{/if}
							</div>
						{/each}
						{#each allFt as question (question.id)}
							<div class="rounded-lg border p-4">
								<span
									class="mb-2 inline-block rounded bg-purple-100 px-2 py-0.5 text-xs font-medium text-purple-700"
									>Free Text</span
								>
								<p class="font-medium">{question.question}</p>
							</div>
						{/each}
						{#each allFu as question (question.id)}
							<div class="rounded-lg border p-4">
								<span
									class="mb-2 inline-block rounded bg-green-100 px-2 py-0.5 text-xs font-medium text-green-700"
									>File Upload</span
								>
								<p class="font-medium">{question.question}</p>
							</div>
						{/each}
					</div>
				{:else}
					<p class="text-sm italic text-muted-foreground">No questions defined yet.</p>
				{/if}
			{:else}
				<p class="text-sm italic text-muted-foreground">No questionnaire attached to this poll.</p>
			{/if}
		</CardContent>
	</Card>

	<!-- Results placeholder — full component lands in Task 12 -->
	<Card id="results">
		<CardHeader>
			<CardTitle>{m['pollEditPage.resultsTitle']()}</CardTitle>
		</CardHeader>
		<CardContent>
			{#if poll.results && poll.results.total_voters > 0}
				<p class="text-sm text-muted-foreground">
					{poll.results.total_voters} voters — full results view lands in Task 12.
				</p>
			{:else}
				<p class="text-sm text-muted-foreground">{m['pollEditPage.resultsEmpty']()}</p>
			{/if}
		</CardContent>
	</Card>

	<div class="flex justify-end gap-3">
		<Button onclick={save} disabled={saving}>
			{saving ? m['pollEditPage.saving']() : m['pollEditPage.saveButton']()}
		</Button>
	</div>

	{#if data.isOwner}
		<Card class="border-destructive/50">
			<CardHeader>
				<CardTitle class="text-destructive">{m['pollEditPage.deleteSectionTitle']()}</CardTitle>
			</CardHeader>
			<CardContent>
				<Button
					variant="outline"
					onclick={deletePoll}
					disabled={deleting}
					class="gap-2 text-destructive hover:bg-destructive hover:text-destructive-foreground"
				>
					<Trash2 class="h-4 w-4" />
					{m['pollEditPage.deleteButton']()}
				</Button>
			</CardContent>
		</Card>
	{/if}
</div>
