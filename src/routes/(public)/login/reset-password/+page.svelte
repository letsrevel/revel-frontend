<script lang="ts">
	import { enhance } from '$app/forms';
	import { page } from '$app/stores';
	import type { ActionData } from './$types';
	import PasswordStrengthIndicator from '$lib/components/forms/PasswordStrengthIndicator.svelte';
	import { Loader2, Eye, EyeOff, CheckCircle } from 'lucide-svelte';

	interface Props {
		form: ActionData;
	}

	let { form }: Props = $props();

	// Get token from URL query parameter
	let token = $derived($page.url.searchParams.get('token') || '');

	// Form state
	let password = $state('');
	let confirmPassword = $state('');
	let showPassword = $state(false);
	let showConfirmPassword = $state(false);
	let isSubmitting = $state(false);

	// Success state
	let success = $derived(form?.success || false);

	// Error handling
	let errors = $derived((form?.errors || {}) as Record<string, string>);
</script>

<svelte:head>
	<title>Set New Password - Revel</title>
	<meta name="description" content="Set a new password for your Revel account" />
</svelte:head>

<div class="container mx-auto flex min-h-[calc(100vh-4rem)] items-center justify-center px-4 py-8">
	<div class="w-full max-w-md space-y-8">
		<!-- Header -->
		<div class="text-center">
			<h1 class="text-3xl font-bold tracking-tight">
				{success ? 'Password reset successful' : 'Set new password'}
			</h1>
			<p class="mt-2 text-muted-foreground">
				{success
					? 'Your password has been successfully reset'
					: 'Enter a strong password for your account'}
			</p>
		</div>

		{#if success}
			<!-- Success State -->
			<div
				role="status"
				class="rounded-md border border-green-500 bg-green-50 p-6 dark:bg-green-950"
			>
				<div class="flex items-start gap-3">
					<CheckCircle
						class="h-6 w-6 flex-shrink-0 text-green-600 dark:text-green-400"
						aria-hidden="true"
					/>
					<div class="flex-1 space-y-2">
						<p class="text-sm font-medium text-green-800 dark:text-green-200">
							Your password has been reset
						</p>
						<p class="text-sm text-green-700 dark:text-green-300">
							You can now sign in with your new password.
						</p>
					</div>
				</div>
			</div>

			<!-- Login Button -->
			<a
				href="/login"
				class="inline-flex h-10 w-full items-center justify-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
			>
				Sign in to your account
			</a>
		{:else if !token}
			<!-- Missing Token Error -->
			<div role="alert" class="rounded-md border border-destructive bg-destructive/10 p-4">
				<p class="text-sm font-medium text-destructive">Invalid or missing reset token</p>
				<p class="mt-2 text-sm text-muted-foreground">
					The password reset link is invalid or has expired. Please request a new password reset.
				</p>
			</div>

			<a
				href="/password-reset"
				class="inline-flex h-10 w-full items-center justify-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
			>
				Request new reset link
			</a>
		{:else}
			<!-- Error Summary -->
			{#if errors.form}
				<div role="alert" class="rounded-md border border-destructive bg-destructive/10 p-4">
					<p class="text-sm font-medium text-destructive">{errors.form}</p>
				</div>
			{/if}

			<!-- Password Reset Form -->
			<form
				method="POST"
				action="?/resetPassword"
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
				<input type="hidden" name="token" value={token} />

				<!-- New Password Field -->
				<div class="space-y-2">
					<label for="password" class="block text-sm font-medium"> New password </label>
					<div class="relative">
						<input
							id="password"
							name="password"
							type={showPassword ? 'text' : 'password'}
							autocomplete="new-password"
							required
							bind:value={password}
							onpaste={() => {
								// Ensure paste always works on mobile
								// This explicit handler prevents any interference from browser autofill
								// that might block paste operations on iOS Safari
							}}
							aria-invalid={!!errors.password}
							aria-describedby={errors.password ? 'password-error' : 'password-requirements'}
							disabled={isSubmitting}
							class="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 pr-10 text-sm transition-colors placeholder:text-muted-foreground focus:border-ring focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 {errors.password
								? 'border-destructive'
								: ''}"
							placeholder="Enter your new password"
						/>
						<button
							type="button"
							onclick={() => (showPassword = !showPassword)}
							class="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-muted-foreground transition-colors hover:text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
							aria-label={showPassword ? 'Hide password' : 'Show password'}
							tabindex={-1}
						>
							{#if showPassword}
								<EyeOff class="h-4 w-4" aria-hidden="true" />
							{:else}
								<Eye class="h-4 w-4" aria-hidden="true" />
							{/if}
						</button>
					</div>
					{#if errors.password}
						<p id="password-error" class="text-sm text-destructive" role="alert">
							{errors.password}
						</p>
					{/if}
				</div>

				<!-- Password Strength Indicator -->
				<div id="password-requirements">
					<PasswordStrengthIndicator {password} />
				</div>

				<!-- Confirm Password Field -->
				<div class="space-y-2">
					<label for="confirmPassword" class="block text-sm font-medium"> Confirm password </label>
					<div class="relative">
						<input
							id="confirmPassword"
							name="confirmPassword"
							type={showConfirmPassword ? 'text' : 'password'}
							autocomplete="new-password"
							required
							bind:value={confirmPassword}
							onpaste={() => {
								// Ensure paste always works on mobile
								// This explicit handler prevents any interference from browser autofill
								// that might block paste operations on iOS Safari
							}}
							aria-invalid={!!errors.confirmPassword}
							aria-describedby={errors.confirmPassword ? 'confirm-password-error' : undefined}
							disabled={isSubmitting}
							class="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 pr-10 text-sm transition-colors placeholder:text-muted-foreground focus:border-ring focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 {errors.confirmPassword
								? 'border-destructive'
								: ''}"
							placeholder="Confirm your new password"
						/>
						<button
							type="button"
							onclick={() => (showConfirmPassword = !showConfirmPassword)}
							class="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-muted-foreground transition-colors hover:text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
							aria-label={showConfirmPassword ? 'Hide password' : 'Show password'}
							tabindex={-1}
						>
							{#if showConfirmPassword}
								<EyeOff class="h-4 w-4" aria-hidden="true" />
							{:else}
								<Eye class="h-4 w-4" aria-hidden="true" />
							{/if}
						</button>
					</div>
					{#if errors.confirmPassword}
						<p id="confirm-password-error" class="text-sm text-destructive" role="alert">
							{errors.confirmPassword}
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
						<span>Resetting password...</span>
					{:else}
						<span>Reset password</span>
					{/if}
				</button>
			</form>

			<!-- Back to Login Link -->
			<div class="text-center text-sm">
				<a href="/login" class="text-primary underline-offset-4 hover:underline"> Back to login </a>
			</div>
		{/if}
	</div>
</div>
