<script lang="ts">
	import * as m from '$lib/paraglide/messages.js';
	import { setLocale } from '$lib/paraglide/runtime.js';
	import { enhance, applyAction } from '$app/forms';
	import type { PageData, ActionData } from './$types';
	import { COMMON_PRONOUNS } from '$lib/schemas/profile';
	import { Loader2, Check, Info, ShieldCheck, ShieldAlert, Mail } from 'lucide-svelte';
	import DietaryPreferencesManager from '$lib/components/profile/DietaryPreferencesManager.svelte';
	import DietaryRestrictionsManager from '$lib/components/profile/DietaryRestrictionsManager.svelte';
	import TelegramConnectionManager from '$lib/components/profile/TelegramConnectionManager.svelte';
	import ProfilePictureUploader from '$lib/components/profile/ProfilePictureUploader.svelte';
	import MarkdownEditor from '$lib/components/forms/MarkdownEditor.svelte';
	import { accountResendVerificationEmail } from '$lib/api/generated';

	interface Props {
		data: PageData;
		form: ActionData;
	}

	let { data, form }: Props = $props();

	let isSubmitting = $state(false);
	let manuallyShowingCustom = $state(false);
	let isResendingVerification = $state(false);
	let verificationEmailSent = $state(false);
	let verificationError = $state<string | null>(null);
	let resendCooldown = $state(0);
	let cooldownInterval: ReturnType<typeof setInterval> | null = null;

	// Form state - initialize from data.user on page load
	let firstName = $state(data.user?.first_name || '');
	let lastName = $state(data.user?.last_name || '');
	let preferredName = $state(data.user?.preferred_name || '');
	let pronouns = $state(data.user?.pronouns || '');
	let language = $state<'en' | 'de' | 'it'>((data.user?.language as 'en' | 'de' | 'it') || 'en');
	let bio = $state(data.user?.bio || '');
	let profilePictureUrl = $state<string | null>(data.user?.profile_picture_url ?? null);

	// Check if current pronouns is custom (not in common list)
	let showCustomPronouns = $derived(
		manuallyShowingCustom ||
			(pronouns !== '' &&
				!COMMON_PRONOUNS.slice(0, -1).includes(pronouns as (typeof COMMON_PRONOUNS)[number]))
	);

	let success = $derived(form?.success || false);
	let errors = $derived((form?.errors || {}) as Record<string, string>);
	// Email comes from data.user (populated by load function)
	let email = $derived(data.user?.email || '');
	let emailVerified = $derived(data.user?.email_verified || false);
	let canResendEmail = $derived(!isResendingVerification && resendCooldown === 0);

	function startCooldown() {
		resendCooldown = 60; // 60 second cooldown
		cooldownInterval = setInterval(() => {
			resendCooldown--;
			if (resendCooldown <= 0) {
				if (cooldownInterval) {
					clearInterval(cooldownInterval);
					cooldownInterval = null;
				}
			}
		}, 1000);
	}

	async function handleResendVerification() {
		if (!email || !canResendEmail) return;

		isResendingVerification = true;
		verificationEmailSent = false;
		verificationError = null;

		try {
			await accountResendVerificationEmail({
				body: { email }
			});
			verificationEmailSent = true;
			startCooldown();
		} catch (error: any) {
			console.error('Failed to resend verification email:', error);

			// Handle 429 Too Many Requests
			if (error?.status === 429 || error?.response?.status === 429) {
				verificationError = m['profile.email_rateLimitError']();
				// Start cooldown even on rate limit to prevent immediate retry
				startCooldown();
			} else {
				verificationError = m['profile.email_resendError']();
			}
		} finally {
			isResendingVerification = false;
		}
	}

	// Cleanup interval on component destroy
	$effect(() => {
		return () => {
			if (cooldownInterval) {
				clearInterval(cooldownInterval);
			}
		};
	});
</script>

<svelte:head>
	<title>Profile - Revel</title>
	<meta name="description" content="Manage your Revel profile" />
</svelte:head>

<div class="container mx-auto max-w-2xl px-4 py-8">
	<div class="mb-8">
		<h1 class="text-3xl font-bold tracking-tight">Profile</h1>
		<p class="mt-2 text-muted-foreground">Manage your personal information</p>
	</div>

	{#if success}
		<div
			role="status"
			class="mb-6 rounded-md border border-green-500 bg-green-50 p-4 dark:bg-green-950"
		>
			<div class="flex items-center gap-2">
				<Check class="h-5 w-5 text-green-600 dark:text-green-400" aria-hidden="true" />
				<p class="text-sm font-medium text-green-800 dark:text-green-200">
					Profile updated successfully
				</p>
			</div>
		</div>
	{/if}

	{#if errors.form}
		<div role="alert" class="mb-6 rounded-md border border-destructive bg-destructive/10 p-4">
			<p class="text-sm font-medium text-destructive">{errors.form}</p>
		</div>
	{/if}

	<!-- Profile Picture Section -->
	{#if data.accessToken && data.user}
		<div class="mb-8">
			<ProfilePictureUploader
				currentPictureUrl={profilePictureUrl}
				displayName={data.user.display_name}
				firstName={data.user.first_name}
				lastName={data.user.last_name}
				accessToken={data.accessToken}
				onUpdate={(newUrl) => {
					profilePictureUrl = newUrl;
				}}
			/>
		</div>
	{/if}

	<form
		method="POST"
		action="?/updateProfile"
		use:enhance={() => {
			if (isSubmitting) return;
			isSubmitting = true;
			return async ({ result }) => {
				isSubmitting = false;
				// Don't call update() - it clears the form prop
				// Instead, manually update the form fields from the result
				if (result.type === 'success' && result.data?.user) {
					console.log('[Enhance] Got success result with user:', result.data.user);
					const user = result.data.user as typeof data.user;
					firstName = user?.first_name || '';
					lastName = user?.last_name || '';
					preferredName = user?.preferred_name || '';
					pronouns = user?.pronouns || '';
					language = (user?.language || 'en') as 'en' | 'de' | 'it';
					bio = user?.bio || '';
					profilePictureUrl = user?.profile_picture_url ?? null;
					// Update locale immediately on successful save
					if (user?.language) {
						setLocale(user.language as 'en' | 'de' | 'it');
					}
					// Show success message by triggering a manual update with the result
					// This will set the form prop without reloading
					await applyAction(result);
				} else if (result.type === 'failure') {
					// On validation errors, apply the result to show errors
					await applyAction(result);
				}
			};
		}}
		class="space-y-6"
	>
		<div class="space-y-2">
			<label for="email" class="block text-sm font-medium">{m['profile.email_label']()}</label>
			<div class="space-y-3">
				<div class="flex items-center gap-2">
					<input
						id="email"
						type="email"
						value={email}
						disabled
						class="flex h-10 w-full cursor-not-allowed rounded-md border border-input bg-muted px-3 py-2 text-sm text-muted-foreground"
					/>
					{#if emailVerified}
						<div
							class="flex items-center gap-1.5 rounded-md bg-green-100 px-3 py-1.5 dark:bg-green-950"
							role="status"
							aria-label={m['profile.email_verified_label']()}
						>
							<ShieldCheck
								class="h-4 w-4 flex-shrink-0 text-green-700 dark:text-green-400"
								aria-hidden="true"
							/>
							<span class="text-xs font-medium text-green-800 dark:text-green-300">
								{m['profile.email_verified']()}
							</span>
						</div>
					{:else}
						<div
							class="flex items-center gap-1.5 rounded-md bg-amber-100 px-3 py-1.5 dark:bg-amber-950"
							role="status"
							aria-label={m['profile.email_unverified_label']()}
						>
							<ShieldAlert
								class="h-4 w-4 flex-shrink-0 text-amber-700 dark:text-amber-400"
								aria-hidden="true"
							/>
							<span class="text-xs font-medium text-amber-800 dark:text-amber-300">
								{m['profile.email_unverified']()}
							</span>
						</div>
					{/if}
				</div>

				{#if !emailVerified}
					<div
						class="rounded-md border border-amber-200 bg-amber-50 p-3 dark:border-amber-900 dark:bg-amber-950"
					>
						<p class="mb-2 text-sm text-amber-900 dark:text-amber-200">
							{m['profile.email_verificationNeeded']()}
						</p>
						<button
							type="button"
							onclick={handleResendVerification}
							disabled={!canResendEmail}
							class="inline-flex h-9 items-center justify-center gap-2 rounded-md bg-amber-600 px-3 py-2 text-sm font-medium text-white transition-colors hover:bg-amber-700 focus:outline-none focus:ring-2 focus:ring-amber-500 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-amber-700 dark:hover:bg-amber-600"
						>
							{#if isResendingVerification}
								<Loader2 class="h-4 w-4 animate-spin" aria-hidden="true" />
								<span>{m['profile.email_resending']()}</span>
							{:else if resendCooldown > 0}
								<Mail class="h-4 w-4" aria-hidden="true" />
								<span>{m['profile.email_resendWait']({ seconds: resendCooldown })}</span>
							{:else}
								<Mail class="h-4 w-4" aria-hidden="true" />
								<span>{m['profile.email_resendButton']()}</span>
							{/if}
						</button>
					</div>
				{/if}

				{#if verificationEmailSent}
					<div
						role="status"
						class="space-y-2 rounded-md border border-green-500 bg-green-50 p-3 dark:bg-green-950"
					>
						<div class="flex items-center gap-2">
							<Check class="h-5 w-5 text-green-600 dark:text-green-400" aria-hidden="true" />
							<p class="text-sm font-medium text-green-800 dark:text-green-200">
								{m['profile.email_resendSuccess']()}
							</p>
						</div>
						<p class="text-sm text-green-700 dark:text-green-300">
							{m['profile.email_checkSpam']()}
						</p>
					</div>
				{/if}

				{#if verificationError}
					<div role="alert" class="rounded-md border border-red-500 bg-red-50 p-3 dark:bg-red-950">
						<p class="text-sm font-medium text-red-800 dark:text-red-200">
							{verificationError}
						</p>
					</div>
				{/if}

				<p class="text-xs text-muted-foreground">{m['profile.email_hint']()}</p>
			</div>
		</div>

		<div class="grid gap-6 sm:grid-cols-2">
			<div class="space-y-2">
				<label for="first_name" class="block text-sm font-medium">First Name</label>
				<input
					id="first_name"
					name="first_name"
					type="text"
					required
					bind:value={firstName}
					aria-invalid={!!errors.first_name}
					aria-describedby={errors.first_name ? 'first-name-error' : undefined}
					disabled={isSubmitting}
					class="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm transition-colors placeholder:text-muted-foreground focus:border-ring focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 {errors.first_name
						? 'border-destructive'
						: ''}"
				/>
				{#if errors.first_name}
					<p id="first-name-error" class="text-sm text-destructive" role="alert">
						{errors.first_name}
					</p>
				{/if}
			</div>

			<div class="space-y-2">
				<label for="last_name" class="block text-sm font-medium">Last Name</label>
				<input
					id="last_name"
					name="last_name"
					type="text"
					required
					bind:value={lastName}
					aria-invalid={!!errors.last_name}
					aria-describedby={errors.last_name ? 'last-name-error' : undefined}
					disabled={isSubmitting}
					class="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm transition-colors placeholder:text-muted-foreground focus:border-ring focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 {errors.last_name
						? 'border-destructive'
						: ''}"
				/>
				{#if errors.last_name}
					<p id="last-name-error" class="text-sm text-destructive" role="alert">
						{errors.last_name}
					</p>
				{/if}
			</div>
		</div>

		<div class="space-y-2">
			<label for="preferred_name" class="block text-sm font-medium">
				Preferred Name
				<span class="text-xs font-normal text-muted-foreground">(optional)</span>
			</label>
			<input
				id="preferred_name"
				name="preferred_name"
				type="text"
				bind:value={preferredName}
				aria-invalid={!!errors.preferred_name}
				aria-describedby={errors.preferred_name ? 'preferred-name-error' : undefined}
				disabled={isSubmitting}
				class="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm transition-colors placeholder:text-muted-foreground focus:border-ring focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 {errors.preferred_name
					? 'border-destructive'
					: ''}"
				placeholder="What should we call you?"
			/>
			<p class="text-xs text-muted-foreground">
				This is how you'll appear throughout Revel. Defaults to your first name if not set.
			</p>
			{#if errors.preferred_name}
				<p id="preferred-name-error" class="text-sm text-destructive" role="alert">
					{errors.preferred_name}
				</p>
			{/if}
		</div>

		<div class="space-y-2">
			<label for="pronouns-select" class="block text-sm font-medium">Pronouns</label>
			{#if showCustomPronouns}
				<div class="space-y-2">
					<input
						id="pronouns"
						name="pronouns"
						type="text"
						required
						bind:value={pronouns}
						aria-invalid={!!errors.pronouns}
						aria-describedby={errors.pronouns ? 'pronouns-error' : undefined}
						disabled={isSubmitting}
						maxlength="10"
						class="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm transition-colors placeholder:text-muted-foreground focus:border-ring focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 {errors.pronouns
							? 'border-destructive'
							: ''}"
						placeholder="e.g., ze/zir"
					/>
					<button
						type="button"
						onclick={() => {
							manuallyShowingCustom = false;
							pronouns = 'they/them';
						}}
						class="text-sm text-primary underline-offset-4 hover:underline"
					>
						Choose from common options
					</button>
				</div>
			{:else}
				<select
					id="pronouns-select"
					bind:value={pronouns}
					onchange={(e) => {
						const val = (e.target as HTMLSelectElement).value;
						if (val === 'custom') {
							manuallyShowingCustom = true;
							pronouns = '';
						}
					}}
					disabled={isSubmitting}
					class="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm transition-colors focus:border-ring focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
				>
					{#each COMMON_PRONOUNS as option (option)}
						<option value={option === 'custom' ? 'custom' : option}>
							{option === 'custom' ? 'Custom...' : option}
						</option>
					{/each}
				</select>
				<input type="hidden" name="pronouns" value={pronouns} />
			{/if}
			{#if errors.pronouns}
				<p id="pronouns-error" class="text-sm text-destructive" role="alert">{errors.pronouns}</p>
			{/if}
		</div>

		<div class="space-y-2">
			<label for="language" class="block text-sm font-medium">{m['profile.language_label']()}</label
			>
			<select
				id="language"
				name="language"
				bind:value={language}
				disabled={isSubmitting}
				class="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm transition-colors focus:border-ring focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
			>
				<option value="en">{m['profile.language_en']()}</option>
				<option value="de">{m['profile.language_de']()}</option>
				<option value="it">{m['profile.language_it']()}</option>
			</select>
			<p class="text-xs text-muted-foreground">{m['profile.language_hint']()}</p>
			{#if errors.language}
				<p id="language-error" class="text-sm text-destructive" role="alert">{errors.language}</p>
			{/if}
		</div>

		<!-- Bio Field -->
		<div class="space-y-2">
			<MarkdownEditor
				bind:value={bio}
				id="bio"
				label={m['profilePage.bio_label']()}
				placeholder={m['profilePage.bio_placeholder']()}
				rows={4}
				disabled={isSubmitting}
				error={errors.bio}
			/>
			<input type="hidden" name="bio" value={bio} />
			<p class="text-xs text-muted-foreground">
				{m['profilePage.bio_hint']()}
			</p>
		</div>

		<div class="flex gap-4">
			<button
				type="submit"
				disabled={isSubmitting}
				class="inline-flex h-10 items-center justify-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
			>
				{#if isSubmitting}
					<Loader2 class="h-4 w-4 animate-spin" aria-hidden="true" />
					<span>{m['profile.buttons_submittingText']()}</span>
				{:else}
					<span>{m['profile.buttons_submitText']()}</span>
				{/if}
			</button>
		</div>
	</form>

	<!-- Dietary Preferences & Restrictions Section -->
	{#if data.accessToken}
		<div class="mt-12 space-y-6" id="dietary-section">
			<div class="border-t pt-8">
				<div class="mb-6">
					<h2 class="text-2xl font-bold tracking-tight">{m['dietary.profile_heading']()}</h2>
					<p class="mt-2 text-sm text-muted-foreground">
						{m['dietary.profile_description']()}
					</p>

					<!-- Visibility Info -->
					<div
						class="mt-4 flex gap-2 rounded-md border border-blue-200 bg-blue-50 p-3 dark:border-blue-900 dark:bg-blue-950"
					>
						<Info
							class="h-5 w-5 flex-shrink-0 text-blue-600 dark:text-blue-400"
							aria-hidden="true"
						/>
						<p class="text-sm text-blue-800 dark:text-blue-200">
							{m['dietary.profile_visibilityInfo']()}
						</p>
					</div>
				</div>

				<div class="space-y-8">
					<DietaryPreferencesManager authToken={data.accessToken} />
					<DietaryRestrictionsManager authToken={data.accessToken} />
				</div>
			</div>
		</div>

		<!-- Telegram Connection Section -->
		<div class="mt-12" id="telegram-section">
			<div class="border-t pt-8">
				<TelegramConnectionManager authToken={data.accessToken} />
			</div>
		</div>
	{/if}

	<!-- Settings Link -->
	<div class="mt-8 border-t pt-6">
		<a
			href="/account/settings"
			class="inline-flex items-center gap-2 text-sm text-primary underline-offset-4 hover:underline"
		>
			<span>Configure privacy, notifications and location</span>
			<span aria-hidden="true">→</span>
		</a>
	</div>
</div>
