<script lang="ts">
	import * as m from '$lib/paraglide/messages.js';
	import { createMutation, useQueryClient } from '@tanstack/svelte-query';
	import { organizationCreateMembershipRequest } from '$lib/api/generated/sdk.gen';
	import { authStore } from '$lib/stores/auth.svelte';
	import { UserPlus, Send, Check, Crown, Shield } from 'lucide-svelte';
	import { Button } from '$lib/components/ui/button';
	import * as Dialog from '$lib/components/ui/dialog';

	interface Props {
		organizationSlug: string;
		organizationName: string;
		isAuthenticated: boolean;
		isMember?: boolean;
		isOwner?: boolean;
		isStaff?: boolean;
		class?: string;
	}

	let {
		organizationSlug,
		organizationName,
		isAuthenticated,
		isMember = false,
		isOwner = false,
		isStaff = false,
		class: className
	}: Props = $props();

	const queryClient = useQueryClient();
	const accessToken = $derived(authStore.accessToken);

	// Dialog state
	let showDialog = $state(false);
	let message = $state('');
	let requestSubmitted = $state(false);

	// Create mutation for submitting membership request
	const requestMutation = createMutation(() => ({
		mutationFn: async (messageText: string) => {
			if (!accessToken) {
				throw new Error('You must be logged in to request membership');
			}

			const response = await organizationCreateMembershipRequest({
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
						: 'Failed to submit membership request'
				);
			}

			return response.data;
		},
		onSuccess: () => {
			requestSubmitted = true;
			// Invalidate relevant queries to refetch data
			queryClient.invalidateQueries({ queryKey: ['organization', organizationSlug] });
			// Auto-close dialog after 2 seconds
			setTimeout(() => {
				showDialog = false;
				requestSubmitted = false;
				message = '';
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

{#if isOwner}
	<!-- Owner Badge -->
	<div
		class="inline-flex items-center gap-2 rounded-md border border-primary bg-primary/10 px-4 py-2 text-sm font-medium text-primary dark:border-primary dark:bg-primary/20 {className}"
		role="status"
		aria-label="You are the owner of this organization"
	>
		<Crown class="h-4 w-4" aria-hidden="true" />
		Owner
	</div>
{:else if isStaff}
	<!-- Staff Badge -->
	<div
		class="inline-flex items-center gap-2 rounded-md border border-blue-200 bg-blue-50 px-4 py-2 text-sm font-medium text-blue-700 dark:border-blue-800 dark:bg-blue-950 dark:text-blue-300 {className}"
		role="status"
		aria-label="You are a staff member of this organization"
	>
		<Shield class="h-4 w-4" aria-hidden="true" />
		Staff
	</div>
{:else if isMember}
	<!-- Member Badge -->
	<div
		class="inline-flex items-center gap-2 rounded-md border border-green-200 bg-green-50 px-4 py-2 text-sm font-medium text-green-700 dark:border-green-800 dark:bg-green-950 dark:text-green-300 {className}"
		role="status"
		aria-label="You are a member of this organization"
	>
		<Check class="h-4 w-4" aria-hidden="true" />
		Member
	</div>
{:else}
	<Dialog.Root open={showDialog} onOpenChange={handleDialogChange}>
		<Dialog.Trigger
			class="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 {className}"
		>
			<UserPlus class="h-4 w-4" aria-hidden="true" />
			{m['requestMembershipButton.requestMembership']()}
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
					<Dialog.Title class="text-xl font-semibold">{m['requestMembershipButton.requestSubmitted']()}</Dialog.Title>
					<Dialog.Description class="mt-2">
						Your membership request has been sent to {organizationName}. You'll be notified when
						it's reviewed.
					</Dialog.Description>
				</div>
			{:else}
				<!-- Request Form -->
				<Dialog.Header>
					<Dialog.Title>{m['requestMembershipButton.requestMembership']()}</Dialog.Title>
					<Dialog.Description>
						Submit a request to become a member of {organizationName}. Members may have access to
						exclusive events and content.
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
						<label for="message" class="block text-sm font-medium"> Message (Optional) </label>
						<textarea
							id="message"
							bind:value={message}
							placeholder="Tell the organizers why you'd like to join..."
							rows="4"
							maxlength="500"
							class="mt-1 w-full rounded-md border-2 border-gray-300 bg-white px-3 py-2 text-sm transition-colors placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
						></textarea>
						<p class="mt-1 text-xs text-muted-foreground">
							{message.length}/500 characters
						</p>
					</div>

					{#if requestMutation.isError}
						<div
							class="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-800 dark:border-red-800 dark:bg-red-950 dark:text-red-100"
							role="alert"
						>
							{requestMutation.error?.message || 'Failed to submit request. Please try again.'}
						</div>
					{/if}

					<Dialog.Footer>
						<Button
							type="button"
							variant="outline"
							onclick={() => (showDialog = false)}
							disabled={requestMutation.isPending}
						>
							Cancel
						</Button>
						<Button type="submit" disabled={requestMutation.isPending}>
							{#if requestMutation.isPending}
								<div
									class="mr-2 h-4 w-4 animate-spin rounded-full border-2 border-primary-foreground border-t-transparent"
									aria-hidden="true"
								></div>
								Submitting...
							{:else}
								<Send class="mr-2 h-4 w-4" aria-hidden="true" />
								Submit Request
							{/if}
						</Button>
					</Dialog.Footer>
				</form>
			{/if}
		</Dialog.Content>
	</Dialog.Root>
{/if}
