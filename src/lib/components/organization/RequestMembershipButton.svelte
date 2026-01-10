<script lang="ts">
	import * as m from '$lib/paraglide/messages.js';
	import { createMutation, useQueryClient } from '@tanstack/svelte-query';
	import { organizationCreateMembershipRequest } from '$lib/api/generated/sdk.gen';
	import { authStore } from '$lib/stores/auth.svelte';
	import { UserPlus, Send, Check, Crown, Shield, Award } from 'lucide-svelte';
	import { Button } from '$lib/components/ui/button';
	import * as Dialog from '$lib/components/ui/dialog';
	import type { MembershipTierSchema, MembershipStatus } from '$lib/api/generated/types.gen';

	interface Props {
		organizationSlug: string;
		organizationName: string;
		isAuthenticated: boolean;
		isMember?: boolean;
		membershipTier?: MembershipTierSchema | null;
		membershipStatus?: MembershipStatus | null;
		isOwner?: boolean;
		isStaff?: boolean;
		class?: string;
	}

	let {
		organizationSlug,
		organizationName,
		isAuthenticated,
		isMember = false,
		membershipTier = null,
		membershipStatus = null,
		isOwner = false,
		isStaff = false,
		class: className
	}: Props = $props();

	// Status badge styling (matching MemberCard.svelte)
	const statusStyles: Record<MembershipStatus, string> = {
		active: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-100',
		paused: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-100',
		cancelled: 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-100',
		banned: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-100'
	};

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
		aria-label={m['requestMembershipButton.ownerAriaLabel']()}
	>
		<Crown class="h-4 w-4" aria-hidden="true" />
		{m['requestMembershipButton.owner']()}
	</div>
{:else if isStaff}
	<!-- Staff Badge -->
	<div
		class="inline-flex items-center gap-2 rounded-md border border-blue-200 bg-blue-50 px-4 py-2 text-sm font-medium text-blue-700 dark:border-blue-800 dark:bg-blue-950 dark:text-blue-300 {className}"
		role="status"
		aria-label={m['requestMembershipButton.staffAriaLabel']()}
	>
		<Shield class="h-4 w-4" aria-hidden="true" />
		{m['requestMembershipButton.staff']()}
	</div>
{:else if isMember}
	<!-- Member Badge (with status and tier) -->
	<div class="inline-flex flex-wrap items-center gap-2 {className}" role="status">
		<!-- Status Badge -->
		{#if membershipStatus}
			<span
				class="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium {statusStyles[
					membershipStatus
				]}"
				aria-label={m['requestMembershipButton.membershipStatusAriaLabel']({
					status: membershipStatus
				})}
			>
				<Check class="h-3 w-3" aria-hidden="true" />
				{m[`memberStatus.${membershipStatus}`]()}
			</span>
		{/if}

		<!-- Tier Badge -->
		{#if membershipTier}
			<span
				class="inline-flex items-center gap-1.5 rounded-full bg-blue-100 px-3 py-1.5 text-xs font-medium text-blue-800 dark:bg-blue-900 dark:text-blue-100"
				aria-label={m['requestMembershipButton.membershipTierAriaLabel']({
					tier: membershipTier.name
				})}
			>
				<Award class="h-3 w-3" aria-hidden="true" />
				{membershipTier.name}
			</span>
		{:else if !membershipStatus}
			<!-- Fallback if no status or tier -->
			<span
				class="inline-flex items-center gap-1.5 rounded-full bg-green-100 px-3 py-1.5 text-xs font-medium text-green-800 dark:bg-green-900 dark:text-green-100"
				aria-label={m['requestMembershipButton.memberAriaLabel']()}
			>
				<Check class="h-3 w-3" aria-hidden="true" />
				{m['requestMembershipButton.member']()}
			</span>
		{/if}
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
					<Dialog.Title class="text-xl font-semibold"
						>{m['requestMembershipButton.requestSubmitted']()}</Dialog.Title
					>
					<Dialog.Description class="mt-2">
						{m['requestMembershipButton.requestSubmittedDesc']({ organizationName })}
					</Dialog.Description>
				</div>
			{:else}
				<!-- Request Form -->
				<Dialog.Header>
					<Dialog.Title>{m['requestMembershipButton.requestMembership']()}</Dialog.Title>
					<Dialog.Description>
						{m['requestMembershipButton.requestDesc']({ organizationName })}
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
						<label for="message" class="block text-sm font-medium">
							{m['requestMembershipButton.messageOptional']()}
						</label>
						<textarea
							id="message"
							bind:value={message}
							placeholder={m['requestMembershipButton.messagePlaceholder']()}
							rows="4"
							maxlength="500"
							class="mt-1 w-full rounded-md border-2 border-gray-300 bg-white px-3 py-2 text-sm transition-colors placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
						></textarea>
						<p class="mt-1 text-xs text-muted-foreground">
							{message.length}/500 {m['requestMembershipButton.characters']()}
						</p>
					</div>

					{#if requestMutation.isError}
						<div
							class="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-800 dark:border-red-800 dark:bg-red-950 dark:text-red-100"
							role="alert"
						>
							{requestMutation.error?.message || m['requestMembershipButton.submitError']()}
						</div>
					{/if}

					<Dialog.Footer>
						<Button
							type="button"
							variant="outline"
							onclick={() => (showDialog = false)}
							disabled={requestMutation.isPending}
						>
							{m['requestMembershipButton.cancel']()}
						</Button>
						<Button type="submit" disabled={requestMutation.isPending}>
							{#if requestMutation.isPending}
								<div
									class="mr-2 h-4 w-4 animate-spin rounded-full border-2 border-primary-foreground border-t-transparent"
									aria-hidden="true"
								></div>
								{m['requestMembershipButton.submitting']()}
							{:else}
								<Send class="mr-2 h-4 w-4" aria-hidden="true" />
								{m['requestMembershipButton.submitRequest']()}
							{/if}
						</Button>
					</Dialog.Footer>
				</form>
			{/if}
		</Dialog.Content>
	</Dialog.Root>
{/if}
