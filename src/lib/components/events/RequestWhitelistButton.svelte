<script lang="ts">
	import * as m from '$lib/paraglide/messages.js';
	import { createMutation, useQueryClient } from '@tanstack/svelte-query';
	import { organizationCreateWhitelistRequest } from '$lib/api/generated/sdk.gen';
	import { authStore } from '$lib/stores/auth.svelte';
	import { ShieldCheck, Send, AlertCircle } from 'lucide-svelte';
	import { Button } from '$lib/components/ui/button';
	import * as Dialog from '$lib/components/ui/dialog';

	interface Props {
		organizationSlug: string;
		organizationName?: string;
		eventId?: string;
		isAuthenticated: boolean;
		hasAlreadyRequested?: boolean;
		onSuccess?: () => void;
		class?: string;
	}

	let {
		organizationSlug,
		organizationName = '',
		eventId,
		isAuthenticated,
		hasAlreadyRequested = false,
		onSuccess,
		class: className
	}: Props = $props();

	const queryClient = useQueryClient();
	const accessToken = $derived(authStore.accessToken);

	// Dialog state
	let showDialog = $state(false);
	let message = $state('');
	let requestSubmitted = $state(false);

	// Create mutation for submitting whitelist request
	const requestMutation = createMutation(() => ({
		mutationFn: async (messageText: string) => {
			if (!accessToken) {
				throw new Error(m['requestWhitelistButton.mustBeLoggedIn']?.() ?? 'You must be logged in');
			}

			const response = await organizationCreateWhitelistRequest({
				path: { slug: organizationSlug },
				body: {
					message: messageText || undefined
				},
				headers: {
					Authorization: `Bearer ${accessToken}`
				}
			});

			if (response.error) {
				throw new Error(
					typeof response.error === 'object' && response.error && 'detail' in response.error
						? String(response.error.detail)
						: (m['requestWhitelistButton.failedToSubmit']?.() ?? 'Failed to submit request')
				);
			}

			return response.data;
		},
		onSuccess: () => {
			requestSubmitted = true;
			// Invalidate relevant queries to refetch status
			if (eventId) {
				queryClient.invalidateQueries({ queryKey: ['event-status', eventId] });
				queryClient.invalidateQueries({ queryKey: ['event', eventId] });
			}
			queryClient.invalidateQueries({ queryKey: ['organization', organizationSlug] });
			// Auto-close dialog after 2 seconds
			setTimeout(() => {
				showDialog = false;
				requestSubmitted = false;
				message = '';
				// Call the onSuccess callback to refresh parent state
				onSuccess?.();
			}, 2000);
		}
	}));

	function handleSubmit() {
		requestMutation.mutate(message);
	}

	function handleDialogChange(open: boolean) {
		// If trying to open and not authenticated, redirect to login
		if (open && !isAuthenticated) {
			window.location.href = `/login?redirect=${encodeURIComponent(window.location.pathname)}`;
			return;
		}

		// Otherwise update the dialog state
		showDialog = open;

		// Reset form when closing
		if (!open) {
			message = '';
			requestSubmitted = false;
		}
	}
</script>

{#if hasAlreadyRequested}
	<!-- Already Requested Badge -->
	<div
		class="inline-flex items-center gap-2 rounded-md border border-yellow-200 bg-yellow-50 px-4 py-2 text-sm font-medium text-yellow-700 dark:border-yellow-800 dark:bg-yellow-950 dark:text-yellow-300 {className}"
		role="status"
		aria-label={m['requestWhitelistButton.alreadyRequested']?.() ?? 'You have already requested verification'}
	>
		<AlertCircle class="h-4 w-4" aria-hidden="true" />
		{m['requestWhitelistButton.verificationRequested']?.() ?? 'Verification requested'}
	</div>
{:else}
	<Dialog.Root open={showDialog} onOpenChange={handleDialogChange}>
		<Dialog.Trigger
			class="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 {className}"
		>
			<ShieldCheck class="h-4 w-4" aria-hidden="true" />
			{m['requestWhitelistButton.requestVerification']?.() ?? 'Request Verification'}
		</Dialog.Trigger>

		<Dialog.Content class="sm:max-w-[500px]">
			{#if requestSubmitted}
				<!-- Success State -->
				<div class="py-8 text-center">
					<div
						class="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-green-100 dark:bg-green-900"
					>
						<svg
							class="h-8 w-8 text-green-600 dark:text-green-300"
							fill="none"
							stroke="currentColor"
							viewBox="0 0 24 24"
							aria-hidden="true"
						>
							<path
								stroke-linecap="round"
								stroke-linejoin="round"
								stroke-width="2"
								d="M5 13l4 4L19 7"
							/>
						</svg>
					</div>
					<Dialog.Title class="text-xl font-semibold">
						{m['requestWhitelistButton.requestSubmitted']?.() ?? 'Verification Request Submitted'}
					</Dialog.Title>
					<Dialog.Description class="mt-2">
						{m['requestWhitelistButton.requestSubmittedBody']?.() ?? 'Your request has been submitted. The organization admins will review it and get back to you.'}
					</Dialog.Description>
				</div>
			{:else}
				<!-- Request Form -->
				<Dialog.Header>
					<Dialog.Title>
						{m['requestWhitelistButton.requestVerification']?.() ?? 'Request Verification'}
					</Dialog.Title>
					<Dialog.Description>
						{#if organizationName}
							{@html m['requestWhitelistButton.submitRequestToOrg']?.({
								organizationName: `<strong>${organizationName}</strong>`
							}) ?? `Submit a verification request to <strong>${organizationName}</strong>`}
						{:else}
							{m['requestWhitelistButton.submitRequestDescription']?.() ?? 'Submit a verification request to access this organization\'s events.'}
						{/if}
					</Dialog.Description>
				</Dialog.Header>

				<form
					onsubmit={(e) => {
						e.preventDefault();
						handleSubmit();
					}}
					class="space-y-4"
				>
					<div>
						<label for="whitelist-message" class="block text-sm font-medium">
							{m['requestWhitelistButton.messageOptional']?.() ?? 'Message (optional)'}
						</label>
						<textarea
							id="whitelist-message"
							bind:value={message}
							placeholder={m['requestWhitelistButton.messagePlaceholder']?.() ?? 'Explain why you should be verified (e.g., how the organizers know you)...'}
							rows="4"
							maxlength="500"
							class="mt-1 w-full rounded-md border-2 border-gray-300 bg-white px-3 py-2 text-sm transition-colors placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
						></textarea>
						<p class="mt-1 text-xs text-muted-foreground">
							{m['requestWhitelistButton.characterCount']?.({ count: message.length }) ?? `${message.length}/500 characters`}
						</p>
					</div>

					{#if requestMutation.isError}
						<div
							class="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-800 dark:border-red-800 dark:bg-red-950 dark:text-red-100"
							role="alert"
						>
							{requestMutation.error?.message || (m['requestWhitelistButton.failedToSubmitTryAgain']?.() ?? 'Failed to submit request. Please try again.')}
						</div>
					{/if}

					<Dialog.Footer>
						<Button
							type="button"
							variant="outline"
							onclick={() => (showDialog = false)}
							disabled={requestMutation.isPending}
						>
							{m['requestWhitelistButton.cancel']?.() ?? 'Cancel'}
						</Button>
						<Button type="submit" disabled={requestMutation.isPending}>
							{#if requestMutation.isPending}
								<div
									class="mr-2 h-4 w-4 animate-spin rounded-full border-2 border-primary-foreground border-t-transparent"
									aria-hidden="true"
								></div>
								{m['requestWhitelistButton.submitting']?.() ?? 'Submitting...'}
							{:else}
								<Send class="mr-2 h-4 w-4" aria-hidden="true" />
								{m['requestWhitelistButton.submitRequest']?.() ?? 'Submit Request'}
							{/if}
						</Button>
					</Dialog.Footer>
				</form>
			{/if}
		</Dialog.Content>
	</Dialog.Root>
{/if}
