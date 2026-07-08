<script lang="ts">
	import { resolve } from '$app/paths';
	import { page } from '$app/state';
	import { applyAction, enhance } from '$app/forms';
	import type { SubmitFunction } from '@sveltejs/kit';
	import type { ActionData, PageData } from './$types';
	import TwoFactorInput from '$lib/components/forms/TwoFactorInput.svelte';
	import { Eye, EyeOff, Loader2, ArrowLeft, ExternalLink } from '@lucide/svelte';
	import { appStore } from '$lib/stores/app.svelte';
	import {
		DEMO_ACCOUNTS,
		DEMO_PASSWORD,
		DEMO_ACCOUNTS_README_URL
	} from '$lib/constants/demo-accounts';
	import * as m from '$lib/paraglide/messages.js';
	import { SeoHead } from '$lib/seo';

	interface Props {
		data: PageData;
		form: ActionData;
	}

	const { data, form }: Props = $props();

	// Demo mode state
	const isDemoMode = $derived(appStore.isDemoMode);

	// A relative form action ("?/login") replaces the query string, so the
	// returnUrl the server action reads (safeReturnUrl) would be dropped.
	// Thread it through the action URL for every login/2FA submission.
	const returnUrlSuffix = $derived.by(() => {
		const returnUrl = page.url.searchParams.get('returnUrl');
		return returnUrl ? `&returnUrl=${encodeURIComponent(returnUrl)}` : '';
	});

	// Form state
	let email = $state(form?.email || '');
	let password = $state('');
	let rememberMe = $state(form?.rememberMe || false);
	let showPassword = $state(false);
	let isSubmitting = $state(false);

	// Demo account selection
	let selectedAccountEmail = $state('');

	// 2FA state - derive from form
	const requires2FA = $derived(form?.requires2FA || false);
	const tempToken = $derived(form?.tempToken || '');
	let otpCode = $state('');

	// Error handling - type assertion needed due to ActionData union
	const errors = $derived((form?.errors || {}) as Record<string, string>);

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

	// Shared submit handler for the login / demo / 2FA forms.
	//
	// On success the server action issues a redirect (303 → returnUrl). We follow
	// it with a FULL-PAGE navigation (mirroring the logout flow) rather than a
	// client-side one. A client-side redirect does not re-run the root layout's
	// server `load`, so its `auth.hasAccessToken` flag stays `false` and the
	// navbar keeps rendering the logged-out chrome until a manual refresh. A full
	// reload re-runs SSR with the freshly-set auth cookie, so the in-memory auth
	// store bootstraps and the navbar reflects the authenticated session
	// immediately. See #485.
	//
	// Non-redirect results (validation errors, the 2FA-required step) are applied
	// in-place via `applyAction` so the form updates without a reload.
	const handleSubmit: SubmitFunction = () => {
		// Prevent duplicate submissions
		if (isSubmitting) return;
		isSubmitting = true;

		return async ({ result }) => {
			isSubmitting = false;
			if (result.type === 'redirect') {
				window.location.href = result.location;
				return;
			}
			await applyAction(result);
		};
	};
</script>

<SeoHead config={data.seo} />

<div class="container mx-auto flex min-h-[calc(100vh-4rem)] items-center justify-center px-4 py-8">
	<div class="w-full max-w-md space-y-8">
		<!-- Header -->
		<div class="text-center">
			<h1 class="text-3xl font-bold tracking-tight">
				{requires2FA ? m['login.twoFactorAuth']() : m['login.welcomeBack']()}
			</h1>
			<p class="mt-2 text-muted-foreground">
				{requires2FA ? m['login.enterCodeFromApp']() : m['login.signInToContinue']()}
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
							{m['login.demoNotice']()}
						</p>
						<!-- eslint-disable svelte/no-navigation-without-resolve -- external URL (off-site); not an internal route -->
						<a
							href={DEMO_ACCOUNTS_README_URL}
							target="_blank"
							rel="noopener noreferrer"
							class="mt-2 inline-flex items-center gap-1 text-sm font-medium text-orange-700 underline-offset-4 hover:underline dark:text-orange-300"
						>
							{m['login.viewAllTestAccounts']()}
							<ExternalLink class="h-3 w-3" aria-hidden="true" />
						</a>
						<!-- eslint-enable svelte/no-navigation-without-resolve -->
					</div>

					<form
						method="POST"
						action="?/login{returnUrlSuffix}"
						use:enhance={handleSubmit}
						class="space-y-4"
					>
						<!-- Demo Account Selector -->
						<div class="space-y-2">
							<label for="demo-account" class="block text-sm font-medium">
								{m['login.selectTestAccount']()}
							</label>
							<select
								id="demo-account"
								bind:value={selectedAccountEmail}
								onchange={() => selectDemoAccount(selectedAccountEmail)}
								disabled={isSubmitting}
								class="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm transition-colors focus:border-ring focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
							>
								<option value="">{m['login.chooseAccount']()}</option>
								{#each DEMO_ACCOUNTS as account (account.email)}
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
								<span>{m['login.signingIn']()}</span>
							{:else}
								<span
									>{m['login.signInAs']()}
									{selectedAccountEmail
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
					action="?/login{returnUrlSuffix}"
					use:enhance={handleSubmit}
					class="space-y-6"
				>
					<!-- Email Field -->
					<div class="space-y-2">
						<label for="email" class="block text-sm font-medium">
							{m['login.emailAddress']()}
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
							placeholder={m['login.emailPlaceholder']()}
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
							<label for="password" class="block text-sm font-medium">
								{m['login.password']()}
							</label>
							<a
								href={resolve('/(public)/password-reset', {})}
								class="text-sm text-primary underline-offset-4 hover:underline"
							>
								{m['login.forgotPassword']()}
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
								onpaste={() => {
									// Ensure paste always works on mobile
									// This explicit handler prevents any interference from browser autofill
									// that might block paste operations on iOS Safari
								}}
								aria-invalid={!!errors.password}
								aria-describedby={errors.password ? 'password-error' : undefined}
								disabled={isSubmitting}
								class="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 pr-10 text-sm transition-colors placeholder:text-muted-foreground focus:border-ring focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 {errors.password
									? 'border-destructive'
									: ''}"
								placeholder={m['login.passwordPlaceholder']()}
							/>
							<button
								type="button"
								onclick={() => (showPassword = !showPassword)}
								class="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-muted-foreground transition-colors hover:text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
								aria-label={showPassword ? m['login.hidePassword']() : m['login.showPassword']()}
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
						<label for="rememberMe" class="text-sm"> {m['login.rememberMe']()} </label>
					</div>

					<!-- Submit Button -->
					<button
						type="submit"
						disabled={isSubmitting}
						class="inline-flex h-10 w-full items-center justify-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
					>
						{#if isSubmitting}
							<Loader2 class="h-4 w-4 animate-spin" aria-hidden="true" />
							<span>{m['login.signingIn']()}</span>
						{:else}
							<span>{m['login.signIn']()}</span>
						{/if}
					</button>
				</form>
			{/if}
		{:else}
			<!-- 2FA Verification Form -->
			<form
				method="POST"
				action="?/verify2FA{returnUrlSuffix}"
				use:enhance={handleSubmit}
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
							<span>{m['login.verifying']()}</span>
						{:else}
							<span>{m['login.verifyAndSignIn']()}</span>
						{/if}
					</button>

					<button
						type="button"
						onclick={backToLogin}
						disabled={isSubmitting}
						class="inline-flex h-10 w-full items-center justify-center gap-2 rounded-md border border-input bg-background px-4 py-2 text-sm font-medium transition-colors hover:bg-accent hover:text-accent-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
					>
						<ArrowLeft class="h-4 w-4" aria-hidden="true" />
						<span>{m['login.backToLogin']()}</span>
					</button>
				</div>
			</form>
		{/if}

		<!-- Register Link -->
		{#if !requires2FA}
			<div class="text-center text-sm">
				<span class="text-muted-foreground">{m['login.dontHaveAccount']()}</span>
				<a
					href={resolve('/(public)/register', {})}
					class="ml-1 text-primary underline-offset-4 hover:underline"
				>
					{m['login.createAccount']()}
				</a>
			</div>
		{/if}
	</div>
</div>
