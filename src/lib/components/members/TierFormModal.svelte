<script lang="ts">
	import * as m from '$lib/paraglide/messages.js';
	import type { MembershipTierSchema } from '$lib/api/generated/types.gen';
	import { Dialog, DialogContent, DialogHeader, DialogTitle } from '$lib/components/ui/dialog';
	import { Button } from '$lib/components/ui/button';
	import { Label } from '$lib/components/ui/label';
	import { Input } from '$lib/components/ui/input';
	import MarkdownEditor from '$lib/components/forms/MarkdownEditor.svelte';
	import { Loader2 } from 'lucide-svelte';

	interface Props {
		tier: MembershipTierSchema | null;
		open: boolean;
		onClose: () => void;
		onSave: (name: string, description: string) => void;
		isSaving?: boolean;
	}

	let { tier, open, onClose, onSave, isSaving = false }: Props = $props();

	// Form state
	let tierName = $state('');
	let tierDescription = $state('');
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
		onSave(tierName.trim(), tierDescription.trim());
	}

	function handleKeydown(event: KeyboardEvent) {
		if (event.key === 'Enter' && !isSaving) {
			event.preventDefault();
			handleSubmit();
		}
	}

	// Is editing mode
	let isEditing = $derived(!!tier);
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
