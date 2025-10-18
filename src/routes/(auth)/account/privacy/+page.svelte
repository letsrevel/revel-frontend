<script lang="ts">
	import { enhance } from '$app/forms';
	import type { ActionData } from './$types';
	import { Trash2, AlertTriangle, Mail, Loader2 } from 'lucide-svelte';

	interface Props {
		form: ActionData;
	}

	let { form }: Props = $props();

	// State for confirmation modal
	let showDeletionModal = $state(false);
	let confirmed = $state(false);
	let isSubmitting = $state(false);

	// Success state - derive from form
	let success = $derived(form?.success || false);

	// Error handling
	let errors = $derived((form?.errors || {}) as Record<string, string>);

	function openDeletionModal() {
		showDeletionModal = true;
		confirmed = false;
	}

	function closeDeletionModal() {
		showDeletionModal = false;
		confirmed = false;
	}
</script>

<svelte:head>
	<title>Privacy & Data - Revel</title>
	<meta name="description" content="Manage your privacy settings and data on Revel" />
</svelte:head>

<div class="container mx-auto max-w-4xl px-4 py-8">
	<!-- Page Header -->
	<div class="mb-8">
		<h1 class="text-3xl font-bold tracking-tight">Privacy & Data</h1>
		<p class="mt-2 text-muted-foreground">
			Manage your privacy settings and exercise your data rights
		</p>
	</div>

	<!-- Success Message -->
	{#if success}
		<div
			role="status"
			class="mb-8 rounded-md border border-green-500 bg-green-50 p-6 dark:bg-green-950"
		>
			<div class="flex items-start gap-3">
				<Mail class="h-6 w-6 flex-shrink-0 text-green-600 dark:text-green-400" aria-hidden="true" />
				<div class="flex-1 space-y-2">
					<p class="text-sm font-medium text-green-800 dark:text-green-200">
						Deletion confirmation email sent
					</p>
					<p class="text-sm text-green-700 dark:text-green-300">
						We've sent a confirmation email to your registered email address. Click the link in the
						email to permanently delete your account. The link will expire in 24 hours.
					</p>
					<p class="text-xs text-green-600 dark:text-green-400">
						If you didn't request this, you can safely ignore the email and your account will not be
						deleted.
					</p>
				</div>
			</div>
		</div>
	{/if}

	<!-- Error Message -->
	{#if errors.form}
		<div role="alert" class="mb-8 rounded-md border border-destructive bg-destructive/10 p-4">
			<p class="text-sm font-medium text-destructive">{errors.form}</p>
		</div>
	{/if}

	<!-- Data Export Section (Future) -->
	<section class="mb-12">
		<h2 class="text-xl font-semibold">Export Your Data</h2>
		<p class="mt-2 text-sm text-muted-foreground">
			Request a copy of all your data in JSON format. You can export your data once every 24
			hours.
		</p>
		<button
			type="button"
			disabled
			class="mt-4 inline-flex h-10 items-center justify-center gap-2 rounded-md border border-input bg-background px-4 py-2 text-sm font-medium transition-colors hover:bg-accent hover:text-accent-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
		>
			Export Data (Coming Soon)
		</button>
	</section>

	<!-- Account Deletion Section -->
	<section class="rounded-lg border border-destructive/30 bg-destructive/5 p-6">
		<div class="flex items-start gap-4">
			<div
				class="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-full bg-destructive/10"
			>
				<AlertTriangle class="h-6 w-6 text-destructive" aria-hidden="true" />
			</div>
			<div class="flex-1">
				<h2 class="text-xl font-semibold text-destructive">Danger Zone</h2>
				<p class="mt-2 text-sm text-muted-foreground">
					Once you delete your account, there is no going back. All your data will be permanently
					removed and cannot be recovered.
				</p>

				<div class="mt-6">
					<h3 class="text-sm font-medium">What will be deleted:</h3>
					<ul class="mt-2 space-y-1 text-sm text-muted-foreground">
						<li class="flex items-center gap-2">
							<span class="text-destructive">✗</span>
							Your profile and account credentials
						</li>
						<li class="flex items-center gap-2">
							<span class="text-destructive">✗</span>
							All event RSVPs and tickets
						</li>
						<li class="flex items-center gap-2">
							<span class="text-destructive">✗</span>
							Questionnaire submissions and responses
						</li>
						<li class="flex items-center gap-2">
							<span class="text-destructive">✗</span>
							Organization memberships (if you're not an owner)
						</li>
						<li class="flex items-center gap-2">
							<span class="text-destructive">✗</span>
							Uploaded files and avatar
						</li>
					</ul>
				</div>

				<button
					type="button"
					onclick={openDeletionModal}
					disabled={success}
					class="mt-6 inline-flex h-10 items-center justify-center gap-2 rounded-md bg-destructive px-4 py-2 text-sm font-semibold text-destructive-foreground transition-colors hover:bg-destructive/90 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
				>
					<Trash2 class="h-4 w-4" aria-hidden="true" />
					Delete My Account
				</button>
			</div>
		</div>
	</section>
</div>

<!-- Deletion Confirmation Modal -->
{#if showDeletionModal}
	<div
		class="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
		role="dialog"
		aria-modal="true"
		aria-labelledby="deletion-modal-title"
		tabindex="-1"
		onclick={(e) => {
			if (e.target === e.currentTarget) closeDeletionModal();
		}}
		onkeydown={(e) => {
			if (e.key === 'Escape') closeDeletionModal();
		}}
	>
		<div class="w-full max-w-md rounded-lg bg-background p-6 shadow-lg">
			<div class="mb-4 flex items-start gap-3">
				<div
					class="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-destructive/10"
				>
					<AlertTriangle class="h-5 w-5 text-destructive" aria-hidden="true" />
				</div>
				<div class="flex-1">
					<h2 id="deletion-modal-title" class="text-lg font-semibold">
						Permanently Delete Account?
					</h2>
					<p class="mt-1 text-sm text-muted-foreground">
						This action cannot be undone. We'll send you a confirmation email to verify this
						request.
					</p>
				</div>
			</div>

			<div class="mb-6 space-y-2 rounded-md bg-destructive/5 p-4">
				<p class="text-sm font-medium">The following will be permanently deleted:</p>
				<ul class="space-y-1 text-sm text-muted-foreground">
					<li class="flex items-center gap-2">
						<span class="text-destructive">✗</span>
						Your profile and account data
					</li>
					<li class="flex items-center gap-2">
						<span class="text-destructive">✗</span>
						All event RSVPs and tickets
					</li>
					<li class="flex items-center gap-2">
						<span class="text-destructive">✗</span>
						Questionnaire submissions
					</li>
					<li class="flex items-center gap-2">
						<span class="text-destructive">✗</span>
						Organization memberships
					</li>
				</ul>
			</div>

			<form
				method="POST"
				action="?/requestDeletion"
				use:enhance={() => {
					if (isSubmitting || !confirmed) return;
					isSubmitting = true;

					return async ({ update }) => {
						isSubmitting = false;
						await update();
						closeDeletionModal();
					};
				}}
				class="space-y-4"
			>
				<!-- Confirmation Checkbox -->
				<div class="flex items-start gap-2">
					<input
						id="confirm-deletion"
						type="checkbox"
						bind:checked={confirmed}
						disabled={isSubmitting}
						class="mt-0.5 h-4 w-4 rounded border-input text-destructive transition-colors focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
						required
					/>
					<label for="confirm-deletion" class="text-sm">
						I understand this action is permanent and cannot be reversed
					</label>
				</div>

				<!-- Action Buttons -->
				<div class="flex gap-3">
					<button
						type="button"
						onclick={closeDeletionModal}
						disabled={isSubmitting}
						class="flex-1 inline-flex h-10 items-center justify-center gap-2 rounded-md border border-input bg-background px-4 py-2 text-sm font-medium transition-colors hover:bg-accent hover:text-accent-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
					>
						Cancel
					</button>
					<button
						type="submit"
						disabled={isSubmitting || !confirmed}
						class="flex-1 inline-flex h-10 items-center justify-center gap-2 rounded-md bg-destructive px-4 py-2 text-sm font-semibold text-destructive-foreground transition-colors hover:bg-destructive/90 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
					>
						{#if isSubmitting}
							<Loader2 class="h-4 w-4 animate-spin" aria-hidden="true" />
							<span>Sending...</span>
						{:else}
							<span>Send Confirmation Email</span>
						{/if}
					</button>
				</div>
			</form>
		</div>
	</div>
{/if}
