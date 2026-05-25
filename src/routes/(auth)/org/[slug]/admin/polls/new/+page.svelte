<script lang="ts">
	import * as m from '$lib/paraglide/messages.js';
	import { authStore } from '$lib/stores/auth.svelte';
	import { goto } from '$app/navigation';
	import { ArrowLeft, Plus, FolderPlus, Upload } from 'lucide-svelte';
	import { Button } from '$lib/components/ui/button';
	import { Input } from '$lib/components/ui/input';
	import { Label } from '$lib/components/ui/label';
	import {
		Card,
		CardContent,
		CardDescription,
		CardHeader,
		CardTitle
	} from '$lib/components/ui/card';
	import MarkdownEditor from '$lib/components/forms/MarkdownEditor.svelte';
	import QuestionEditor from '$lib/components/questionnaires/QuestionEditor.svelte';
	import SectionEditor from '$lib/components/questionnaires/SectionEditor.svelte';
	import PollAudienceCard from '$lib/components/polls/PollAudienceCard.svelte';
	import PollAnonymityCard from '$lib/components/polls/PollAnonymityCard.svelte';
	import PollScheduleCard from '$lib/components/polls/PollScheduleCard.svelte';
	import { pollCreatePoll } from '$lib/api/generated/sdk.gen';
	import type { PageData } from './$types';
	import type {
		PollResultTiming,
		ResourceVisibility,
		SectionCreateSchema,
		MultipleChoiceQuestionCreateSchema,
		FreeTextQuestionCreateSchema,
		FileUploadQuestionCreateSchema
	} from '$lib/api/generated/types.gen';
	import type {
		QuestionnaireQuestion as Question,
		QuestionnaireSection as Section
	} from '$lib/utils/questionnaire-form-types';
	import {
		addTopLevelQuestion as _addTopLevelQuestion,
		removeTopLevelQuestion as _removeTopLevelQuestion,
		updateTopLevelQuestion as _updateTopLevelQuestion,
		addSection as _addSection,
		removeSection as _removeSection,
		updateSection as _updateSection,
		addQuestionToSection as _addQuestionToSection,
		removeQuestionFromSection as _removeQuestionFromSection,
		updateQuestionInSection as _updateQuestionInSection,
		mcQuestionToCreateApiFormat,
		ftQuestionToCreateApiFormat,
		fuQuestionToCreateApiFormat,
		buildCreateApiSections,
		parseValidationErrors
	} from '$lib/utils/questionnaire-form-helpers';
	import { validateClosesAt } from '$lib/utils/polls';

	interface Props {
		data: PageData;
	}
	const { data }: Props = $props();

	// Basics
	let name = $state('');
	let description = $state('');
	let shuffleQuestions = $state(false);
	let shuffleSections = $state(false);

	// Audience
	let voteVisibility = $state<ResourceVisibility>('members-only');
	let resultVisibility = $state<ResourceVisibility>('staff-only');
	let eventId = $state<string | null>(null);
	let voteTierIds = $state<string[]>([]);
	let resultTierIds = $state<string[]>([]);

	// Anonymity
	let resultTiming = $state<PollResultTiming>('never');
	let staffAnonymous = $state(true);
	let publicAnonymous = $state(true);
	let allowVoteChanges = $state(false);

	// Schedule
	let closesAt = $state<string | null>(null);
	let closesAtError = $state<string | null>(null);

	// Questions
	let topLevelQuestions = $state<Question[]>([]);
	let sections = $state<Section[]>([]);
	const allQuestions = $derived([...topLevelQuestions, ...sections.flatMap((s) => s.questions)]);
	const totalQuestionCount = $derived(allQuestions.length);

	// Errors + saving
	let saveError = $state<string | null>(null);
	let formErrors = $state<{ name?: string; questions?: string; event?: string }>({});
	let isSaving = $state(false);

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

	function validate(): boolean {
		formErrors = {};
		if (!name.trim()) formErrors.name = m['pollNewPage.errorNameRequired']();
		if (totalQuestionCount === 0) {
			formErrors.questions = m['pollNewPage.errorNoQuestions']();
		} else if (allQuestions.some((q) => !q.text.trim())) {
			formErrors.questions = m['pollNewPage.errorQuestionsNeedText']();
		}
		const eventRequired =
			voteVisibility === 'private' ||
			voteVisibility === 'attendees-only' ||
			resultVisibility === 'private' ||
			resultVisibility === 'attendees-only';
		if (eventRequired && !eventId) formErrors.event = m['pollNewPage.errorEventRequired']();
		const closesError = validateClosesAt(closesAt);
		closesAtError = closesError ? m['pollNewPage.closesAtPast']() : null;
		return Object.keys(formErrors).length === 0 && !closesAtError;
	}

	async function save() {
		saveError = null;
		if (!validate()) return;
		isSaving = true;
		try {
			const res = await pollCreatePoll({
				path: { organization_id: data.organization.id },
				headers: { Authorization: `Bearer ${authStore.accessToken}` },
				body: {
					name,
					description: description || null,
					shuffle_questions: shuffleQuestions,
					shuffle_sections: shuffleSections,
					vote_visibility: voteVisibility,
					result_visibility: resultVisibility,
					event_id: eventId,
					vote_membership_tier_ids: voteTierIds,
					result_membership_tier_ids: resultTierIds,
					result_timing: resultTiming,
					staff_anonymous: staffAnonymous,
					public_anonymous: publicAnonymous,
					allow_vote_changes: allowVoteChanges,
					closes_at: closesAt ? new Date(closesAt).toISOString() : null,
					sections: buildCreateApiSections(sections) as SectionCreateSchema[],
					multiplechoicequestion_questions: topLevelQuestions
						.filter((q) => q.type === 'multiple_choice')
						.map(mcQuestionToCreateApiFormat) as MultipleChoiceQuestionCreateSchema[],
					freetextquestion_questions: topLevelQuestions
						.filter((q) => q.type === 'free_text')
						.map(ftQuestionToCreateApiFormat) as FreeTextQuestionCreateSchema[],
					fileuploadquestion_questions: topLevelQuestions
						.filter((q) => q.type === 'file_upload')
						.map(fuQuestionToCreateApiFormat) as FileUploadQuestionCreateSchema[]
				}
			});
			if (res.error) {
				if (res.response.status === 422) {
					saveError = parseValidationErrors(res.error);
				} else {
					saveError = `Failed to create poll (HTTP ${res.response.status}).`;
				}
				return;
			}
			await goto(`/org/${data.organization.slug}/admin/polls/${res.data!.id}`);
		} catch (err) {
			console.error(err);
			saveError = String(err);
		} finally {
			isSaving = false;
		}
	}
</script>

<svelte:head>
	<title>{m['pollNewPage.pageTitle']()} - {data.organization.name} Admin</title>
</svelte:head>

<div class="mb-6">
	<Button
		href="/org/{data.organization.slug}/admin/polls"
		variant="ghost"
		size="sm"
		class="mb-4 gap-2"
	>
		<ArrowLeft class="h-4 w-4" />
		{m['pollNewPage.backToList']()}
	</Button>
	<h1 class="text-3xl font-bold tracking-tight">{m['pollNewPage.pageTitle']()}</h1>
</div>

<div class="mx-auto max-w-4xl space-y-6">
	<!-- Basics -->
	<Card>
		<CardHeader>
			<CardTitle>{m['pollNewPage.basicsTitle']()}</CardTitle>
			<CardDescription>{m['pollNewPage.basicsDescription']()}</CardDescription>
		</CardHeader>
		<CardContent class="space-y-4">
			<div class="space-y-2">
				<Label for="name"
					>{m['pollNewPage.nameLabel']()} <span class="text-destructive">*</span></Label
				>
				<Input
					id="name"
					bind:value={name}
					placeholder={m['pollNewPage.namePlaceholder']()}
					class={formErrors.name ? 'border-destructive' : ''}
				/>
				{#if formErrors.name}<p class="text-sm text-destructive">{formErrors.name}</p>{/if}
			</div>
			<MarkdownEditor
				id="description"
				label={m['pollNewPage.descriptionLabel']()}
				bind:value={description}
				placeholder={m['pollNewPage.descriptionPlaceholder']()}
				rows={3}
			/>
			<div class="space-y-2">
				<label class="flex items-center gap-2 text-sm">
					<input type="checkbox" bind:checked={shuffleQuestions} class="h-4 w-4" />
					{m['pollNewPage.shuffleQuestions']()}
				</label>
				<label class="flex items-center gap-2 text-sm">
					<input type="checkbox" bind:checked={shuffleSections} class="h-4 w-4" />
					{m['pollNewPage.shuffleSections']()}
				</label>
			</div>
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
	{#if formErrors.event}
		<p class="text-sm text-destructive">{formErrors.event}</p>
	{/if}

	<PollAnonymityCard
		bind:resultTiming
		bind:staffAnonymous
		bind:publicAnonymous
		bind:allowVoteChanges
		{resultVisibility}
		mode="create"
	/>

	<PollScheduleCard bind:closesAt error={closesAtError} />

	<!-- Questions -->
	<Card>
		<CardHeader>
			<div class="flex items-center justify-between">
				<div>
					<CardTitle>{m['pollNewPage.questionsTitle']()} ({totalQuestionCount})</CardTitle>
				</div>
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
						{m['pollNewPage.addSection']()}
					</Button>
				</div>
			</div>
		</CardHeader>
		<CardContent class="space-y-6">
			{#if totalQuestionCount === 0 && sections.length === 0}
				<div class="rounded-lg border border-dashed p-8 text-center">
					<p class="text-sm text-muted-foreground">{m['pollNewPage.noQuestionsYet']()}</p>
				</div>
			{:else}
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
			{/if}
			{#if formErrors.questions}
				<p class="text-sm text-destructive">{formErrors.questions}</p>
			{/if}
		</CardContent>
	</Card>

	{#if saveError}
		<Card class="border-destructive bg-destructive/10">
			<CardContent class="py-4">
				<p class="font-medium text-destructive">{m['pollNewPage.errorTitle']()}</p>
				<p class="mt-1 whitespace-pre-wrap text-sm text-destructive/90">{saveError}</p>
			</CardContent>
		</Card>
	{/if}

	<div class="flex justify-end gap-3">
		<Button href="/org/{data.organization.slug}/admin/polls" variant="outline"
			>{m['pollNewPage.cancel']()}</Button
		>
		<Button onclick={save} disabled={isSaving}>
			{isSaving ? m['pollNewPage.creating']() : m['pollNewPage.createButton']()}
		</Button>
	</div>
</div>
