<script lang="ts" module>
	/**
	 * What the tier form hands back to its parent.
	 *
	 * `null` on either override means "inherit the organization default" — the
	 * backend distinguishes that from an explicit `false`, so the tri-state has
	 * to survive the round trip rather than collapse to a boolean.
	 */
	export interface TierFormPayload {
		name: string;
		description: string;
		membership_questionnaire_id: string | null;
		requires_membership_approval: boolean | null;
	}
</script>

<script lang="ts">
	import * as m from '$lib/paraglide/messages.js';
	import type {
		MembershipTierAdminSchema,
		OrganizationQuestionnaireInListSchema
	} from '$lib/api/generated/types.gen';
	import { Dialog, DialogContent, DialogHeader, DialogTitle } from '$lib/components/ui/dialog';
	import { Button } from '$lib/components/ui/button';
	import { Label } from '$lib/components/ui/label';
	import { Input } from '$lib/components/ui/input';
	import MarkdownEditor from '$lib/components/forms/MarkdownEditor.svelte';
	import { Loader2 } from '@lucide/svelte';

	interface Props {
		tier: MembershipTierAdminSchema | null;
		open: boolean;
		onClose: () => void;
		onSave: (payload: TierFormPayload) => void;
		isSaving?: boolean;
		membershipQuestionnaires: OrganizationQuestionnaireInListSchema[];
		orgDefaultRequiresApproval: boolean;
	}

	const {
		tier,
		open,
		onClose,
		onSave,
		isSaving = false,
		membershipQuestionnaires,
		orgDefaultRequiresApproval
	}: Props = $props();

	// Form state
	let tierName = $state('');
	let tierDescription = $state('');
	// Both overrides carry a "no override" sentinel a `<select>` can hold: the empty
	// string for the questionnaire, `inherit` for the approval tri-state. They map
	// back to `null` on submit.
	let questionnaireId = $state('');
	let approvalMode = $state<'inherit' | 'require' | 'norequire'>('inherit');
	let errors = $state<{ name?: string }>({});

	// Sync form with tier prop (for editing)
	$effect(() => {
		if (tier) {
			tierName = tier.name;
			tierDescription = tier.description || '';
		} else {
			tierName = '';
			tierDescription = '';
		}
		questionnaireId = tier?.membership_questionnaire_id ?? '';
		approvalMode =
			tier?.requires_membership_approval === true
				? 'require'
				: tier?.requires_membership_approval === false
					? 'norequire'
					: 'inherit';
		errors = {};
	});

	// Validation
	function validate(): boolean {
		errors = {};

		if (!tierName.trim()) {
			errors.name = m['tierForm.errors.nameRequired']();
			return false;
		}

		if (tierName.trim().length < 1) {
			errors.name = m['tierForm.errors.nameTooShort']();
			return false;
		}

		if (tierName.trim().length > 150) {
			errors.name = m['tierForm.errors.nameTooLong']();
			return false;
		}

		return true;
	}

	function handleSubmit() {
		if (!validate()) return;
		onSave({
			name: tierName.trim(),
			description: tierDescription.trim(),
			membership_questionnaire_id: questionnaireId || null,
			requires_membership_approval: approvalMode === 'inherit' ? null : approvalMode === 'require'
		});
	}

	function handleKeydown(event: KeyboardEvent) {
		if (event.key === 'Enter' && !isSaving) {
			event.preventDefault();
			handleSubmit();
		}
	}

	// Is editing mode
	const isEditing = $derived(!!tier);
</script>

<Dialog
	{open}
	onOpenChange={(isOpen) => {
		if (!isOpen) onClose();
	}}
>
	<DialogContent class="sm:max-w-[425px]">
		<DialogHeader>
			<DialogTitle>
				{isEditing ? m['tierForm.editTitle']() : m['tierForm.createTitle']()}
			</DialogTitle>
		</DialogHeader>

		<form
			onsubmit={(e) => {
				e.preventDefault();
				handleSubmit();
			}}
			class="space-y-4 py-4"
		>
			<!-- Tier Name -->
			<div class="space-y-2">
				<Label for="tier-name">
					{m['tierForm.nameLabel']()}
					<span class="text-destructive">*</span>
				</Label>
				<Input
					id="tier-name"
					type="text"
					bind:value={tierName}
					onkeydown={handleKeydown}
					placeholder={m['tierForm.namePlaceholder']()}
					disabled={isSaving}
					aria-invalid={!!errors.name}
					aria-describedby={errors.name ? 'tier-name-error' : undefined}
					class={errors.name ? 'border-destructive' : ''}
				/>
				{#if errors.name}
					<p id="tier-name-error" class="text-sm text-destructive">
						{errors.name}
					</p>
				{/if}
				<p class="text-xs text-muted-foreground">
					{m['tierForm.nameHint']()}
				</p>
			</div>

			<!-- Tier Description -->
			<div class="space-y-2">
				<MarkdownEditor
					bind:value={tierDescription}
					label={m['tierForm.descriptionLabel']()}
					placeholder={m['tierForm.descriptionPlaceholder']()}
					rows={6}
					disabled={isSaving}
				/>
				<p class="text-xs text-muted-foreground">
					{m['tierForm.descriptionHint']()}
				</p>
			</div>

			<!-- Membership questionnaire override ('' = inherit the org default) -->
			<div class="space-y-2">
				<Label for="tier-questionnaire">{m['tierForm.questionnaireLabel']()}</Label>
				<select
					id="tier-questionnaire"
					bind:value={questionnaireId}
					disabled={isSaving}
					class="flex w-full rounded-md border-2 border-gray-300 bg-white px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
				>
					<option value="">{m['tierForm.questionnaireInherit']()}</option>
					{#each membershipQuestionnaires as oq (oq.id)}
						<option value={oq.id}>{oq.questionnaire.name}</option>
					{/each}
				</select>
				<p class="text-xs text-muted-foreground">{m['tierForm.questionnaireHint']()}</p>
			</div>

			<!-- Manual-approval override (tri-state: inherit / require / don't require) -->
			<div class="space-y-2">
				<Label for="tier-approval">{m['tierForm.approvalLabel']()}</Label>
				<select
					id="tier-approval"
					bind:value={approvalMode}
					disabled={isSaving}
					class="flex w-full rounded-md border-2 border-gray-300 bg-white px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
				>
					<option value="inherit">
						{orgDefaultRequiresApproval
							? m['tierForm.approvalInheritRequired']()
							: m['tierForm.approvalInheritNotRequired']()}
					</option>
					<option value="require">{m['tierForm.approvalRequire']()}</option>
					<option value="norequire">{m['tierForm.approvalNoRequire']()}</option>
				</select>
				<p class="text-xs text-muted-foreground">{m['tierForm.approvalHint']()}</p>
			</div>

			<!-- Actions -->
			<div class="flex justify-end gap-2 pt-4">
				<Button type="button" variant="outline" onclick={onClose} disabled={isSaving}>
					{m['tierForm.cancel']()}
				</Button>
				<Button type="submit" disabled={isSaving}>
					{#if isSaving}
						<Loader2 class="mr-2 h-4 w-4 animate-spin" />
					{/if}
					{isEditing ? m['tierForm.update']() : m['tierForm.create']()}
				</Button>
			</div>
		</form>
	</DialogContent>
</Dialog>
