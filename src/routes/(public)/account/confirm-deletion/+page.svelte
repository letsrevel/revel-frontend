<script lang="ts">
	import { enhance } from '$app/forms';
	import { page } from '$app/stores';
	import type { ActionData } from './$types';
	import { AlertTriangle, Loader2, CheckCircle } from 'lucide-svelte';
	import * as m from '$lib/paraglide/messages.js';

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
	<title>{m['accountDeletion.title']()}</title>
	<meta name="description" content={m['accountDeletion.metaDescription']()} />
</svelte:head>

<div class="container mx-auto flex min-h-[calc(100vh-4rem)] items-center justify-center px-4 py-8">
	<div class="w-full max-w-md space-y-8">
		{#if success}
			<!-- Success State -->
			<div class="text-center">
				<div
					class="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-green-100 dark:bg-green-950"
				>
					<CheckCircle class="h-8 w-8 text-green-600 dark:text-green-400" aria-hidden="true" />
				</div>
				<h1 class="text-3xl font-bold tracking-tight">{m['accountDeletion.successHeading']()}</h1>
				<p class="mt-2 text-muted-foreground">{m['accountDeletion.successSubheading']()}</p>
			</div>

			<div
				role="status"
				class="rounded-md border border-green-500 bg-green-50 p-6 dark:bg-green-950"
			>
				<div class="space-y-2 text-sm">
					<p class="font-medium text-green-800 dark:text-green-200">
						{m['accountDeletion.successMessage']()}
					</p>
					<p class="text-green-700 dark:text-green-300">
						{m['accountDeletion.successThankYou']()}
					</p>
				</div>
			</div>

			<!-- Call to Action -->
			<div class="text-center">
				<a
					href="/"
					class="inline-flex h-10 items-center justify-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
				>
					{m['accountDeletion.goToHomepage']()}
				</a>
			</div>
		{:else if !token}
			<!-- Missing Token Error -->
			<div class="text-center">
				<div
					class="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-destructive/10"
				>
					<AlertTriangle class="h-8 w-8 text-destructive" aria-hidden="true" />
				</div>
				<h1 class="text-3xl font-bold tracking-tight">
					{m['accountDeletion.invalidLinkHeading']()}
				</h1>
				<p class="mt-2 text-muted-foreground">
					{m['accountDeletion.invalidLinkSubheading']()}
				</p>
			</div>

			<div role="alert" class="rounded-md border border-destructive bg-destructive/10 p-4">
				<p class="text-sm font-medium text-destructive">
					{m['accountDeletion.invalidTokenError']()}
				</p>
				<p class="mt-2 text-sm text-muted-foreground">
					{m['accountDeletion.invalidTokenMessage']()}
				</p>
			</div>

			<div class="text-center">
				<a
					href="/account/privacy"
					class="inline-flex h-10 items-center justify-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
				>
					{m['accountDeletion.goToPrivacySettings']()}
				</a>
			</div>
		{:else}
			<!-- Confirmation Form -->
			<div class="text-center">
				<div
					class="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-destructive/10"
				>
					<AlertTriangle class="h-8 w-8 text-destructive" aria-hidden="true" />
				</div>
				<h1 class="text-3xl font-bold tracking-tight">{m['accountDeletion.confirmHeading']()}</h1>
				<p class="mt-2 text-muted-foreground">
					{m['accountDeletion.warningYouWillLose']()}
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
				<h2 class="font-semibold text-destructive">{m['accountDeletion.confirmHeading']()}</h2>
				<div class="mt-4 space-y-2">
					<p class="text-sm font-medium">{m['accountDeletion.warningYouWillLose']()}</p>
					<ul class="space-y-1 text-sm text-muted-foreground">
						<li class="flex items-center gap-2">
							<span class="text-destructive">•</span>
							{m['accountDeletion.loss_events']()}
						</li>
						<li class="flex items-center gap-2">
							<span class="text-destructive">•</span>
							{m['accountDeletion.loss_history']()}
						</li>
						<li class="flex items-center gap-2">
							<span class="text-destructive">•</span>
							{m['accountDeletion.loss_memberships']()}
						</li>
						<li class="flex items-center gap-2">
							<span class="text-destructive">•</span>
							{m['accountDeletion.loss_profile']()}
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
						class="inline-flex h-10 flex-1 items-center justify-center gap-2 rounded-md border border-input bg-background px-4 py-2 text-sm font-medium transition-colors hover:bg-accent hover:text-accent-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
					>
						{m['accountDeletion.cancel']()}
					</a>
					<button
						type="submit"
						disabled={isSubmitting}
						class="inline-flex h-10 flex-1 items-center justify-center gap-2 rounded-md bg-destructive px-4 py-2 text-sm font-semibold text-destructive-foreground transition-colors hover:bg-destructive/90 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
					>
						{#if isSubmitting}
							<Loader2 class="h-4 w-4 animate-spin" aria-hidden="true" />
							<span>{m['accountDeletion.deleting']()}</span>
						{:else}
							<span>{m['accountDeletion.deleteButton']()}</span>
						{/if}
					</button>
				</div>
			</form>

			<p class="text-center text-xs text-muted-foreground">
				{m['accountDeletion.warningImmediate']()}
			</p>
		{/if}
	</div>
</div>
