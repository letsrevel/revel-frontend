<script lang="ts">
	import { enhance } from '$app/forms';
	import { page } from '$app/stores';
	import type { ActionData } from './$types';
	import { AlertTriangle, Loader2, CheckCircle } from 'lucide-svelte';

	interface Props {
		form: ActionData;
	}

	let { form }: Props = $props();

	// Get token from URL query parameter
	let token = $derived($page.url.searchParams.get('token') || '');

	// State
	let isSubmitting = $state(false);

	// Success state
	let success = $derived(form?.success || false);

	// Error handling
	let errors = $derived((form?.errors || {}) as Record<string, string>);
</script>

<svelte:head>
	<title>Confirm Account Deletion - Revel</title>
	<meta name="description" content="Confirm permanent deletion of your Revel account" />
</svelte:head>

<div class="container mx-auto flex min-h-[calc(100vh-4rem)] items-center justify-center px-4 py-8">
	<div class="w-full max-w-md space-y-8">
		{#if success}
			<!-- Success State -->
			<div class="text-center">
				<div class="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-green-100 dark:bg-green-950">
					<CheckCircle class="h-8 w-8 text-green-600 dark:text-green-400" aria-hidden="true" />
				</div>
				<h1 class="text-3xl font-bold tracking-tight">Account Deleted</h1>
				<p class="mt-2 text-muted-foreground">
					Your account has been permanently deleted
				</p>
			</div>

			<div
				role="status"
				class="rounded-md border border-green-500 bg-green-50 p-6 dark:bg-green-950"
			>
				<div class="space-y-2 text-sm">
					<p class="font-medium text-green-800 dark:text-green-200">
						Your Revel account and all associated data have been permanently deleted.
					</p>
					<p class="text-green-700 dark:text-green-300">
						Thank you for using Revel. If you change your mind, you can create a new account anytime.
					</p>
				</div>
			</div>

			<!-- Call to Action -->
			<div class="text-center">
				<a
					href="/"
					class="inline-flex h-10 items-center justify-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
				>
					Go to Homepage
				</a>
			</div>
		{:else if !token}
			<!-- Missing Token Error -->
			<div class="text-center">
				<div class="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-destructive/10">
					<AlertTriangle class="h-8 w-8 text-destructive" aria-hidden="true" />
				</div>
				<h1 class="text-3xl font-bold tracking-tight">Invalid Link</h1>
				<p class="mt-2 text-muted-foreground">
					This account deletion link is invalid or has expired
				</p>
			</div>

			<div role="alert" class="rounded-md border border-destructive bg-destructive/10 p-4">
				<p class="text-sm font-medium text-destructive">Invalid or missing deletion token</p>
				<p class="mt-2 text-sm text-muted-foreground">
					The account deletion link is invalid or has expired. If you still want to delete your account, please request a new deletion link from your account settings.
				</p>
			</div>

			<div class="text-center">
				<a
					href="/account/privacy"
					class="inline-flex h-10 items-center justify-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
				>
					Go to Privacy Settings
				</a>
			</div>
		{:else}
			<!-- Confirmation Form -->
			<div class="text-center">
				<div class="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-destructive/10">
					<AlertTriangle class="h-8 w-8 text-destructive" aria-hidden="true" />
				</div>
				<h1 class="text-3xl font-bold tracking-tight">Confirm Account Deletion</h1>
				<p class="mt-2 text-muted-foreground">
					You're about to permanently delete your Revel account
				</p>
			</div>

			<!-- Error Message -->
			{#if errors.form}
				<div role="alert" class="rounded-md border border-destructive bg-destructive/10 p-4">
					<p class="text-sm font-medium text-destructive">{errors.form}</p>
				</div>
			{/if}

			<!-- Warning Box -->
			<div class="rounded-md border border-destructive/30 bg-destructive/5 p-6">
				<h2 class="font-semibold text-destructive">This action cannot be undone</h2>
				<div class="mt-4 space-y-2">
					<p class="text-sm font-medium">Once deleted, you will lose:</p>
					<ul class="space-y-1 text-sm text-muted-foreground">
						<li class="flex items-center gap-2">
							<span class="text-destructive">•</span>
							Access to all events and tickets
						</li>
						<li class="flex items-center gap-2">
							<span class="text-destructive">•</span>
							Your event history and RSVPs
						</li>
						<li class="flex items-center gap-2">
							<span class="text-destructive">•</span>
							Organization memberships
						</li>
						<li class="flex items-center gap-2">
							<span class="text-destructive">•</span>
							All profile data and settings
						</li>
					</ul>
				</div>
			</div>

			<!-- Confirmation Form -->
			<form
				method="POST"
				action="?/confirmDeletion"
				use:enhance={() => {
					if (isSubmitting) return;
					isSubmitting = true;

					return async ({ update }) => {
						isSubmitting = false;
						await update();
					};
				}}
				class="space-y-4"
			>
				<input type="hidden" name="token" value={token} />

				<div class="flex gap-3">
					<a
						href="/"
						class="flex-1 inline-flex h-10 items-center justify-center gap-2 rounded-md border border-input bg-background px-4 py-2 text-sm font-medium transition-colors hover:bg-accent hover:text-accent-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
					>
						Cancel
					</a>
					<button
						type="submit"
						disabled={isSubmitting}
						class="flex-1 inline-flex h-10 items-center justify-center gap-2 rounded-md bg-destructive px-4 py-2 text-sm font-semibold text-destructive-foreground transition-colors hover:bg-destructive/90 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
					>
						{#if isSubmitting}
							<Loader2 class="h-4 w-4 animate-spin" aria-hidden="true" />
							<span>Deleting...</span>
						{:else}
							<span>Permanently Delete Account</span>
						{/if}
					</button>
				</div>
			</form>

			<p class="text-center text-xs text-muted-foreground">
				This action is immediate and cannot be reversed
			</p>
		{/if}
	</div>
</div>
