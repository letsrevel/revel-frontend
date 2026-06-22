<script lang="ts">
	import * as m from '$lib/paraglide/messages.js';
	import { DurationInput } from '$lib/components/forms';
	import { Input } from '$lib/components/ui/input';
	import { Label } from '$lib/components/ui/label';
	import { Textarea } from '$lib/components/ui/textarea';
	import { Select, SelectContent, SelectItem, SelectTrigger } from '$lib/components/ui/select';
	import {
		Card,
		CardContent,
		CardDescription,
		CardHeader,
		CardTitle
	} from '$lib/components/ui/card';
	import type { QuestionnaireEvaluationMode } from '$lib/api/generated/types.gen';

	interface Props {
		name: string;
		questionnaireType: 'admission' | 'membership' | 'feedback' | 'generic';
		requiresEvaluation: boolean;
		effectiveRequiresEvaluation: boolean;
		minScore: number;
		evaluationMode: QuestionnaireEvaluationMode;
		shuffleQuestions: boolean;
		shuffleSections: boolean;
		membersExempt: boolean;
		perEvent: boolean;
		llmGuidelines: string;
		maxSubmissionAge: number | null;
		canRetakeAfter: number | null;
		maxAttempts: number;
		canEdit: boolean;
		nameError?: string;
		onNameChange: (value: string) => void;
		onQuestionnaireTypeChange: (value: 'admission' | 'membership' | 'feedback' | 'generic') => void;
		onRequiresEvaluationChange: (value: boolean) => void;
		onMinScoreChange: (value: number) => void;
		onEvaluationModeChange: (value: QuestionnaireEvaluationMode) => void;
		onShuffleQuestionsChange: (value: boolean) => void;
		onShuffleSectionsChange: (value: boolean) => void;
		onMembersExemptChange: (value: boolean) => void;
		onPerEventChange: (value: boolean) => void;
		onLlmGuidelinesChange: (value: string) => void;
		onMaxSubmissionAgeChange: (value: number | null) => void;
		onCanRetakeAfterChange: (value: number | null) => void;
		onMaxAttemptsChange: (value: number) => void;
	}

	const {
		name,
		questionnaireType,
		requiresEvaluation,
		effectiveRequiresEvaluation,
		minScore,
		evaluationMode,
		shuffleQuestions,
		shuffleSections,
		membersExempt,
		perEvent,
		llmGuidelines,
		maxSubmissionAge,
		canRetakeAfter,
		maxAttempts,
		canEdit,
		nameError,
		onNameChange,
		onQuestionnaireTypeChange,
		onRequiresEvaluationChange,
		onMinScoreChange,
		onEvaluationModeChange,
		onShuffleQuestionsChange,
		onShuffleSectionsChange,
		onMembersExemptChange,
		onPerEventChange,
		onLlmGuidelinesChange,
		onMaxSubmissionAgeChange,
		onCanRetakeAfterChange,
		onMaxAttemptsChange
	}: Props = $props();

	// Questionnaire type labels
	const questionnaireTypes = {
		admission: {
			label: m['questionnaireEditPage.types.admission_label'](),
			description: m['questionnaireEditPage.types.admission_description']()
		},
		membership: {
			label: m['questionnaireEditPage.types.membership_label'](),
			description: m['questionnaireEditPage.types.membership_description']()
		},
		feedback: {
			label: m['questionnaireEditPage.types.feedback_label'](),
			description: m['questionnaireEditPage.types.feedback_description']()
		},
		generic: {
			label: m['questionnaireEditPage.types.generic_label'](),
			description: m['questionnaireEditPage.types.generic_description']()
		}
	};

	const selectedTypeLabel = $derived(questionnaireTypes[questionnaireType]?.label ?? 'Generic');
	const selectedTypeDescription = $derived(
		questionnaireTypes[questionnaireType]?.description ??
			m['questionnaireEditPage.types.generic_description']()
	);

	// Evaluation mode descriptions
	const evaluationModes: Record<
		QuestionnaireEvaluationMode,
		{ label: string; description: string }
	> = {
		automatic: {
			label: m['questionnaireEditPage.evaluation.automatic_label'](),
			description: m['questionnaireEditPage.evaluation.automatic_description']()
		},
		manual: {
			label: m['questionnaireEditPage.evaluation.manual_label'](),
			description: m['questionnaireEditPage.evaluation.manual_description']()
		},
		hybrid: {
			label: m['questionnaireEditPage.evaluation.hybrid_label'](),
			description: m['questionnaireEditPage.evaluation.hybrid_description']()
		}
	};

	const selectedEvaluationDescription = $derived(
		evaluationModes[evaluationMode]?.description ??
			m['questionnaireEditPage.evaluation.manual_description']()
	);
</script>

<!-- Basic Information -->
<Card>
	<CardHeader>
		<CardTitle>{m['questionnaireEditPage.basicInfo.title']()}</CardTitle>
		<CardDescription>{m['questionnaireEditPage.basicInfo.description']()}</CardDescription>
	</CardHeader>
	<CardContent class="space-y-4">
		<!-- Name -->
		<div class="space-y-2">
			<Label for="name">
				{m['questionnaireFormFields.nameLabel']()}
				<span class="text-destructive">*</span>
			</Label>
			<Input
				id="name"
				value={name}
				oninput={(e) => onNameChange(e.currentTarget.value)}
				placeholder={m['questionnaireFormFields.namePlaceholder']()}
				class={nameError ? 'border-destructive' : ''}
				disabled={!canEdit}
			/>
			{#if nameError}
				<p class="text-sm text-destructive">{nameError}</p>
			{/if}
		</div>

		<!-- Type -->
		<div class="space-y-2">
			<Label for="type">
				{m['questionnaireFormFields.typeLabel']()}
				<span class="text-destructive">*</span>
			</Label>
			<Select
				type="single"
				value={questionnaireType}
				onValueChange={(v) => {
					if (
						canEdit &&
						(v === 'admission' || v === 'membership' || v === 'feedback' || v === 'generic')
					) {
						onQuestionnaireTypeChange(v);
					}
				}}
				disabled={!canEdit}
			>
				<SelectTrigger id="type">
					{selectedTypeLabel}
				</SelectTrigger>
				<SelectContent>
					<SelectItem value="admission" label={m['questionnaireEditPage.types.admission_label']()}>
						<div class="flex flex-col gap-0.5">
							<div class="font-medium">{m['questionnaireEditPage.types.admission_label']()}</div>
							<div class="text-xs text-muted-foreground">
								{m['questionnaireEditPage.types.admission_description']()}
							</div>
						</div>
					</SelectItem>
					<SelectItem
						value="membership"
						label={m['questionnaireEditPage.types.membership_label']()}
						disabled
					>
						<div class="flex flex-col gap-0.5">
							<div class="flex items-center gap-2 font-medium">
								{m['questionnaireEditPage.types.membership_label']()}
								<span
									class="rounded bg-muted px-1.5 py-0.5 text-[10px] font-normal text-muted-foreground"
									>{m['questionnaireFormFields.comingSoon']()}</span
								>
							</div>
							<div class="text-xs text-muted-foreground">
								{m['questionnaireEditPage.types.membership_description']()}
							</div>
						</div>
					</SelectItem>
					<SelectItem value="feedback" label={m['questionnaireEditPage.types.feedback_label']()}>
						<div class="flex flex-col gap-0.5">
							<div class="font-medium">{m['questionnaireEditPage.types.feedback_label']()}</div>
							<div class="text-xs text-muted-foreground">
								{m['questionnaireEditPage.types.feedback_description']()}
							</div>
						</div>
					</SelectItem>
					<SelectItem
						value="generic"
						label={m['questionnaireEditPage.types.generic_label']()}
						disabled
					>
						<div class="flex flex-col gap-0.5">
							<div class="flex items-center gap-2 font-medium">
								{m['questionnaireEditPage.types.generic_label']()}
								<span
									class="rounded bg-muted px-1.5 py-0.5 text-[10px] font-normal text-muted-foreground"
									>{m['questionnaireFormFields.comingSoon']()}</span
								>
							</div>
							<div class="text-xs text-muted-foreground">
								{m['questionnaireEditPage.types.generic_description']()}
							</div>
						</div>
					</SelectItem>
				</SelectContent>
			</Select>
			<p class="text-xs text-muted-foreground">
				{selectedTypeDescription}
			</p>
		</div>

		<!-- Requires Evaluation -->
		<div class="space-y-2">
			<div class="flex items-center space-x-2">
				<input
					id="requires-evaluation"
					type="checkbox"
					checked={requiresEvaluation}
					onchange={(e) => onRequiresEvaluationChange(e.currentTarget.checked)}
					class="h-4 w-4 rounded border-gray-300"
					disabled={!canEdit || questionnaireType === 'feedback'}
				/>
				<Label for="requires-evaluation" class="font-normal"
					>{m['questionnaireEditPage.evaluation.requiresEvaluationLabel']()}</Label
				>
			</div>
			{#if questionnaireType === 'feedback'}
				<p class="text-xs italic text-muted-foreground">
					{m['questionnaireEditPage.evaluation.feedbackNoEvaluation']()}
				</p>
			{:else}
				<p class="text-xs text-muted-foreground">
					{m['questionnaireEditPage.evaluation.requiresEvaluationDescription']()}
				</p>
			{/if}
		</div>

		{#if effectiveRequiresEvaluation}
			<!-- Minimum Score -->
			<div class="space-y-2">
				<Label for="min-score">
					{m['questionnaireFormFields.minScoreLabel']()}
					<span class="text-destructive">*</span>
				</Label>
				<Input
					id="min-score"
					type="number"
					value={minScore}
					oninput={(e) => onMinScoreChange(Number(e.currentTarget.value))}
					min="0"
					max="100"
					step="1"
					placeholder="0"
					disabled={!canEdit}
				/>
				<p class="text-xs text-muted-foreground">
					{m['questionnaireEditPage.evaluation.minScoreDescription']()}
				</p>
			</div>

			<!-- Evaluation Mode -->
			<div class="space-y-2">
				<Label for="evaluation-mode">
					{m['questionnaireFormFields.evaluationModeLabel']()}
					<span class="text-destructive">*</span>
				</Label>
				<Select
					type="single"
					value={evaluationMode}
					onValueChange={(v) => {
						if (v && canEdit) {
							onEvaluationModeChange(v as QuestionnaireEvaluationMode);
						}
					}}
					disabled={!canEdit}
				>
					<SelectTrigger id="evaluation-mode">
						{evaluationModes[evaluationMode]?.label ?? 'Manual'}
					</SelectTrigger>
					<SelectContent>
						<SelectItem value="manual" label={m['questionnaireEditPage.evaluation.manual_label']()}>
							<div class="flex flex-col gap-0.5">
								<div class="font-medium">
									{m['questionnaireEditPage.evaluation.manual_label']()}
								</div>
								<div class="text-xs text-muted-foreground">
									{m['questionnaireEditPage.evaluation.manual_description']()}
								</div>
							</div>
						</SelectItem>
						<SelectItem
							value="hybrid"
							label={m['questionnaireEditPage.evaluation.hybrid_label']()}
							disabled
						>
							<div class="flex flex-col gap-0.5">
								<div class="flex items-center gap-2 font-medium">
									{m['questionnaireEditPage.evaluation.hybrid_label']()}
									<span
										class="rounded bg-muted px-1.5 py-0.5 text-[10px] font-normal text-muted-foreground"
										>{m['questionnaireFormFields.comingSoon']()}</span
									>
								</div>
								<div class="text-xs text-muted-foreground">
									{m['questionnaireEditPage.evaluation.hybrid_description']()}
								</div>
							</div>
						</SelectItem>
						<SelectItem
							value="automatic"
							label={m['questionnaireEditPage.evaluation.automatic_label']()}
							disabled
						>
							<div class="flex flex-col gap-0.5">
								<div class="flex items-center gap-2 font-medium">
									{m['questionnaireEditPage.evaluation.automatic_label']()}
									<span
										class="rounded bg-muted px-1.5 py-0.5 text-[10px] font-normal text-muted-foreground"
										>{m['questionnaireFormFields.comingSoon']()}</span
									>
								</div>
								<div class="text-xs text-muted-foreground">
									{m['questionnaireEditPage.evaluation.automatic_description']()}
								</div>
							</div>
						</SelectItem>
					</SelectContent>
				</Select>
				<p class="text-xs text-muted-foreground">
					{selectedEvaluationDescription}
				</p>
			</div>
		{/if}
	</CardContent>
</Card>

<!-- Advanced Settings -->
<Card>
	<CardHeader>
		<CardTitle>{m['questionnaireEditPage.advanced.title']()}</CardTitle>
		<CardDescription>{m['questionnaireFormFields.advancedDescription']()}</CardDescription>
	</CardHeader>
	<CardContent class="space-y-4">
		<!-- Shuffle Options -->
		<div class="space-y-3">
			<div class="flex items-center space-x-2">
				<input
					id="shuffle-questions"
					type="checkbox"
					checked={shuffleQuestions}
					onchange={(e) => onShuffleQuestionsChange(e.currentTarget.checked)}
					class="h-4 w-4 rounded border-gray-300"
					disabled={!canEdit}
				/>
				<Label for="shuffle-questions" class="font-normal"
					>{m['questionnaireFormFields.shuffleQuestionsLabel']()}</Label
				>
			</div>
			<div class="flex items-center space-x-2">
				<input
					id="shuffle-sections"
					type="checkbox"
					checked={shuffleSections}
					onchange={(e) => onShuffleSectionsChange(e.currentTarget.checked)}
					class="h-4 w-4 rounded border-gray-300"
					disabled={!canEdit}
				/>
				<Label for="shuffle-sections" class="font-normal"
					>{m['questionnaireFormFields.shuffleSectionsLabel']()}</Label
				>
			</div>
		</div>

		<!-- Members Exempt -->
		<div class="space-y-2">
			<div class="flex items-center space-x-2">
				<input
					id="members-exempt"
					type="checkbox"
					checked={membersExempt}
					onchange={(e) => onMembersExemptChange(e.currentTarget.checked)}
					class="h-4 w-4 rounded border-gray-300"
					disabled={!canEdit}
				/>
				<Label for="members-exempt" class="font-normal"
					>{m['questionnaireEditPage.membersExemptLabel']()}</Label
				>
			</div>
			<p class="text-xs text-muted-foreground">
				{m['questionnaireEditPage.membersExemptDescription']()}
			</p>
		</div>

		<!-- Per-Event Completion (only for admission type) -->
		{#if questionnaireType === 'admission'}
			<div class="space-y-2">
				<div class="flex items-center space-x-2">
					<input
						id="per-event"
						type="checkbox"
						checked={perEvent}
						onchange={(e) => onPerEventChange(e.currentTarget.checked)}
						class="h-4 w-4 rounded border-gray-300"
						disabled={!canEdit}
					/>
					<Label for="per-event" class="font-normal"
						>{m['questionnaireEditPage.perEventLabel']()}</Label
					>
				</div>
				<p class="text-xs text-muted-foreground">
					{m['questionnaireEditPage.perEventDescription']()}
				</p>
			</div>
		{/if}

		{#if effectiveRequiresEvaluation && evaluationMode !== 'manual'}
			<!-- LLM Guidelines -->
			<div class="space-y-2">
				<Label for="llm-guidelines"
					>{m['questionnaireEditPage.advanced.llmGuidelinesLabel']()}</Label
				>
				<Textarea
					id="llm-guidelines"
					value={llmGuidelines}
					oninput={(e) => onLlmGuidelinesChange(e.currentTarget.value)}
					placeholder={m['questionnaireEditPage.advanced.llmGuidelinesPlaceholder']()}
					rows={4}
					disabled={!canEdit}
				/>
				<p class="text-xs text-muted-foreground">
					{m['questionnaireEditPage.advanced.llmGuidelinesDescription']()}
				</p>
			</div>
		{/if}

		<!-- Duration Settings -->
		<div class="grid gap-4 sm:grid-cols-2">
			<DurationInput
				id="max-submission-age"
				label={m['questionnaireEditPage.advanced.submissionValidityLabel']()}
				helpText={m['questionnaireEditPage.advanced.submissionValidityDescription']()}
				bind:value={() => maxSubmissionAge, (v) => onMaxSubmissionAgeChange(v)}
				storageUnit="days"
				defaultUnit="days"
				emptyValue={null}
				emptyLabel={m['questionnaireEditPage.advanced.submissionValidityNoLimit']()}
				disabled={!canEdit}
			/>

			<DurationInput
				id="can-retake-after"
				label={m['questionnaireEditPage.advanced.retakeCooldownLabel']()}
				helpText={m['questionnaireEditPage.advanced.retakeCooldownDescription']()}
				bind:value={() => canRetakeAfter, (v) => onCanRetakeAfterChange(v)}
				storageUnit="hours"
				defaultUnit="hours"
				emptyValue={null}
				emptyLabel={m['questionnaireEditPage.advanced.retakeCooldownNoLimit']()}
				disabled={!canEdit}
			/>
		</div>

		<!-- Max Attempts -->
		<div class="space-y-2">
			<Label for="max-attempts">
				{m['questionnaireEditPage.advanced.maxAttemptsLabel']()}
				<span class="text-destructive">*</span>
			</Label>
			<Input
				id="max-attempts"
				type="number"
				value={maxAttempts}
				oninput={(e) => onMaxAttemptsChange(Number(e.currentTarget.value))}
				min="0"
				step="1"
				required
				disabled={!canEdit}
			/>
			<p class="text-xs text-muted-foreground">
				{m['questionnaireEditPage.advanced.maxAttemptsDescription']()}
			</p>
		</div>
	</CardContent>
</Card>
