<script lang="ts">
	import * as m from '$lib/paraglide/messages.js';
	import { Dialog, DialogContent, DialogHeader, DialogTitle } from '$lib/components/ui/dialog';
	import { Button } from '$lib/components/ui/button';
	import { createMutation } from '@tanstack/svelte-query';
	import { pollGetPoll, pollDuplicatePollAction } from '$lib/api/generated/sdk.gen';
	import { authStore } from '$lib/stores/auth.svelte';
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { Copy, Loader2, Lock } from '@lucide/svelte';
	import { cn } from '$lib/utils/cn';
	import { resultVisibilityRequiresPublicAnonymous } from '$lib/utils/polls';
	import type { ResourceVisibility } from '$lib/api/generated/types.gen';

	interface Props {
		open: boolean;
		pollId: string;
		pollName: string;
		organizationSlug: string;
		onClose: () => void;
	}

	let { open = $bindable(), pollId, pollName, organizationSlug, onClose }: Props = $props();

	const accessToken = $derived(authStore.accessToken);

	let newName = $state('');
	let staffAnonymous = $state(false);
	let publicAnonymous = $state(false);
	let resultVisibility = $state<ResourceVisibility>('private');
	let isLoadingTemplate = $state(false);
	let errorMessage = $state<string | null>(null);

	const publicAnonymousLocked = $derived(resultVisibilityRequiresPublicAnonymous(resultVisibility));

	// Enforce the "public results must be anonymous" constraint client-side.
	$effect(() => {
		if (publicAnonymousLocked) publicAnonymous = true;
	});

	// Fetch the template poll on open to seed accurate "copy verbatim" defaults
	// (the poll list schema lacks the anonymity fields, so list data is not enough).
	$effect(() => {
		if (open) {
			newName = m['duplicatePollModal.copyOf']({ name: pollName });
			errorMessage = null;
			// Reset to neutral defaults so a reused instance never flashes the
			// previous poll's anonymity values before the fetch reseeds them.
			staffAnonymous = false;
			publicAnonymous = false;
			resultVisibility = 'private';
			void loadTemplate();
		}
	});

	async function loadTemplate() {
		if (!accessToken) {
			errorMessage = m['duplicatePollModal.error_notAuthenticated']();
			return;
		}
		isLoadingTemplate = true;
		try {
			const response = await pollGetPoll({
				path: { poll_id: pollId },
				headers: { Authorization: `Bearer ${accessToken}` }
			});
			if (response.error || !response.data) {
				throw new Error(m['duplicatePollModal.error_failedToLoad']());
			}
			staffAnonymous = response.data.staff_anonymous;
			publicAnonymous = response.data.public_anonymous;
			resultVisibility = response.data.result_visibility;
		} catch (err) {
			errorMessage =
				err instanceof Error ? err.message : m['duplicatePollModal.error_failedToLoad']();
		} finally {
			isLoadingTemplate = false;
		}
	}

	const duplicateMutation = createMutation(() => ({
		mutationFn: async () => {
			if (!accessToken) throw new Error(m['duplicatePollModal.error_notAuthenticated']());

			const response = await pollDuplicatePollAction({
				path: { poll_id: pollId },
				body: {
					name: newName.trim(),
					staff_anonymous: staffAnonymous,
					public_anonymous: publicAnonymous
				},
				headers: { Authorization: `Bearer ${accessToken}` }
			});

			if (response.error) {
				const errorDetail =
					typeof response.error === 'object' &&
					response.error !== null &&
					'detail' in response.error
						? (response.error.detail as string)
						: m['duplicatePollModal.error_failedToDuplicate']();
				throw new Error(errorDetail);
			}
			if (!response.data) {
				throw new Error(m['duplicatePollModal.error_failedToDuplicate']());
			}
			return response.data;
		},
		onSuccess: (data) => {
			goto(resolve('/(auth)/org/[slug]/admin/polls/[id]', { slug: organizationSlug, id: data.id }));
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
			errorMessage = m['duplicatePollModal.error_nameRequired']();
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
				{m['duplicatePollModal.title']()}
			</DialogTitle>
		</DialogHeader>

		<form onsubmit={handleSubmit} novalidate class="mt-4 space-y-4">
			<p class="text-sm text-muted-foreground">
				{m['duplicatePollModal.description']()}
			</p>

			{#if isLoadingTemplate}
				<p class="flex items-center gap-2 text-sm text-muted-foreground" role="status">
					<Loader2 class="h-4 w-4 animate-spin" aria-hidden="true" />
					{m['duplicatePollModal.loading']()}
				</p>
			{/if}

			<div class="space-y-2">
				<label for="duplicate-poll-name" class="block text-sm font-medium">
					{m['duplicatePollModal.newName']()}
					<span class="text-destructive" aria-hidden="true">*</span>
				</label>
				<input
					id="duplicate-poll-name"
					type="text"
					bind:value={newName}
					placeholder={m['duplicatePollModal.namePlaceholder']()}
					required
					disabled={duplicateMutation.isPending || isLoadingTemplate}
					class={cn(
						'flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm transition-colors placeholder:text-muted-foreground focus:border-ring focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50'
					)}
				/>
			</div>

			<label class="flex items-center gap-2 text-sm">
				<input
					type="checkbox"
					bind:checked={staffAnonymous}
					disabled={duplicateMutation.isPending || isLoadingTemplate}
					class="h-4 w-4"
				/>
				{m['pollNewPage.staffAnonymousLabel']()}
			</label>

			<label class="flex items-center gap-2 text-sm">
				<input
					type="checkbox"
					bind:checked={publicAnonymous}
					disabled={duplicateMutation.isPending || isLoadingTemplate || publicAnonymousLocked}
					class="h-4 w-4"
				/>
				<span class="flex items-center gap-1">
					{m['pollNewPage.publicAnonymousLabel']()}
					{#if publicAnonymousLocked}
						<Lock class="h-3 w-3 text-muted-foreground" aria-hidden="true" />
					{/if}
				</span>
			</label>
			{#if publicAnonymousLocked}
				<p class="text-xs text-muted-foreground">{m['pollNewPage.publicAnonymousForced']()}</p>
			{/if}

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
					{m['duplicatePollModal.cancel']()}
				</Button>
				<Button type="submit" disabled={duplicateMutation.isPending || isLoadingTemplate}>
					{#if duplicateMutation.isPending}
						<Loader2 class="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />
						{m['duplicatePollModal.duplicating']()}
					{:else}
						<Copy class="mr-2 h-4 w-4" aria-hidden="true" />
						{m['duplicatePollModal.duplicate']()}
					{/if}
				</Button>
			</div>
		</form>
	</DialogContent>
</Dialog>
