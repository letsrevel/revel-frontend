<script lang="ts">
	import { enhance } from '$app/forms';
	import type { ActionData } from './$types';
	import PasswordStrengthIndicator from '$lib/components/forms/PasswordStrengthIndicator.svelte';
	import { Eye, EyeOff, Loader2 } from 'lucide-svelte';
	import * as m from '$lib/paraglide/messages.js';

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
	let isPasswordValid = $state(false);

	// Error handling - type assertion needed due to ActionData union
	let errors = $derived((form?.errors || {}) as Record<string, string>);
	let hasErrors = $derived(errors && Object.keys(errors).length > 0);

	// Check if form is valid for submission
	let canSubmit = $derived(
		email.length > 0 &&
			password.length > 0 &&
			isPasswordValid &&
			confirmPassword === password &&
			acceptTerms &&
			!isSubmitting
	);
</script>

<svelte:head>
	<title>{m['register.title']()}</title>
	<meta name="description" content={m['register.metaDescription']()} />
</svelte:head>

<div class="container mx-auto flex min-h-[calc(100vh-4rem)] items-center justify-center px-4 py-8">
	<div class="w-full max-w-md space-y-8">
		<!-- Header -->
		<div class="text-center">
			<h1 class="text-3xl font-bold tracking-tight">{m['register.createAccount']()}</h1>
			<p class="mt-2 text-muted-foreground">{m['register.joinRevel']()}</p>
		</div>

		<!-- Error Summary -->
		{#if hasErrors && errors.form}
			<div role="alert" class="rounded-md border border-destructive bg-destructive/10 p-4">
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
					{m['register.emailAddress']()}
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
					placeholder={m['register.emailPlaceholder']()}
				/>
				{#if errors.email}
					<p id="email-error" class="text-sm text-destructive" role="alert">
						{errors.email}
					</p>
				{/if}
			</div>

			<!-- Password Field -->
			<div class="space-y-2">
				<label for="password" class="block text-sm font-medium"> {m['register.password']()} </label>
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
						aria-describedby={errors.password
							? 'password-error password-requirements'
							: 'password-requirements'}
						disabled={isSubmitting}
						class="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 pr-10 text-sm transition-colors placeholder:text-muted-foreground focus:border-ring focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 {errors.password
							? 'border-destructive'
							: ''}"
						placeholder={m['register.passwordPlaceholder']()}
					/>
					<button
						type="button"
						onclick={() => (showPassword = !showPassword)}
						class="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-muted-foreground transition-colors hover:text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
						aria-label={showPassword ? m['register.hidePassword']() : m['register.showPassword']()}
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

				<!-- Password Strength Indicator with Requirements -->
				{#if password}
					<PasswordStrengthIndicator
						{password}
						showRequirements={true}
						bind:isValid={isPasswordValid}
					/>
				{/if}
			</div>

			<!-- Confirm Password Field -->
			<div class="space-y-2">
				<label for="confirmPassword" class="block text-sm font-medium">
					{m['register.confirmPassword']()}
				</label>
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
						placeholder={m['register.confirmPasswordPlaceholder']()}
					/>
					<button
						type="button"
						onclick={() => (showConfirmPassword = !showConfirmPassword)}
						class="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-muted-foreground transition-colors hover:text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
						aria-label={showConfirmPassword
							? m['register.hidePassword']()
							: m['register.showPassword']()}
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
					{m['register.acceptTerms']()}
					<a
						href="/legal/terms"
						target="_blank"
						rel="noopener noreferrer"
						class="text-primary underline-offset-4 hover:underline"
						>{m['footer.termsOfService']()}</a
					>
					{m['register.and']()}
					<a
						href="/legal/privacy"
						target="_blank"
						rel="noopener noreferrer"
						class="text-primary underline-offset-4 hover:underline">{m['footer.privacyPolicy']()}</a
					>
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
				disabled={!canSubmit}
				aria-disabled={!canSubmit}
				class="inline-flex h-10 w-full items-center justify-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
			>
				{#if isSubmitting}
					<Loader2 class="h-4 w-4 animate-spin" aria-hidden="true" />
					<span>{m['register.creatingAccount']()}</span>
				{:else}
					<span>{m['register.createAccount']()}</span>
				{/if}
			</button>
		</form>

		<!-- Login Link -->
		<div class="text-center text-sm">
			<span class="text-muted-foreground">{m['register.alreadyHaveAccount']()}</span>
			<a href="/login" class="ml-1 text-primary underline-offset-4 hover:underline">
				{m['auth.login']()}
			</a>
		</div>
	</div>
</div>
