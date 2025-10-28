<script lang="ts">
	import { enhance } from '$app/forms';
	import type { ActionData } from './$types';
	import TwoFactorInput from '$lib/components/forms/TwoFactorInput.svelte';
	import { Eye, EyeOff, Loader2, ArrowLeft, ExternalLink } from 'lucide-svelte';
	import { appStore } from '$lib/stores/app.svelte';
	import {
		DEMO_ACCOUNTS,
		DEMO_PASSWORD,
		DEMO_ACCOUNTS_README_URL
	} from '$lib/constants/demo-accounts';

	interface Props {
		form: ActionData;
	}

	let { form }: Props = $props();

	// Demo mode state
	let isDemoMode = $derived(appStore.isDemoMode);

	// Form state
	let email = $state(form?.email || '');
	let password = $state('');
	let rememberMe = $state(form?.rememberMe || false);
	let showPassword = $state(false);
	let isSubmitting = $state(false);

	// Demo account selection
	let selectedAccountEmail = $state('');

	// 2FA state - derive from form
	let requires2FA = $derived(form?.requires2FA || false);
	let tempToken = $derived(form?.tempToken || '');
	let otpCode = $state('');

	// Error handling - type assertion needed due to ActionData union
	let errors = $derived((form?.errors || {}) as Record<string, string>);

	// Handle demo account selection
	function selectDemoAccount(accountEmail: string) {
		selectedAccountEmail = accountEmail;
		email = accountEmail;
		password = DEMO_PASSWORD;
	}

	// Since requires2FA and tempToken are derived, we navigate to reset the form
	function backToLogin() {
		window.location.href = '/login';
	}
</script>

<svelte:head>
	<title>Sign In - Revel</title>
	<meta name="description" content="Sign in to your Revel account" />
</svelte:head>

<div class="container mx-auto flex min-h-[calc(100vh-4rem)] items-center justify-center px-4 py-8">
	<div class="w-full max-w-md space-y-8">
		<!-- Header -->
		<div class="text-center">
			<h1 class="text-3xl font-bold tracking-tight">
				{requires2FA ? 'Two-factor authentication' : 'Welcome back'}
			</h1>
			<p class="mt-2 text-muted-foreground">
				{requires2FA
					? 'Enter the code from your authenticator app'
					: 'Sign in to your account to continue'}
			</p>
		</div>

		<!-- Error Summary -->
		{#if errors.form}
			<div role="alert" class="rounded-md border border-destructive bg-destructive/10 p-4">
				<p class="text-sm font-medium text-destructive">{errors.form}</p>
			</div>
		{/if}

		{#if !requires2FA}
			{#if isDemoMode}
				<!-- Demo Mode: Account Selector -->
				<div class="space-y-6">
					<div
						class="rounded-md border border-orange-200 bg-orange-50 p-4 dark:border-orange-800 dark:bg-orange-950"
					>
						<p class="text-sm text-orange-900 dark:text-orange-100">
							This is a demo environment. Select a test account below to quickly sign in and explore
							the platform.
						</p>
						<a
							href={DEMO_ACCOUNTS_README_URL}
							target="_blank"
							rel="noopener noreferrer"
							class="mt-2 inline-flex items-center gap-1 text-sm font-medium text-orange-700 underline-offset-4 hover:underline dark:text-orange-300"
						>
							View all test accounts
							<ExternalLink class="h-3 w-3" aria-hidden="true" />
						</a>
					</div>

					<form
						method="POST"
						action="?/login"
						use:enhance={() => {
							// Prevent duplicate submissions
							if (isSubmitting) return;
							isSubmitting = true;

							return async ({ update }) => {
								isSubmitting = false;
								await update();
							};
						}}
						class="space-y-4"
					>
						<!-- Demo Account Selector -->
						<div class="space-y-2">
							<label for="demo-account" class="block text-sm font-medium">
								Select Test Account
							</label>
							<select
								id="demo-account"
								bind:value={selectedAccountEmail}
								onchange={() => selectDemoAccount(selectedAccountEmail)}
								disabled={isSubmitting}
								class="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm transition-colors focus:border-ring focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
							>
								<option value="">-- Choose an account --</option>
								{#each DEMO_ACCOUNTS as account}
									<option value={account.email}>
										{account.name} ({account.role}{account.organization
											? ` - ${account.organization}`
											: ''})
									</option>
								{/each}
							</select>
						</div>

						<!-- Hidden inputs for form submission -->
						<input type="hidden" name="email" value={email} />
						<input type="hidden" name="password" value={password} />
						<input type="hidden" name="rememberMe" value={rememberMe ? 'on' : ''} />

						<!-- Selected Account Info -->
						{#if selectedAccountEmail}
							{@const account = DEMO_ACCOUNTS.find((a) => a.email === selectedAccountEmail)}
							{#if account}
								<div class="rounded-md border border-muted bg-muted/30 p-3">
									<p class="text-sm font-medium">{account.name}</p>
									<p class="mt-1 text-xs text-muted-foreground">{account.email}</p>
									{#if account.description}
										<p class="mt-1 text-xs text-muted-foreground">{account.description}</p>
									{/if}
								</div>
							{/if}
						{/if}

						<!-- Submit Button -->
						<button
							type="submit"
							disabled={isSubmitting || !selectedAccountEmail}
							class="inline-flex h-10 w-full items-center justify-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
						>
							{#if isSubmitting}
								<Loader2 class="h-4 w-4 animate-spin" aria-hidden="true" />
								<span>Signing in...</span>
							{:else}
								<span
									>Sign in as {selectedAccountEmail
										? DEMO_ACCOUNTS.find((a) => a.email === selectedAccountEmail)?.name
										: 'test user'}</span
								>
							{/if}
						</button>
					</form>
				</div>
			{:else}
				<!-- Standard Login Form -->
				<form
					method="POST"
					action="?/login"
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

					<!-- Password Field -->
					<div class="space-y-2">
						<div class="flex items-center justify-between">
							<label for="password" class="block text-sm font-medium"> Password </label>
							<a
								href="/password-reset"
								class="text-sm text-primary underline-offset-4 hover:underline"
							>
								Forgot password?
							</a>
						</div>
						<div class="relative">
							<input
								id="password"
								name="password"
								type={showPassword ? 'text' : 'password'}
								autocomplete="current-password"
								required
								bind:value={password}
								aria-invalid={!!errors.password}
								aria-describedby={errors.password ? 'password-error' : undefined}
								disabled={isSubmitting}
								class="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 pr-10 text-sm transition-colors placeholder:text-muted-foreground focus:border-ring focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 {errors.password
									? 'border-destructive'
									: ''}"
								placeholder="Enter your password"
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
					</div>

					<!-- Remember Me Checkbox -->
					<div class="flex items-center gap-2">
						<input
							id="rememberMe"
							name="rememberMe"
							type="checkbox"
							bind:checked={rememberMe}
							disabled={isSubmitting}
							class="h-4 w-4 rounded border-input text-primary transition-colors focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
						/>
						<label for="rememberMe" class="text-sm"> Remember me for 30 days </label>
					</div>

					<!-- Submit Button -->
					<button
						type="submit"
						disabled={isSubmitting}
						class="inline-flex h-10 w-full items-center justify-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
					>
						{#if isSubmitting}
							<Loader2 class="h-4 w-4 animate-spin" aria-hidden="true" />
							<span>Signing in...</span>
						{:else}
							<span>Sign in</span>
						{/if}
					</button>
				</form>
			{/if}
		{:else}
			<!-- 2FA Verification Form -->
			<form
				method="POST"
				action="?/verify2FA"
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
				<input type="hidden" name="tempToken" value={tempToken} />
				<input type="hidden" name="rememberMe" value={rememberMe ? 'true' : 'false'} />

				<!-- 2FA Code Input -->
				<TwoFactorInput bind:value={otpCode} error={errors.code} disabled={isSubmitting} />

				<!-- Hidden input for form submission -->
				<input type="hidden" name="code" value={otpCode} />

				<!-- Action Buttons -->
				<div class="space-y-3">
					<button
						type="submit"
						disabled={isSubmitting || otpCode.length !== 6}
						class="inline-flex h-10 w-full items-center justify-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
					>
						{#if isSubmitting}
							<Loader2 class="h-4 w-4 animate-spin" aria-hidden="true" />
							<span>Verifying...</span>
						{:else}
							<span>Verify and sign in</span>
						{/if}
					</button>

					<button
						type="button"
						onclick={backToLogin}
						disabled={isSubmitting}
						class="inline-flex h-10 w-full items-center justify-center gap-2 rounded-md border border-input bg-background px-4 py-2 text-sm font-medium transition-colors hover:bg-accent hover:text-accent-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
					>
						<ArrowLeft class="h-4 w-4" aria-hidden="true" />
						<span>Back to login</span>
					</button>
				</div>
			</form>
		{/if}

		<!-- Register Link -->
		{#if !requires2FA}
			<div class="text-center text-sm">
				<span class="text-muted-foreground">Don't have an account?</span>
				<a href="/register" class="ml-1 text-primary underline-offset-4 hover:underline">
					Create account
				</a>
			</div>
		{/if}
	</div>
</div>
