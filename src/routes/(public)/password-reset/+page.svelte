<script lang="ts">
	import * as m from '$lib/paraglide/messages.js';
	import { enhance } from '$app/forms';
	import type { ActionData } from './$types';
	import { Loader2, ArrowLeft, Mail } from 'lucide-svelte';

	interface Props {
		form: ActionData;
	}

	let { form }: Props = $props();

	// Form state
	let email = $state(form?.email || '');
	let isSubmitting = $state(false);

	// Success state - derive from form
	let success = $derived(form?.success || false);

	// Error handling
	let errors = $derived((form?.errors || {}) as Record<string, string>);
</script>

<svelte:head>
	<title>{m['passwordResetPage.title']()}</title>
	<meta name="description" content="Reset your Revel account password" />
</svelte:head>

<div class="container mx-auto flex min-h-[calc(100vh-4rem)] items-center justify-center px-4 py-8">
	<div class="w-full max-w-md space-y-8">
		<!-- Header -->
		<div class="text-center">
			<h1 class="text-3xl font-bold tracking-tight">
				{success ? 'Check your email' : 'Reset your password'}
			</h1>
			<p class="mt-2 text-muted-foreground">
				{success
					? 'If an account exists with that email, you will receive password reset instructions'
					: 'Enter your email address and we will send you a link to reset your password'}
			</p>
		</div>

		{#if success}
			<!-- Success State -->
			<div
				role="status"
				class="rounded-md border border-green-500 bg-green-50 p-6 dark:bg-green-950"
			>
				<div class="flex items-start gap-3">
					<Mail
						class="h-6 w-6 flex-shrink-0 text-green-600 dark:text-green-400"
						aria-hidden="true"
					/>
					<div class="flex-1 space-y-3">
						<p class="text-sm font-medium text-green-800 dark:text-green-200">
							Password reset email sent
						</p>
						<p class="text-sm text-green-700 dark:text-green-300">
							Check your inbox for password reset instructions. The link will expire in 1 hour.
						</p>
						<p class="text-xs text-green-600 dark:text-green-400">
							Didn't receive the email? Check your spam folder or try again in a few minutes.
						</p>
					</div>
				</div>
			</div>

			<!-- Back to Login -->
			<div class="text-center">
				<a
					href="/login"
					class="inline-flex items-center gap-2 text-sm text-primary underline-offset-4 hover:underline"
				>
					<ArrowLeft class="h-4 w-4" aria-hidden="true" />
					Back to login
				</a>
			</div>
		{:else}
			<!-- Error Summary -->
			{#if errors.form}
				<div role="alert" class="rounded-md border border-destructive bg-destructive/10 p-4">
					<p class="text-sm font-medium text-destructive">{errors.form}</p>
				</div>
			{/if}

			<!-- Reset Request Form -->
			<form
				method="POST"
				action="?/resetRequest"
				use:enhance={() => {
					// Prevent duplicate submissions
					if (isSubmitting) return;
					isSubmitting = true;

					return async ({ update }) => {
						isSubmitting = false;
						await update();
					};
				}}
				class="space-y-6"
			>
				<!-- Email Field -->
				<div class="space-y-2">
					<label for="email" class="block text-sm font-medium"> Email address </label>
					<input
						id="email"
						name="email"
						type="email"
						autocomplete="email"
						required
						bind:value={email}
						aria-invalid={!!errors.email}
						aria-describedby={errors.email ? 'email-error' : undefined}
						disabled={isSubmitting}
						class="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm transition-colors placeholder:text-muted-foreground focus:border-ring focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 {errors.email
							? 'border-destructive'
							: ''}"
						placeholder="you@example.com"
					/>
					{#if errors.email}
						<p id="email-error" class="text-sm text-destructive" role="alert">
							{errors.email}
						</p>
					{/if}
				</div>

				<!-- Submit Button -->
				<button
					type="submit"
					disabled={isSubmitting}
					class="inline-flex h-10 w-full items-center justify-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
				>
					{#if isSubmitting}
						<Loader2 class="h-4 w-4 animate-spin" aria-hidden="true" />
						<span>{m['passwordResetPage.sendingLink']()}</span>
					{:else}
						<span>{m['passwordResetPage.sendLink']()}</span>
					{/if}
				</button>
			</form>

			<!-- Back to Login Link -->
			<div class="text-center">
				<a
					href="/login"
					class="inline-flex items-center gap-2 text-sm text-primary underline-offset-4 hover:underline"
				>
					<ArrowLeft class="h-4 w-4" aria-hidden="true" />
					Back to login
				</a>
			</div>
		{/if}
	</div>
</div>
