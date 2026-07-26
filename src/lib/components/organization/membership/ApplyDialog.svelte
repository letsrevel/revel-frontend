<script lang="ts">
	import * as m from '$lib/paraglide/messages.js';
	import { createMutation, useQueryClient } from '@tanstack/svelte-query';
	import { memembershipapplicationsApply } from '$lib/api/generated/sdk.gen';
	import type { ApplyResponseSchema } from '$lib/api/generated/types.gen';
	import { authStore } from '$lib/stores/auth.svelte';
	import { getMembershipStatusMessage } from '$lib/utils/membership-eligibility';
	import {
		Dialog,
		DialogContent,
		DialogDescription,
		DialogFooter,
		DialogHeader,
		DialogTitle
	} from '$lib/components/ui/dialog';
	import { Button } from '$lib/components/ui/button';
	import { CheckCircle2, Loader2 } from '@lucide/svelte';
	import { invalidateAll } from '$app/navigation';
	import { resolve } from '$app/paths';

	interface Props {
		open: boolean;
		onOpenChange: (open: boolean) => void;
		organizationSlug: string;
		organizationName: string;
		/** `reapply` only changes the framing — the request is identical. */
		mode: 'join' | 'reapply';
	}

	const { open, onOpenChange, organizationSlug, organizationName, mode }: Props = $props();

	const accessToken = $derived(authStore.accessToken);
	const queryClient = useQueryClient();

	let message = $state('');
	let errorMessage = $state<string | null>(null);
	let result = $state<ApplyResponseSchema | null>(null);

	// Unique per instance: the dialog can sit next to other labelled controls.
	const uid = $props.id();
	const messageId = `${uid}-message`;
	const counterId = `${uid}-counter`;
	const membershipsHref = resolve('/(auth)/account/memberships', {});

	/**
	 * hey-api types this endpoint's error as `unknown`, so the shape is probed
	 * rather than trusted: Ninja hard-blocks (403) carry `message`, DRF-style
	 * payloads carry `detail`.
	 */
	function backendMessage(error: unknown): string | null {
		if (!error || typeof error !== 'object') return null;
		const body = error as { message?: unknown; detail?: unknown };
		if (typeof body.message === 'string' && body.message) return body.message;
		if (typeof body.detail === 'string' && body.detail) return body.detail;
		return null;
	}

	const applyMutation = createMutation(() => ({
		mutationFn: async (): Promise<ApplyResponseSchema> => {
			errorMessage = null;
			const notes = message.trim();
			const res = await memembershipapplicationsApply({
				path: { slug: organizationSlug },
				// An empty note is no note: sending `''` would store a blank message
				// on the application.
				body: { notes: notes || undefined },
				headers: { Authorization: `Bearer ${accessToken}` }
			});
			// hey-api resolves rather than throws — a missing payload is a failure
			// even when no error body came back.
			if (res.error || !res.data) {
				throw new Error(backendMessage(res.error) ?? m['membershipApply.error']());
			}
			return res.data;
		},
		onSuccess: (data) => {
			result = data;
			// Any outcome moves the verdict on (join → waiting/member).
			queryClient.invalidateQueries({
				queryKey: ['org', organizationSlug, 'join-eligibility']
			});
			// Only an instant membership changes what the server rendered for this
			// page (`isMember`, member-only sections).
			if (data.application.status === 'completed') {
				invalidateAll();
			}
		},
		onError: (err: Error) => {
			errorMessage = err.message || m['membershipApply.error']();
		}
	}));

	const isBusy = $derived(applyMutation.isPending);
	const completed = $derived(result?.application.status === 'completed');

	const heading = $derived.by(() => {
		if (result) {
			return completed
				? m['membershipApply.completedTitle']()
				: m['membershipApply.pendingTitle']();
		}
		return mode === 'reapply'
			? m['membershipApply.reapplyTitle']({ orgName: organizationName })
			: m['membershipApply.title']({ orgName: organizationName });
	});

	// A reopened dialog must start from a blank form, not from the previous
	// outcome. `open` is owned by the caller, so the reset hangs off it.
	$effect(() => {
		if (open) return;
		message = '';
		errorMessage = null;
		result = null;
	});

	function handleOpenChange(next: boolean): void {
		// The application is in flight; closing now would hide the outcome.
		if (!next && isBusy) return;
		onOpenChange(next);
	}
</script>

<Dialog {open} onOpenChange={handleOpenChange}>
	<DialogContent
		class="max-h-[90vh] overflow-y-auto sm:max-w-md"
		escapeKeydownBehavior={isBusy ? 'ignore' : 'close'}
		interactOutsideBehavior={isBusy ? 'ignore' : 'close'}
		showCloseButton={!isBusy}
	>
		<DialogHeader>
			<DialogTitle>{heading}</DialogTitle>
			<DialogDescription>
				{#if result}
					{completed
						? m['membershipApply.completedBody']({ orgName: organizationName })
						: m['membershipApply.pendingBody']()}
				{:else}
					{organizationName}
				{/if}
			</DialogDescription>
		</DialogHeader>

		{#if result}
			<div class="space-y-3">
				{#if completed}
					<p class="flex items-center gap-2 text-sm font-medium text-green-700 dark:text-green-300">
						<CheckCircle2 class="h-5 w-5" aria-hidden="true" />
						{m['membershipEligibility.memberBadge']()}
					</p>
				{:else}
					<p class="text-sm text-muted-foreground">
						{getMembershipStatusMessage(result.eligibility)}
					</p>
					<a
						href={membershipsHref}
						class="inline-block text-sm font-medium text-primary underline-offset-4 hover:underline"
					>
						{m['membershipApply.trackLink']()}
					</a>
				{/if}
			</div>

			<DialogFooter>
				<!-- The outcome is final, so this dismisses rather than cancels. -->
				<Button variant="outline" onclick={() => handleOpenChange(false)}>
					{m['dialogContent.close']()}
				</Button>
			</DialogFooter>
		{:else}
			<form
				class="space-y-4"
				onsubmit={(e) => {
					e.preventDefault();
					applyMutation.mutate();
				}}
			>
				<div>
					<label for={messageId} class="block text-sm font-medium">
						{m['membershipApply.messageOptional']()}
					</label>
					<textarea
						id={messageId}
						bind:value={message}
						placeholder={m['membershipApply.messagePlaceholder']()}
						rows="4"
						maxlength="500"
						aria-describedby={counterId}
						disabled={isBusy}
						class="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm transition-colors placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:opacity-50"
					></textarea>
					<p id={counterId} class="mt-1 text-xs text-muted-foreground">
						{m['membershipApply.characters']({ count: message.length })}
					</p>
				</div>

				{#if errorMessage}
					<p role="alert" class="text-sm font-medium text-destructive">{errorMessage}</p>
				{/if}

				<DialogFooter class="gap-2">
					<Button
						type="button"
						variant="outline"
						onclick={() => handleOpenChange(false)}
						disabled={isBusy}
					>
						{m['membershipApply.cancel']()}
					</Button>
					<Button type="submit" disabled={isBusy}>
						{#if isBusy}
							<Loader2 class="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />
							{m['membershipApply.submitting']()}
						{:else}
							{m['membershipApply.submit']()}
						{/if}
					</Button>
				</DialogFooter>
			</form>
		{/if}
	</DialogContent>
</Dialog>
