<script lang="ts">
	import * as m from '$lib/paraglide/messages.js';
	import { DurationInput } from '$lib/components/forms';
	import { Input } from '$lib/components/ui/input';
	import { Label } from '$lib/components/ui/label';
	import { Textarea } from '$lib/components/ui/textarea';
	import {
		Card,
		CardContent,
		CardDescription,
		CardHeader,
		CardTitle
	} from '$lib/components/ui/card';

	interface Props {
		questionnaireType: 'admission' | 'membership' | 'feedback' | 'generic';
		shuffleQuestions: boolean;
		shuffleSections: boolean;
		membersExempt: boolean;
		perEvent: boolean;
		llmGuidelines: string;
		maxSubmissionAge: number | null;
		canRetakeAfter: number | null;
		maxAttempts: number;
		showLlmGuidelines: boolean;
		needsLlmGuidelines: boolean;
		showLlmWarning: boolean;
	}

	let {
		questionnaireType,
		shuffleQuestions = $bindable(),
		shuffleSections = $bindable(),
		membersExempt = $bindable(),
		perEvent = $bindable(),
		llmGuidelines = $bindable(),
		maxSubmissionAge = $bindable(),
		canRetakeAfter = $bindable(),
		maxAttempts = $bindable(),
		showLlmGuidelines,
		needsLlmGuidelines,
		showLlmWarning
	}: Props = $props();
</script>

<!-- Advanced Settings -->
<Card>
	<CardHeader>
		<CardTitle>{m['questionnaireNewPage.advancedSettingsTitle']()}</CardTitle>
		<CardDescription>{m['questionnaireNewPage.advancedSettingsDescription']()}</CardDescription>
	</CardHeader>
	<CardContent class="space-y-4">
		<!-- Shuffle Options -->
		<div class="space-y-3">
			<div class="flex items-center space-x-2">
				<input
					id="shuffle-questions"
					type="checkbox"
					bind:checked={shuffleQuestions}
					class="h-4 w-4 rounded border-gray-300"
				/>
				<Label for="shuffle-questions" class="font-normal"
					>{m['questionnaireNewPage.shuffleQuestionsLabel']()}</Label
				>
			</div>
			<div class="flex items-center space-x-2">
				<input
					id="shuffle-sections"
					type="checkbox"
					bind:checked={shuffleSections}
					class="h-4 w-4 rounded border-gray-300"
				/>
				<Label for="shuffle-sections" class="font-normal"
					>{m['questionnaireNewPage.shuffleSectionsLabel']()}</Label
				>
			</div>
		</div>

		<!-- Members Exempt -->
		<div class="space-y-2">
			<div class="flex items-center space-x-2">
				<input
					id="members-exempt"
					type="checkbox"
					bind:checked={membersExempt}
					class="h-4 w-4 rounded border-gray-300"
				/>
				<Label for="members-exempt" class="font-normal"
					>{m['questionnaireNewPage.membersExemptLabel']()}</Label
				>
			</div>
			<p class="text-xs text-muted-foreground">
				{m['questionnaireNewPage.membersExemptDescription']()}
			</p>
		</div>

		<!-- Per-Event Completion (only for admission type) -->
		{#if questionnaireType === 'admission'}
			<div class="space-y-2">
				<div class="flex items-center space-x-2">
					<input
						id="per-event"
						type="checkbox"
						bind:checked={perEvent}
						class="h-4 w-4 rounded border-gray-300"
					/>
					<Label for="per-event" class="font-normal"
						>{m['questionnaireNewPage.perEventLabel']()}</Label
					>
				</div>
				<p class="text-xs text-muted-foreground">
					{m['questionnaireNewPage.perEventDescription']()}
				</p>
			</div>
		{/if}

		{#if showLlmGuidelines}
			<!-- LLM Guidelines -->
			<div class="space-y-2">
				<Label for="llm-guidelines">
					{m['questionnaireNewPage.llmGuidelinesFieldLabel']()}
					{#if needsLlmGuidelines}
						<span class="text-destructive">*</span>
					{/if}
				</Label>
				<Textarea
					id="llm-guidelines"
					bind:value={llmGuidelines}
					placeholder={m['questionnaireNewPage.llmGuidelinesPlaceholder']()}
					rows={4}
					class={showLlmWarning ? 'border-destructive' : ''}
				/>
				{#if showLlmWarning}
					<p class="text-sm text-destructive">
						{m['questionnaireNewPage.llmGuidelinesRequiredWarning']()}
					</p>
				{:else}
					<p class="text-xs text-muted-foreground">
						{#if needsLlmGuidelines}
							{m['questionnaireNewPage.llmGuidelinesRequired']()}
						{:else}
							{m['questionnaireNewPage.llmGuidelinesOptional']()}
						{/if}
					</p>
				{/if}
			</div>
		{/if}

		<!-- Duration Settings -->
		<div class="grid gap-4 sm:grid-cols-2">
			<DurationInput
				id="max-submission-age"
				label={m['questionnaireNewPage.submissionValidityLabel']()}
				helpText={m['questionnaireNewPage.submissionValidityDescription']()}
				bind:value={() => maxSubmissionAge, (v) => (maxSubmissionAge = v)}
				storageUnit="days"
				defaultUnit="days"
				emptyValue={null}
				emptyLabel={m['questionnaireNewPage.submissionValidityNoLimit']()}
			/>

			<DurationInput
				id="can-retake-after"
				label={m['questionnaireNewPage.retakeCooldownLabel']()}
				helpText={m['questionnaireNewPage.retakeCooldownDescription']()}
				bind:value={() => canRetakeAfter, (v) => (canRetakeAfter = v)}
				storageUnit="hours"
				defaultUnit="hours"
				emptyValue={null}
				emptyLabel={m['questionnaireNewPage.retakeCooldownNoLimit']()}
			/>
		</div>

		<!-- Max Attempts -->
		<div class="space-y-2">
			<Label for="max-attempts">
				{m['questionnaireNewPage.maxAttemptsLabel']()}
				<span class="text-destructive">*</span>
			</Label>
			<Input id="max-attempts" type="number" bind:value={maxAttempts} min="0" step="1" required />
			<p class="text-xs text-muted-foreground">
				{m['questionnaireNewPage.maxAttemptsDescription']()}
			</p>
		</div>
	</CardContent>
</Card>
