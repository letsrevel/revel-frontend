<script lang="ts">
	import { Button } from '$lib/components/ui/button';
	import { Input } from '$lib/components/ui/input';
	import { Label } from '$lib/components/ui/label';
	import { Textarea } from '$lib/components/ui/textarea';
	import { Card } from '$lib/components/ui/card';
	import { Check, X, Clock, Loader2, ChevronDown, ChevronUp } from 'lucide-svelte';
	import { cn } from '$lib/utils/cn';

	interface Props {
		submissionId: string;
		currentStatus?: 'approved' | 'rejected' | 'pending review' | null;
		isSubmitting?: boolean;
		onCancel?: () => void;
	}

	let { submissionId, currentStatus = null, isSubmitting = false, onCancel }: Props = $props();

	// Form state
	let showAdvancedOptions = $state(false);
	let score = $state('');
	let comments = $state('');

	function toggleAdvancedOptions() {
		showAdvancedOptions = !showAdvancedOptions;
	}
</script>

<!--
  Evaluation Form Component

  Provides quick approve/reject buttons with optional detailed evaluation (score and comments).
  Uses progressive disclosure pattern: advanced options are hidden by default.

  @component
  @example
  <EvaluationForm submissionId={submission.id} onCancel={handleCancel} />
-->
<form method="POST" action="?/evaluate">
	<input type="hidden" name="submission_id" value={submissionId} />

	<Card class="p-6">
		<h3 class="mb-4 text-lg font-semibold">Your Evaluation</h3>

		<!-- Quick Actions -->
		<div class="mb-6 grid gap-4 md:grid-cols-3">
			<Button
				type="submit"
				name="status"
				value="approved"
				variant={currentStatus === 'approved' ? 'default' : 'outline'}
				class={cn(
					'h-auto flex-col gap-2 py-4',
					currentStatus === 'approved' && 'ring-2 ring-primary ring-offset-2'
				)}
				disabled={isSubmitting}
			>
				{#if isSubmitting}
					<Loader2 class="h-5 w-5 animate-spin" />
				{:else}
					<Check class="h-6 w-6" />
				{/if}
				<span class="text-lg font-semibold">Approve</span>
				{#if currentStatus === 'approved'}
					<span class="text-xs">Current</span>
				{/if}
			</Button>

			<Button
				type="submit"
				name="status"
				value="rejected"
				variant={currentStatus === 'rejected' ? 'destructive' : 'outline'}
				class={cn(
					'h-auto flex-col gap-2 py-4',
					currentStatus === 'rejected' && 'ring-2 ring-destructive ring-offset-2'
				)}
				disabled={isSubmitting}
			>
				{#if isSubmitting}
					<Loader2 class="h-5 w-5 animate-spin" />
				{:else}
					<X class="h-6 w-6" />
				{/if}
				<span class="text-lg font-semibold">Reject</span>
				{#if currentStatus === 'rejected'}
					<span class="text-xs">Current</span>
				{/if}
			</Button>

			<Button
				type="submit"
				name="status"
				value="pending review"
				variant={currentStatus === 'pending review' ? 'secondary' : 'outline'}
				class={cn(
					'h-auto flex-col gap-2 py-4',
					currentStatus === 'pending review' && 'ring-2 ring-secondary ring-offset-2'
				)}
				disabled={isSubmitting}
			>
				{#if isSubmitting}
					<Loader2 class="h-5 w-5 animate-spin" />
				{:else}
					<Clock class="h-6 w-6" />
				{/if}
				<span class="text-lg font-semibold">Pending Review</span>
				{#if currentStatus === 'pending review'}
					<span class="text-xs">Current</span>
				{/if}
			</Button>
		</div>

		<!-- Advanced Options Toggle -->
		<button
			type="button"
			onclick={toggleAdvancedOptions}
			class="mb-4 flex w-full items-center justify-between rounded-md border border-dashed p-3 text-sm font-medium hover:bg-muted/50 focus:outline-none focus:ring-2 focus:ring-ring"
			aria-expanded={showAdvancedOptions}
			aria-controls="advanced-options"
		>
			<span>Advanced Options (Score & Comments)</span>
			{#if showAdvancedOptions}
				<ChevronUp class="h-4 w-4" aria-hidden="true" />
			{:else}
				<ChevronDown class="h-4 w-4" aria-hidden="true" />
			{/if}
		</button>

		<!-- Advanced Options Panel -->
		{#if showAdvancedOptions}
			<div id="advanced-options" class="space-y-4 border-t pt-4">
				<!-- Score Input -->
				<div>
					<Label for="score">Score (Optional)</Label>
					<div class="flex items-center gap-2">
						<Input
							id="score"
							name="score"
							type="number"
							min="0"
							max="100"
							step="1"
							placeholder="0-100"
							bind:value={score}
							class="w-32"
							disabled={isSubmitting}
						/>
						<span class="text-sm text-muted-foreground">/100</span>
					</div>
					<p class="mt-1 text-xs text-muted-foreground">
						Provide a numeric score between 0 and 100
					</p>
				</div>

				<!-- Comments Input -->
				<div>
					<Label for="comments">Comments (Optional)</Label>
					<Textarea
						id="comments"
						name="comments"
						placeholder="Add evaluation notes or feedback for the submitter..."
						bind:value={comments}
						rows={4}
						maxlength={1000}
						disabled={isSubmitting}
					/>
					<p class="mt-1 text-xs text-muted-foreground">{comments.length}/1000 characters</p>
				</div>
			</div>
		{/if}

		<!-- Cancel Button -->
		{#if onCancel}
			<div class="mt-6 border-t pt-4">
				<Button type="button" variant="outline" onclick={onCancel} disabled={isSubmitting}>
					Cancel
				</Button>
			</div>
		{/if}
	</Card>
</form>
