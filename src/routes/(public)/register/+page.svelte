<script lang="ts">
	import { enhance } from '$app/forms';
	import type { ActionData } from './$types';
	import PasswordStrengthIndicator from '$lib/components/forms/PasswordStrengthIndicator.svelte';
	import { Eye, EyeOff, Loader2 } from 'lucide-svelte';

	interface Props {
		form: ActionData;
	}

	let { form }: Props = $props();

	// Form state
	let email = $state(form?.email || '');
	let password = $state('');
	let confirmPassword = $state('');
	let acceptTerms = $state(false);
	let showPassword = $state(false);
	let showConfirmPassword = $state(false);
	let isSubmitting = $state(false);

	// Error handling - type assertion needed due to ActionData union
	let errors = $derived((form?.errors || {}) as Record<string, string>);
	let hasErrors = $derived(errors && Object.keys(errors).length > 0);
</script>

<svelte:head>
	<title>Create Account - Revel</title>
	<meta name="description" content="Create your Revel account to start organizing and attending community events" />
</svelte:head>

<div class="container mx-auto flex min-h-[calc(100vh-4rem)] items-center justify-center px-4 py-8">
	<div class="w-full max-w-md space-y-8">
		<!-- Header -->
		<div class="text-center">
			<h1 class="text-3xl font-bold tracking-tight">Create your account</h1>
			<p class="mt-2 text-muted-foreground">
				Join Revel to discover and organize community events
			</p>
		</div>

		<!-- Error Summary -->
		{#if hasErrors && errors.form}
			<div
				role="alert"
				class="rounded-md border border-destructive bg-destructive/10 p-4"
			>
				<p class="text-sm font-medium text-destructive">{errors.form}</p>
			</div>
		{/if}

		<!-- Registration Form -->
		<form
			method="POST"
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
				<label for="email" class="block text-sm font-medium">
					Email address
				</label>
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

			<!-- Password Field -->
			<div class="space-y-2">
				<label for="password" class="block text-sm font-medium">
					Password
				</label>
				<div class="relative">
					<input
						id="password"
						name="password"
						type={showPassword ? 'text' : 'password'}
						autocomplete="new-password"
						required
						bind:value={password}
						aria-invalid={!!errors.password}
						aria-describedby={errors.password ? 'password-error password-requirements' : 'password-requirements'}
						disabled={isSubmitting}
						class="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 pr-10 text-sm transition-colors placeholder:text-muted-foreground focus:border-ring focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 {errors.password
							? 'border-destructive'
							: ''}"
						placeholder="Create a strong password"
					/>
					<button
						type="button"
						onclick={() => (showPassword = !showPassword)}
						class="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-muted-foreground transition-colors hover:text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
						aria-label={showPassword ? 'Hide password' : 'Show password'}
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

				<!-- Password Strength Indicator -->
				{#if password}
					<PasswordStrengthIndicator {password} />
				{/if}

				<!-- Password Requirements -->
				<div id="password-requirements" class="text-xs text-muted-foreground">
					<p class="font-medium">Password must contain:</p>
					<ul class="mt-1 space-y-0.5 pl-4">
						<li>At least 8 characters</li>
						<li>One uppercase letter</li>
						<li>One lowercase letter</li>
						<li>One number</li>
						<li>One special character</li>
					</ul>
				</div>
			</div>

			<!-- Confirm Password Field -->
			<div class="space-y-2">
				<label for="confirmPassword" class="block text-sm font-medium">
					Confirm password
				</label>
				<div class="relative">
					<input
						id="confirmPassword"
						name="confirmPassword"
						type={showConfirmPassword ? 'text' : 'password'}
						autocomplete="new-password"
						required
						bind:value={confirmPassword}
						aria-invalid={!!errors.confirmPassword}
						aria-describedby={errors.confirmPassword ? 'confirm-password-error' : undefined}
						disabled={isSubmitting}
						class="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 pr-10 text-sm transition-colors placeholder:text-muted-foreground focus:border-ring focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 {errors.confirmPassword
							? 'border-destructive'
							: ''}"
						placeholder="Confirm your password"
					/>
					<button
						type="button"
						onclick={() => (showConfirmPassword = !showConfirmPassword)}
						class="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-muted-foreground transition-colors hover:text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
						aria-label={showConfirmPassword ? 'Hide password' : 'Show password'}
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

			<!-- Terms and Privacy Checkbox -->
			<div class="flex items-start gap-3">
				<input
					id="acceptTerms"
					name="acceptTerms"
					type="checkbox"
					required
					bind:checked={acceptTerms}
					aria-invalid={!!errors.acceptTerms}
					aria-describedby={errors.acceptTerms ? 'terms-error' : undefined}
					disabled={isSubmitting}
					class="mt-1 h-4 w-4 rounded border-input text-primary transition-colors focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
				/>
				<label for="acceptTerms" class="text-sm">
					I accept the <a href="/legal/terms" class="text-primary underline-offset-4 hover:underline">Terms of Service</a> and <a href="/legal/privacy" class="text-primary underline-offset-4 hover:underline">Privacy Policy</a>
				</label>
			</div>
			{#if errors.acceptTerms}
				<p id="terms-error" class="text-sm text-destructive" role="alert">
					{errors.acceptTerms}
				</p>
			{/if}

			<!-- Submit Button -->
			<button
				type="submit"
				disabled={isSubmitting}
				class="inline-flex h-10 w-full items-center justify-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
			>
				{#if isSubmitting}
					<Loader2 class="h-4 w-4 animate-spin" aria-hidden="true" />
					<span>Creating account...</span>
				{:else}
					<span>Create account</span>
				{/if}
			</button>
		</form>

		<!-- Login Link -->
		<div class="text-center text-sm">
			<span class="text-muted-foreground">Already have an account?</span>
			<a href="/login" class="ml-1 text-primary underline-offset-4 hover:underline">
				Sign in
			</a>
		</div>
	</div>
</div>
