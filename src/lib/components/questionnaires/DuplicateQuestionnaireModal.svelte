<script lang="ts">
	import * as m from '$lib/paraglide/messages.js';
	import { Dialog, DialogContent, DialogHeader, DialogTitle } from '$lib/components/ui/dialog';
	import { Button } from '$lib/components/ui/button';
	import { createMutation } from '@tanstack/svelte-query';
	import { questionnaireDuplicateOrgQuestionnaire } from '$lib/api/generated/sdk.gen';
	import { authStore } from '$lib/stores/auth.svelte';
	import { goto } from '$app/navigation';
	import { Copy, Loader2 } from 'lucide-svelte';
	import { cn } from '$lib/utils/cn';

	interface Props {
		open: boolean;
		orgQuestionnaireId: string;
		questionnaireName: string;
		organizationSlug: string;
		onClose: () => void;
	}

	let {
		open = $bindable(),
		orgQuestionnaireId,
		questionnaireName,
		organizationSlug,
		onClose
	}: Props = $props();

	const accessToken = $derived(authStore.accessToken);

	let newName = $state('');
	let copyAssociations = $state(false);
	let errorMessage = $state<string | null>(null);

	$effect(() => {
		if (open) {
			newName = m['duplicateQuestionnaireModal.copyOf']({ name: questionnaireName });
			copyAssociations = false;
			errorMessage = null;
		}
	});

	const duplicateMutation = createMutation(() => ({
		mutationFn: async () => {
			if (!accessToken)
				throw new Error(m['duplicateQuestionnaireModal.error_notAuthenticated']());

			const response = await questionnaireDuplicateOrgQuestionnaire({
				path: { org_questionnaire_id: orgQuestionnaireId },
				body: { name: newName.trim(), copy_associations: copyAssociations },
				headers: { Authorization: `Bearer ${accessToken}` }
			});

			if (response.error) {
				const errorDetail =
					typeof response.error === 'object' &&
					response.error !== null &&
					'detail' in response.error
						? (response.error.detail as string)
						: m['duplicateQuestionnaireModal.error_failedToDuplicate']();
				throw new Error(errorDetail);
			}
			if (!response.data) {
				throw new Error(m['duplicateQuestionnaireModal.error_failedToDuplicate']());
			}
			return response.data;
		},
		onSuccess: (data) => {
			goto(`/org/${organizationSlug}/admin/questionnaires/${data.id}`);
			onClose();
		},
		onError: (error: Error) => {
			errorMessage = error.message;
		}
	}));

	function handleSubmit(e: Event) {
		e.preventDefault();
		errorMessage = null;
		if (!newName.trim()) {
			errorMessage = m['duplicateQuestionnaireModal.error_nameRequired']();
			return;
		}
		duplicateMutation.mutate();
	}

	function handleClose() {
		if (!duplicateMutation.isPending) onClose();
	}
</script>

<Dialog bind:open onOpenChange={(isOpen) => !isOpen && handleClose()}>
	<DialogContent class="max-w-md">
		<DialogHeader>
			<DialogTitle class="flex items-center gap-2">
				<Copy class="h-5 w-5" aria-hidden="true" />
				{m['duplicateQuestionnaireModal.title']()}
			</DialogTitle>
		</DialogHeader>

		<form onsubmit={handleSubmit} class="mt-4 space-y-4">
			<p class="text-sm text-muted-foreground">
				{m['duplicateQuestionnaireModal.description']()}
			</p>

			<div class="space-y-2">
				<label for="duplicate-questionnaire-name" class="block text-sm font-medium">
					{m['duplicateQuestionnaireModal.newName']()} <span class="text-destructive">*</span>
				</label>
				<input
					id="duplicate-questionnaire-name"
					type="text"
					bind:value={newName}
					placeholder={m['duplicateQuestionnaireModal.namePlaceholder']()}
					disabled={duplicateMutation.isPending}
					class={cn(
						'flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm transition-colors placeholder:text-muted-foreground focus:border-ring focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50'
					)}
				/>
			</div>

			<div class="space-y-1">
				<label class="flex items-center gap-2 text-sm">
					<input
						type="checkbox"
						bind:checked={copyAssociations}
						disabled={duplicateMutation.isPending}
						class="h-4 w-4"
					/>
					{m['duplicateQuestionnaireModal.copyAssociationsLabel']()}
				</label>
				<p class="text-xs text-muted-foreground">
					{m['duplicateQuestionnaireModal.copyAssociationsHint']()}
				</p>
			</div>

			{#if errorMessage}
				<div class="rounded-md bg-destructive/10 p-3 text-sm text-destructive" role="alert">
					{errorMessage}
				</div>
			{/if}

			<div class="flex justify-end gap-3 pt-2">
				<Button
					type="button"
					variant="outline"
					onclick={handleClose}
					disabled={duplicateMutation.isPending}
				>
					{m['duplicateQuestionnaireModal.cancel']()}
				</Button>
				<Button type="submit" disabled={duplicateMutation.isPending}>
					{#if duplicateMutation.isPending}
						<Loader2 class="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />
						{m['duplicateQuestionnaireModal.duplicating']()}
					{:else}
						<Copy class="mr-2 h-4 w-4" aria-hidden="true" />
						{m['duplicateQuestionnaireModal.duplicate']()}
					{/if}
				</Button>
			</div>
		</form>
	</DialogContent>
</Dialog>
