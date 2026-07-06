<script lang="ts">
	import * as m from '$lib/paraglide/messages.js';
	import { authStore } from '$lib/stores/auth.svelte';
	import { ArrowLeft, Copy, Trash2, Plus, FolderPlus, Upload } from '@lucide/svelte';
	import MarkdownEditor from '$lib/components/forms/MarkdownEditor.svelte';
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
	import ConfirmDialog from '$lib/components/common/ConfirmDialog.svelte';
	import DuplicatePollModal from '$lib/components/polls/DuplicatePollModal.svelte';
	import PollAudienceCard from '$lib/components/polls/PollAudienceCard.svelte';
	import PollAnonymityCard from '$lib/components/polls/PollAnonymityCard.svelte';
	import PollScheduleCard from '$lib/components/polls/PollScheduleCard.svelte';
	import PollResultsView from '$lib/components/polls/PollResultsView.svelte';
	import QuestionEditor from '$lib/components/questionnaires/QuestionEditor.svelte';
	import SectionEditor from '$lib/components/questionnaires/SectionEditor.svelte';
	import { pollPatchPoll, pollDeletePollAction } from '$lib/api/generated/sdk.gen';
	import { buildPollVoterUrl, isPollDraft, validateClosesAt } from '$lib/utils/polls';
	import { initializeFromApiData } from '$lib/utils/questionnaire-api-converters';
	import {
		addTopLevelQuestion as _addTopLevelQuestion,
		removeTopLevelQuestion as _removeTopLevelQuestion,
		updateTopLevelQuestion as _updateTopLevelQuestion,
		addSection as _addSection,
		removeSection as _removeSection,
		updateSection as _updateSection,
		addQuestionToSection as _addQuestionToSection,
		removeQuestionFromSection as _removeQuestionFromSection,
		updateQuestionInSection as _updateQuestionInSection
	} from '$lib/utils/questionnaire-form-helpers';
	import { savePollQuestionsIncremental } from '$lib/utils/poll-api-sync';
	import type {
		QuestionnaireQuestion as Question,
		QuestionnaireSection as Section
	} from '$lib/utils/questionnaire-form-types';
	import type { PageData } from './$types';

	interface Props {
		data: PageData;
	}
	const { data }: Props = $props();

	const poll = $derived(data.poll);
	const isDraft = $derived(isPollDraft(poll.status));
	const voterUrl = $derived(buildPollVoterUrl($page.url.origin, data.organization.slug, poll.id));

	// Editable state initialized from poll
	let name = $state(poll.questionnaire?.name ?? '');
	let description = $state(poll.questionnaire?.description ?? '');
	let formErrors = $state<{ name?: string }>({});
	let voteVisibility = $state(poll.vote_visibility);
	let resultVisibility = $state(poll.result_visibility);
	let eventId = $state<string | null>(poll.event_id);
	let voteTierIds = $state<string[]>(poll.vote_membership_tier_ids);
	let resultTierIds = $state<string[]>(poll.result_membership_tier_ids);
	let resultTiming = $state(poll.result_timing);
	let staffAnonymous = $state(poll.staff_anonymous);
	let publicAnonymous = $state(poll.public_anonymous);
	let allowVoteChanges = $state(poll.allow_vote_changes);
	// DateTimePicker stores ISO; pass the backend value directly (no conversion needed).
	let closesAt = $state<string | null>(poll.closes_at ?? null);
	let closesAtError = $state<string | null>(null);
	let saving = $state(false);
	let deleting = $state(false);

	// Question editor state (DRAFT only)
	let topLevelQuestions = $state<Question[]>([]);
	let sections = $state<Section[]>([]);
	let questionsInitialized = $state(false);

	// Synthesise a minimal org-questionnaire wrapper so initializeFromApiData
	// can extract topLevelQuestions + sections. Polls have no org wrapper.
	const fakeOrgWrapper = {
		questionnaire_type: 'admission',
		members_exempt: false,
		per_event: false,
		requires_evaluation: false,
		max_submission_age: null
	};

	// Initialize question editor once after load (DRAFT only).
	$effect(() => {
		if (!questionsInitialized && poll.questionnaire) {
			const result = initializeFromApiData(fakeOrgWrapper, poll.questionnaire);
			topLevelQuestions = result.topLevelQuestions ?? [];
			sections = result.sections ?? [];
			questionsInitialized = true;
		}
	});

	// Question editor wrappers
	function addTopLevelQuestion(type: 'multiple_choice' | 'free_text' | 'file_upload') {
		topLevelQuestions = _addTopLevelQuestion(topLevelQuestions, type);
	}
	function removeTopLevelQuestion(id: string) {
		topLevelQuestions = _removeTopLevelQuestion(topLevelQuestions, id);
	}
	function updateTopLevelQuestion(id: string, updates: Partial<Question>) {
		topLevelQuestions = _updateTopLevelQuestion(topLevelQuestions, id, updates);
	}
	function addSection() {
		sections = _addSection(sections);
	}
	function removeSection(id: string) {
		sections = _removeSection(sections, id);
	}
	function updateSection(id: string, updates: Partial<Section>) {
		sections = _updateSection(sections, id, updates);
	}
	function addQuestionToSection(
		sId: string,
		type: 'multiple_choice' | 'free_text' | 'file_upload'
	) {
		sections = _addQuestionToSection(sections, sId, type);
	}
	function removeQuestionFromSection(sId: string, qId: string) {
		sections = _removeQuestionFromSection(sections, sId, qId);
	}
	function updateQuestionInSection(sId: string, qId: string, updates: Partial<Question>) {
		sections = _updateQuestionInSection(sections, sId, qId, updates);
	}

	function moveTopLevelQuestion(index: number, direction: 'up' | 'down') {
		const target = direction === 'up' ? index - 1 : index + 1;
		if (target < 0 || target >= topLevelQuestions.length) return;
		const snap = $state.snapshot(topLevelQuestions);
		[snap[index], snap[target]] = [snap[target], snap[index]];
		topLevelQuestions = snap.map((q, i) => ({ ...q, order: i }));
	}
	function moveSection(index: number, direction: 'up' | 'down') {
		const target = direction === 'up' ? index - 1 : index + 1;
		if (target < 0 || target >= sections.length) return;
		const snap = $state.snapshot(sections);
		[snap[index], snap[target]] = [snap[target], snap[index]];
		sections = snap.map((s, i) => ({ ...s, order: i }));
	}
	function moveQuestionInSection(sId: string, index: number, direction: 'up' | 'down') {
		const snap = $state.snapshot(sections);
		const section = snap.find((s) => s.id === sId);
		if (!section) return;
		const target = direction === 'up' ? index - 1 : index + 1;
		if (target < 0 || target >= section.questions.length) return;
		[section.questions[index], section.questions[target]] = [
			section.questions[target],
			section.questions[index]
		];
		section.questions = section.questions.map((q, i) => ({ ...q, order: i }));
		sections = snap;
	}

	async function save() {
		formErrors = {};
		if (!name.trim()) {
			formErrors = { name: m['pollNewPage.errorNameRequired']() };
			return;
		}
		const err = validateClosesAt(closesAt);
		closesAtError = err ? m['pollNewPage.closesAtPast']() : null;
		if (closesAtError) return;
		saving = true;
		try {
			const res = await pollPatchPoll({
				path: { poll_id: poll.id },
				headers: { Authorization: `Bearer ${authStore.accessToken}` },
				body: {
					name: name.trim(),
					description: description || null,
					vote_visibility: voteVisibility,
					result_visibility: resultVisibility,
					event_id: eventId,
					vote_membership_tier_ids: voteTierIds,
					result_membership_tier_ids: resultTierIds,
					result_timing: resultTiming,
					allow_vote_changes: allowVoteChanges,
					closes_at: closesAt || null
				}
			});
			if (res.error) throw new Error('patch');

			if (isDraft) {
				try {
					await savePollQuestionsIncremental({
						pollId: poll.id,
						accessToken: authStore.accessToken ?? '',
						q: poll.questionnaire,
						sections,
						topLevelQuestions
					});
				} catch (e) {
					console.error('Failed to save questions', e);
					toast.error(m['pollEditPage.saveError']());
					return;
				}
			}

			toast.success(m['pollEditPage.saveSuccess']());
			await invalidateAll();

			// Re-sync the editable form fields from the freshly loaded poll so any
			// server-side normalisation (trimmed name, canonical closes_at, etc.) is
			// reflected instead of leaving the inputs showing the pre-save values.
			name = poll.questionnaire?.name ?? '';
			description = poll.questionnaire?.description ?? '';
			voteVisibility = poll.vote_visibility;
			resultVisibility = poll.result_visibility;
			eventId = poll.event_id;
			voteTierIds = poll.vote_membership_tier_ids;
			resultTierIds = poll.result_membership_tier_ids;
			resultTiming = poll.result_timing;
			staffAnonymous = poll.staff_anonymous;
			publicAnonymous = poll.public_anonymous;
			allowVoteChanges = poll.allow_vote_changes;
			closesAt = poll.closes_at ?? null;

			// Re-derive editor state from the freshly loaded poll so newly-created
			// question/option IDs are tracked for the next incremental save.
			if (isDraft && poll.questionnaire) {
				const result = initializeFromApiData(fakeOrgWrapper, poll.questionnaire);
				topLevelQuestions = result.topLevelQuestions ?? [];
				sections = result.sections ?? [];
			}
		} catch (e) {
			console.error(e);
			toast.error(m['pollEditPage.saveError']());
		} finally {
			saving = false;
		}
	}

	let deleteConfirmOpen = $state(false);
	let isDuplicateModalOpen = $state(false);

	async function deletePoll() {
		deleting = true;
		try {
			const res = await pollDeletePollAction({
				path: { poll_id: poll.id },
				headers: { Authorization: `Bearer ${authStore.accessToken}` }
			});
			if (res.error) throw new Error('delete');
			deleteConfirmOpen = false;
			await goto(`/org/${data.organization.slug}/admin/polls`);
		} catch (e) {
			console.error(e);
			toast.error(m['pollEditPage.deleteError']());
		} finally {
			deleting = false;
		}
	}

	const totalQuestionCount = $derived(
		topLevelQuestions.length + sections.reduce((s, sec) => s + sec.questions.length, 0)
	);
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
	<div class="flex items-center justify-between gap-2">
		<h1 class="text-3xl font-bold tracking-tight">
			{name || poll.questionnaire?.name || m['pollEditPage.pageTitle']()}
		</h1>
		<Button variant="outline" size="sm" class="gap-2" onclick={() => (isDuplicateModalOpen = true)}>
			<Copy class="h-4 w-4" />
			{m['pollEditPage.duplicate']()}
		</Button>
	</div>
</div>

<div class="mx-auto max-w-4xl space-y-6">
	<PollStatusBar {poll} {voterUrl} accessToken={authStore.accessToken ?? ''} />

	<!-- Basics — editable -->
	<Card>
		<CardHeader>
			<CardTitle>{m['pollNewPage.basicsTitle']()}</CardTitle>
			<CardDescription>{m['pollNewPage.basicsDescription']()}</CardDescription>
		</CardHeader>
		<CardContent class="space-y-4">
			<div class="space-y-2">
				<Label for="name">{m['pollNewPage.nameLabel']()}</Label>
				<Input id="name" bind:value={name} />
				{#if formErrors.name}
					<p class="text-sm text-destructive">{formErrors.name}</p>
				{/if}
			</div>
			<MarkdownEditor
				id="description"
				label={m['pollNewPage.descriptionLabel']()}
				bind:value={description}
				placeholder={m['pollNewPage.descriptionPlaceholder']()}
				rows={3}
			/>
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

	<!-- Questions -->
	<Card>
		<CardHeader>
			<div class="flex items-center justify-between">
				<div>
					<CardTitle>{m['pollNewPage.questionsTitle']()} ({totalQuestionCount})</CardTitle>
					{#if !isDraft}
						<CardDescription
							class="mt-2 rounded-md bg-amber-50 p-2 text-amber-900 dark:bg-amber-950/30 dark:text-amber-200"
						>
							{m['pollEditPage.questionsLockedBanner']()}
						</CardDescription>
					{/if}
				</div>
				{#if isDraft}
					<div class="flex flex-wrap gap-2">
						<Button
							variant="outline"
							size="sm"
							onclick={() => addTopLevelQuestion('multiple_choice')}
							class="gap-2"
						>
							<Plus class="h-4 w-4" />
							{m['questionAnswerDisplay.multipleChoice']()}
						</Button>
						<Button
							variant="outline"
							size="sm"
							onclick={() => addTopLevelQuestion('free_text')}
							class="gap-2"
						>
							<Plus class="h-4 w-4" />
							{m['questionAnswerDisplay.freeText']()}
						</Button>
						<Button
							variant="outline"
							size="sm"
							onclick={() => addTopLevelQuestion('file_upload')}
							class="gap-2"
						>
							<Upload class="h-4 w-4" />
							{m['questionAnswerDisplay.fileUpload']()}
						</Button>
						<Button variant="secondary" size="sm" onclick={addSection} class="gap-2">
							<FolderPlus class="h-4 w-4" />
							{m['pollEditPage.addSection']()}
						</Button>
					</div>
				{/if}
			</div>
		</CardHeader>
		<CardContent class="space-y-6">
			{#if isDraft}
				<div class="space-y-4">
					{#each topLevelQuestions as question, index (question.id)}
						<QuestionEditor
							{question}
							onUpdate={(u) => updateTopLevelQuestion(question.id, u)}
							onRemove={() => removeTopLevelQuestion(question.id)}
							onMoveUp={() => moveTopLevelQuestion(index, 'up')}
							onMoveDown={() => moveTopLevelQuestion(index, 'down')}
							isFirst={index === 0}
							isLast={index === topLevelQuestions.length - 1}
							showLlmGuidelines={false}
						/>
					{/each}
				</div>
				<div class="space-y-4">
					{#each sections as section, index (section.id)}
						<SectionEditor
							{section}
							onUpdate={(u) => updateSection(section.id, u)}
							onRemove={() => removeSection(section.id)}
							onMoveUp={() => moveSection(index, 'up')}
							onMoveDown={() => moveSection(index, 'down')}
							isFirst={index === 0}
							isLast={index === sections.length - 1}
							onAddQuestion={(t) => addQuestionToSection(section.id, t)}
							onUpdateQuestion={(qId, u) => updateQuestionInSection(section.id, qId, u)}
							onRemoveQuestion={(qId) => removeQuestionFromSection(section.id, qId)}
							onMoveQuestionUp={(qi) => moveQuestionInSection(section.id, qi, 'up')}
							onMoveQuestionDown={(qi) => moveQuestionInSection(section.id, qi, 'down')}
							showLlmGuidelines={false}
						/>
					{/each}
				</div>
				{#if topLevelQuestions.length === 0 && sections.length === 0}
					<div class="rounded-lg border border-dashed p-8 text-center">
						<p class="text-sm text-muted-foreground">{m['pollEditPage.noQuestionsYet']()}</p>
					</div>
				{/if}
			{:else if poll.questionnaire}
				{@const q = poll.questionnaire}
				{@const allMc = q.multiple_choice_questions ?? []}
				{@const allFt = q.free_text_questions ?? []}
				{@const allFu = q.file_upload_questions ?? []}
				{#if allMc.length + allFt.length + allFu.length > 0}
					<div class="space-y-3">
						{#each allMc as question (question.id)}
							<div class="rounded-lg border p-4">
								<span
									class="mb-2 inline-block rounded bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-700"
									>{m['questionAnswerDisplay.multipleChoice']()}</span
								>
								<p class="font-medium">{question.question}</p>
								{#if question.options}
									<div class="mt-2 space-y-1">
										{#each question.options as opt, i (i)}
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
									>{m['questionAnswerDisplay.freeText']()}</span
								>
								<p class="font-medium">{question.question}</p>
							</div>
						{/each}
						{#each allFu as question (question.id)}
							<div class="rounded-lg border p-4">
								<span
									class="mb-2 inline-block rounded bg-green-100 px-2 py-0.5 text-xs font-medium text-green-700"
									>{m['questionAnswerDisplay.fileUpload']()}</span
								>
								<p class="font-medium">{question.question}</p>
							</div>
						{/each}
					</div>
				{:else}
					<p class="text-sm italic text-muted-foreground">
						{m['pollEditPage.noQuestionsDefined']()}
					</p>
				{/if}
			{:else}
				<p class="text-sm italic text-muted-foreground">{m['pollEditPage.noQuestionnaire']()}</p>
			{/if}
		</CardContent>
	</Card>

	<!-- Results -->
	<Card id="results">
		<CardHeader>
			<CardTitle>{m['pollEditPage.resultsTitle']()}</CardTitle>
		</CardHeader>
		<CardContent>
			{#if poll.results && poll.results.total_voters > 0}
				<PollResultsView results={poll.results} staffAnonymous={poll.staff_anonymous} />
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
					onclick={() => (deleteConfirmOpen = true)}
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

<ConfirmDialog
	isOpen={deleteConfirmOpen}
	variant="danger"
	title={m['pollEditPage.deleteSectionTitle']()}
	message={m['pollEditPage.deleteConfirm']({ name: poll.questionnaire?.name ?? '' })}
	confirmText={m['pollEditPage.deleteButton']()}
	onCancel={() => (deleteConfirmOpen = false)}
	onConfirm={deletePoll}
/>

<DuplicatePollModal
	bind:open={isDuplicateModalOpen}
	pollId={poll.id}
	pollName={poll.questionnaire?.name ?? ''}
	organizationSlug={data.organization.slug}
	onClose={() => (isDuplicateModalOpen = false)}
/>
