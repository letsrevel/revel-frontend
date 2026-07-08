<script lang="ts">
	import * as m from '$lib/paraglide/messages.js';
	import { Input } from '$lib/components/ui/input';
	import { Label } from '$lib/components/ui/label';
	import { Select, SelectContent, SelectItem, SelectTrigger } from '$lib/components/ui/select';
	import {
		Card,
		CardContent,
		CardDescription,
		CardHeader,
		CardTitle
	} from '$lib/components/ui/card';
	import MarkdownEditor from '$lib/components/forms/MarkdownEditor.svelte';

	interface Props {
		name: string;
		description: string;
		questionnaireType: 'admission' | 'membership' | 'feedback' | 'generic';
		requiresEvaluation: boolean;
		effectiveRequiresEvaluation: boolean;
		minScore: number;
		evaluationMode: 'automatic' | 'manual' | 'hybrid';
		nameError?: string;
	}

	let {
		name = $bindable(),
		description = $bindable(),
		questionnaireType = $bindable(),
		requiresEvaluation = $bindable(),
		effectiveRequiresEvaluation,
		minScore = $bindable(),
		evaluationMode = $bindable(),
		nameError
	}: Props = $props();

	// Questionnaire type labels and descriptions
	const questionnaireTypes = {
		admission: {
			label: m['questionnaireNewPage.typeAdmissionLabel'](),
			description: m['questionnaireNewPage.typeAdmissionTriggerDescription']()
		},
		membership: {
			label: m['questionnaireNewPage.typeMembershipLabel'](),
			description: m['questionnaireNewPage.typeMembershipTriggerDescription']()
		},
		feedback: {
			label: m['questionnaireNewPage.typeFeedbackLabel'](),
			description: m['questionnaireNewPage.typeFeedbackDescription']()
		},
		generic: {
			label: m['questionnaireNewPage.typeGenericLabel'](),
			description: m['questionnaireNewPage.typeGenericDescription']()
		}
	};

	// Get display label for current type
	const selectedTypeLabel = $derived(
		questionnaireTypes[questionnaireType]?.label ?? m['questionnaireNewPage.typeGenericLabel']()
	);

	// Get current description safely
	const selectedTypeDescription = $derived(
		questionnaireTypes[questionnaireType]?.description ??
			m['questionnaireNewPage.typeGenericDescription']()
	);

	// Evaluation mode descriptions
	const evaluationModes = {
		automatic: {
			label: m['questionnaireNewPage.evalAutomaticLabel'](),
			description: m['questionnaireNewPage.evalAutomaticTriggerDescription']()
		},
		manual: {
			label: m['questionnaireNewPage.evalManualLabel'](),
			description: m['questionnaireNewPage.evalManualTriggerDescription']()
		},
		hybrid: {
			label: m['questionnaireNewPage.evalHybridLabel'](),
			description: m['questionnaireNewPage.evalHybridTriggerDescription']()
		}
	};

	const selectedEvaluationDescription = $derived(
		evaluationModes[evaluationMode]?.description ??
			m['questionnaireNewPage.evalAutomaticTriggerDescription']()
	);
</script>

<!-- Basic Information -->
<Card>
	<CardHeader>
		<CardTitle>{m['questionnaireNewPage.basicInfoTitle']()}</CardTitle>
		<CardDescription>{m['questionnaireNewPage.basicInfoDescription']()}</CardDescription>
	</CardHeader>
	<CardContent class="space-y-4">
		<!-- Name -->
		<div class="space-y-2">
			<Label for="name">
				{m['questionnaireNewPage.nameLabel']()}
				<span class="text-destructive">*</span>
			</Label>
			<Input
				id="name"
				bind:value={name}
				placeholder={m['questionnaireNewPage.namePlaceholder']()}
				class={nameError ? 'border-destructive' : ''}
			/>
			{#if nameError}
				<p class="text-sm text-destructive">{nameError}</p>
			{/if}
		</div>

		<!-- Description (markdown) -->
		<MarkdownEditor
			id="questionnaire-description"
			label={m['questionnaireNewPage.descriptionLabel']()}
			bind:value={description}
			placeholder={m['questionnaireNewPage.descriptionPlaceholder']()}
			rows={3}
		/>

		<!-- Type -->
		<div class="space-y-2">
			<Label for="type">
				{m['questionnaireNewPage.typeFieldLabel']()}
				<span class="text-destructive">*</span>
			</Label>
			<Select
				type="single"
				value={questionnaireType}
				onValueChange={(v) => {
					// Allow admission and feedback types
					if (v === 'admission' || v === 'feedback') {
						questionnaireType = v;
					}
				}}
			>
				<SelectTrigger id="type">
					{selectedTypeLabel}
				</SelectTrigger>
				<SelectContent>
					<SelectItem value="admission" label={m['questionnaireNewPage.typeAdmissionLabel']()}>
						<div class="flex flex-col gap-0.5">
							<div class="font-medium">{m['questionnaireNewPage.typeAdmissionLabel']()}</div>
							<div class="text-xs text-muted-foreground">
								{m['questionnaireNewPage.typeAdmissionDescription']()}
							</div>
						</div>
					</SelectItem>
					<SelectItem value="feedback" label={m['questionnaireNewPage.typeFeedbackLabel']()}>
						<div class="flex flex-col gap-0.5">
							<div class="font-medium">{m['questionnaireNewPage.typeFeedbackLabel']()}</div>
							<div class="text-xs text-muted-foreground">
								{m['questionnaireNewPage.typeFeedbackDescription']()}
							</div>
						</div>
					</SelectItem>
					<SelectItem
						value="membership"
						label={m['questionnaireNewPage.typeMembershipLabel']()}
						disabled
					>
						<div class="flex flex-col gap-0.5">
							<div class="flex items-center gap-2 font-medium">
								{m['questionnaireNewPage.typeMembershipLabel']()}
								<span
									class="rounded bg-muted px-1.5 py-0.5 text-[10px] font-normal text-muted-foreground"
									>{m['questionnaireNewPage.comingSoon']()}</span
								>
							</div>
							<div class="text-xs text-muted-foreground">
								{m['questionnaireNewPage.typeMembershipDescription']()}
							</div>
						</div>
					</SelectItem>
					<SelectItem value="generic" label={m['questionnaireNewPage.typeGenericLabel']()} disabled>
						<div class="flex flex-col gap-0.5">
							<div class="flex items-center gap-2 font-medium">
								{m['questionnaireNewPage.typeGenericLabel']()}
								<span
									class="rounded bg-muted px-1.5 py-0.5 text-[10px] font-normal text-muted-foreground"
									>{m['questionnaireNewPage.comingSoon']()}</span
								>
							</div>
							<div class="text-xs text-muted-foreground">
								{m['questionnaireNewPage.typeGenericDescription']()}
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
					bind:checked={requiresEvaluation}
					class="h-4 w-4 rounded border-gray-300"
					disabled={questionnaireType === 'feedback'}
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
					{m['questionnaireNewPage.minScorePctLabel']()}
					<span class="text-destructive">*</span>
				</Label>
				<Input
					id="min-score"
					type="number"
					bind:value={minScore}
					min="0"
					max="100"
					step="1"
					placeholder="0"
				/>
				<p class="text-xs text-muted-foreground">
					{m['questionnaireNewPage.minScorePctDescription']()}
				</p>
			</div>

			<!-- Evaluation Mode -->
			<div class="space-y-2">
				<Label for="evaluation-mode">
					{m['questionnaireNewPage.evaluationModeLabel']()}
					<span class="text-destructive">*</span>
				</Label>
				<Select
					type="single"
					value={evaluationMode}
					onValueChange={(v) => {
						if (v) {
							evaluationMode = v as typeof evaluationMode;
						}
					}}
				>
					<SelectTrigger id="evaluation-mode">
						{evaluationModes[evaluationMode]?.label ?? m['questionnaireNewPage.evalManualLabel']()}
					</SelectTrigger>
					<SelectContent>
						<SelectItem value="manual" label={m['questionnaireNewPage.evalManualLabel']()}>
							<div class="flex flex-col gap-0.5">
								<div class="font-medium">{m['questionnaireNewPage.evalManualLabel']()}</div>
								<div class="text-xs text-muted-foreground">
									{m['questionnaireNewPage.evalManualDescription']()}
								</div>
							</div>
						</SelectItem>
						<SelectItem value="hybrid" label={m['questionnaireNewPage.evalHybridLabel']()} disabled>
							<div class="flex flex-col gap-0.5">
								<div class="flex items-center gap-2 font-medium">
									{m['questionnaireNewPage.evalHybridLabel']()}
									<span
										class="rounded bg-muted px-1.5 py-0.5 text-[10px] font-normal text-muted-foreground"
										>{m['questionnaireNewPage.comingSoon']()}</span
									>
								</div>
								<div class="text-xs text-muted-foreground">
									{m['questionnaireNewPage.evalHybridDescription']()}
								</div>
							</div>
						</SelectItem>
						<SelectItem
							value="automatic"
							label={m['questionnaireNewPage.evalAutomaticLabel']()}
							disabled
						>
							<div class="flex flex-col gap-0.5">
								<div class="flex items-center gap-2 font-medium">
									{m['questionnaireNewPage.evalAutomaticLabel']()}
									<span
										class="rounded bg-muted px-1.5 py-0.5 text-[10px] font-normal text-muted-foreground"
										>{m['questionnaireNewPage.comingSoon']()}</span
									>
								</div>
								<div class="text-xs text-muted-foreground">
									{m['questionnaireNewPage.evalAutomaticDescription']()}
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
