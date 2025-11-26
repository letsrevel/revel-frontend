<script lang="ts">
	import { goto } from '$app/navigation';
	import { enhance, applyAction } from '$app/forms';
	import { authStore } from '$lib/stores/auth.svelte';
	import { Button } from '$lib/components/ui/button';
	import { Input } from '$lib/components/ui/input';
	import { Label } from '$lib/components/ui/label';
	import { Textarea } from '$lib/components/ui/textarea';
	import CityAutocomplete from '$lib/components/forms/CityAutocomplete.svelte';
	import { AlertCircle, Building2, CheckCircle, Loader2, Mail } from 'lucide-svelte';
	import * as m from '$lib/paraglide/messages.js';
	import type { PageData, ActionData } from './$types';
	import type { CitySchema } from '$lib/api/generated';

	interface Props {
		data: PageData;
		form: ActionData;
	}

	let { data, form }: Props = $props();

	let user = $derived(authStore.user); // Use authStore.user for full user object with email_verified
	let permissions = $derived(authStore.permissions);

	// Check if user already owns an organization
	let ownsOrganization = $derived.by(() => {
		if (!permissions?.organization_permissions) return false;
		return Object.values(permissions.organization_permissions).some((perms) => perms === 'owner');
	});

	// Form state - initialize with server data as fallback
	let name = $state('');
	let contactEmail = $state(data.user?.email || ''); // Start with server data
	let selectedCity = $state<CitySchema | null>(null);
	let address = $state('');
	let description = $state('');

	// Track the original email reactively (use authStore if available, else server data)
	let originalEmail = $derived(user?.email || data.user?.email || '');

	// Update contact email when authStore loads (if not already set)
	$effect(() => {
		if (user?.email && contactEmail !== user.email && !contactEmail) {
			contactEmail = user.email;
		}
	});

	// Track if user has changed the contact email from default
	let contactEmailChanged = $derived(contactEmail !== originalEmail);

	// Form state
	let isSubmitting = $state(false);
	let showConfirmDialog = $state(false);
	let formElement = $state<HTMLFormElement>();

	let errors = $derived((form?.errors || {}) as Record<string, string>);

	function showConfirmation(e: Event) {
		e.preventDefault();
		showConfirmDialog = true;
	}

	function confirmCreate() {
		showConfirmDialog = false;
		if (formElement) {
			formElement.requestSubmit();
		}
	}

	function cancelConfirm() {
		showConfirmDialog = false;
	}

	function handleCitySelect(city: CitySchema | null) {
		selectedCity = city;
	}
</script>

<svelte:head>
	<title>{m['orgCreate.pageTitle']()} | Revel</title>
	<meta name="description" content={m['orgCreate.pageDescription']()} />
	<meta name="robots" content="noindex, nofollow" />
</svelte:head>

<div class="container mx-auto max-w-2xl px-4 py-8">
	<!-- Header -->
	<div class="mb-8 text-center">
		<div class="mb-4 flex justify-center">
			<div class="rounded-full bg-primary/10 p-4">
				<Building2 class="h-8 w-8 text-primary" aria-hidden="true" />
			</div>
		</div>
		<h1 class="mb-2 text-3xl font-bold">{m['orgCreate.title']()}</h1>
		<p class="text-muted-foreground">
			{m['orgCreate.subtitle']()}
		</p>
		<p class="mt-2 text-sm text-muted-foreground">
			You'll be able to add more details, upload images, and customize your organization in the
			settings page after creation.
		</p>
	</div>

	<!-- Check if user already owns an organization -->
	{#if ownsOrganization}
		<div
			class="rounded-lg border border-yellow-200 bg-yellow-50 p-6 dark:border-yellow-900 dark:bg-yellow-950"
		>
			<div class="flex gap-3">
				<AlertCircle
					class="h-5 w-5 flex-shrink-0 text-yellow-600 dark:text-yellow-400"
					aria-hidden="true"
				/>
				<div>
					<h3 class="font-semibold text-yellow-900 dark:text-yellow-100">
						{m['orgCreate.alreadyOwner']()}
					</h3>
					<p class="mt-1 text-sm text-yellow-800 dark:text-yellow-200">
						{m['orgCreate.alreadyOwnerDescription']()}
					</p>
					<div class="mt-4">
						<a
							href="/dashboard"
							class="inline-flex items-center gap-2 rounded-md bg-yellow-600 px-4 py-2 text-sm font-medium text-white hover:bg-yellow-700 dark:bg-yellow-700 dark:hover:bg-yellow-600"
						>
							{m['orgCreate.backToDashboard']()}
						</a>
					</div>
				</div>
			</div>
		</div>
	{:else if !user?.email_verified}
		<!-- Email not verified warning -->
		<div class="rounded-lg border border-red-200 bg-red-50 p-6 dark:border-red-900 dark:bg-red-950">
			<div class="flex gap-3">
				<AlertCircle
					class="h-5 w-5 flex-shrink-0 text-red-600 dark:text-red-400"
					aria-hidden="true"
				/>
				<div>
					<h3 class="font-semibold text-red-900 dark:text-red-100">
						{m['orgCreate.emailNotVerified']()}
					</h3>
					<p class="mt-1 text-sm text-red-800 dark:text-red-200">
						{m['orgCreate.emailNotVerifiedDescription']()}
					</p>
					<div class="mt-4">
						<a
							href="/account/profile"
							class="inline-flex items-center gap-2 rounded-md bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 dark:bg-red-700 dark:hover:bg-red-600"
						>
							{m['orgCreate.verifyEmail']()}
						</a>
					</div>
				</div>
			</div>
		</div>
	{:else}
		<!-- Creation Form -->
		<div class="rounded-lg border bg-card p-6 shadow-sm md:p-8">
			<form
				bind:this={formElement}
				method="POST"
				use:enhance={() => {
					isSubmitting = true;
					return async ({ result }) => {
						isSubmitting = false;
						await applyAction(result);
					};
				}}
				class="space-y-6"
			>
				<!-- Organization Name -->
				<div class="space-y-2">
					<Label for="name" class="required">
						{m['orgCreate.form.name']()}
					</Label>
					<Input
						id="name"
						name="name"
						type="text"
						bind:value={name}
						aria-invalid={errors.name ? 'true' : undefined}
						aria-describedby={errors.name ? 'name-error' : undefined}
						placeholder={m['orgCreate.form.namePlaceholder']()}
						maxlength={150}
						required
					/>
					{#if errors.name}
						<p id="name-error" class="text-sm text-destructive">
							{errors.name}
						</p>
					{/if}
					<p class="text-xs text-muted-foreground">
						{m['orgCreate.form.nameHint']()}
					</p>
				</div>

				<!-- Contact Email -->
				<div class="space-y-2">
					<Label for="contact_email" class="required">
						{m['orgCreate.form.contactEmail']()}
					</Label>
					<Input
						id="contact_email"
						name="contact_email"
						type="email"
						bind:value={contactEmail}
						aria-invalid={errors.contact_email ? 'true' : undefined}
						aria-describedby={errors.contact_email
							? 'contact-email-error contact-email-hint'
							: 'contact-email-hint'}
						placeholder={m['orgCreate.form.contactEmailPlaceholder']()}
						required
					/>
					{#if errors.contact_email}
						<p id="contact-email-error" class="text-sm text-destructive">
							{errors.contact_email}
						</p>
					{/if}

					<!-- Info about email verification -->
					{#if contactEmailChanged}
						<div class="flex gap-2 rounded-md bg-blue-50 p-3 dark:bg-blue-950">
							<Mail
								class="h-4 w-4 flex-shrink-0 text-blue-600 dark:text-blue-400"
								aria-hidden="true"
							/>
							<p id="contact-email-hint" class="text-xs text-blue-800 dark:text-blue-200">
								{m['orgCreate.form.contactEmailVerificationNeeded']()}
							</p>
						</div>
					{:else}
						<div class="flex gap-2 rounded-md bg-green-50 p-3 dark:bg-green-950">
							<CheckCircle
								class="h-4 w-4 flex-shrink-0 text-green-600 dark:text-green-400"
								aria-hidden="true"
							/>
							<p id="contact-email-hint" class="text-xs text-green-800 dark:text-green-200">
								{m['orgCreate.form.contactEmailAutoVerified']()}
							</p>
						</div>
					{/if}
				</div>

				<!-- City -->
				<div>
					<CityAutocomplete
						value={selectedCity}
						onSelect={handleCitySelect}
						label={m['orgCreate.form.city']()}
						description=""
					/>
					<input type="hidden" name="city_id" value={selectedCity?.id || ''} />
				</div>

				<!-- Address -->
				<div class="space-y-2">
					<Label for="address">
						{m['orgCreate.form.address']()}
					</Label>
					<Input
						id="address"
						name="address"
						type="text"
						bind:value={address}
						aria-invalid={errors.address ? 'true' : undefined}
						aria-describedby={errors.address ? 'address-error' : undefined}
						placeholder={m['orgCreate.form.addressPlaceholder']()}
					/>
					{#if errors.address}
						<p id="address-error" class="text-sm text-destructive">
							{errors.address}
						</p>
					{/if}
				</div>

				<!-- Description -->
				<div class="space-y-2">
					<Label for="description">
						{m['orgCreate.form.description']()}
					</Label>
					<Textarea
						id="description"
						name="description"
						bind:value={description}
						aria-invalid={errors.description ? 'true' : undefined}
						aria-describedby={errors.description ? 'description-error' : undefined}
						placeholder={m['orgCreate.form.descriptionPlaceholder']()}
						rows={4}
					/>
					{#if errors.description}
						<p id="description-error" class="text-sm text-destructive">
							{errors.description}
						</p>
					{/if}
					<p class="text-xs text-muted-foreground">
						{m['orgCreate.form.descriptionHint']()}
					</p>
				</div>

				<!-- Submit Error -->
				{#if errors.form}
					<div class="rounded-md border border-destructive/50 bg-destructive/10 p-4">
						<div class="flex gap-3">
							<AlertCircle class="h-5 w-5 flex-shrink-0 text-destructive" aria-hidden="true" />
							<div>
								<h3 class="font-medium text-destructive">
									{m['orgCreate.form.error']()}
								</h3>
								<p class="mt-1 text-sm text-destructive/90">
									{errors.form}
								</p>
							</div>
						</div>
					</div>
				{/if}

				<!-- Actions -->
				<div class="flex gap-3 border-t pt-6">
					<Button
						type="button"
						variant="outline"
						onclick={() => goto('/dashboard')}
						disabled={isSubmitting}
						class="flex-1"
					>
						{m['common.actions_cancel']()}
					</Button>
					<Button type="button" onclick={showConfirmation} disabled={isSubmitting} class="flex-1">
						{#if isSubmitting}
							<Loader2 class="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />
							{m['orgCreate.form.creating']()}
						{:else}
							<Building2 class="mr-2 h-4 w-4" aria-hidden="true" />
							{m['orgCreate.form.create']()}
						{/if}
					</Button>
				</div>
			</form>
		</div>
	{/if}
</div>

<!-- Confirmation Dialog -->
{#if showConfirmDialog}
	<div class="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
		<div class="w-full max-w-md rounded-lg border bg-card p-6 shadow-xl">
			<div class="mb-4 flex justify-center">
				<div class="rounded-full bg-yellow-100 p-3 dark:bg-yellow-900">
					<AlertCircle class="h-6 w-6 text-yellow-600 dark:text-yellow-400" aria-hidden="true" />
				</div>
			</div>
			<h3 class="mb-2 text-center text-lg font-semibold">
				{m['orgCreate.confirm.title']()}
			</h3>
			<p class="mb-1 text-center text-sm text-muted-foreground">
				{m['orgCreate.confirm.message']()}
			</p>
			<p class="mb-6 text-center text-sm font-medium">
				<strong>"{name}"</strong>
			</p>
			<p class="mb-6 text-center text-sm text-destructive">
				{m['orgCreate.confirm.warning']()}
			</p>
			<div class="flex gap-3">
				<Button type="button" variant="outline" onclick={cancelConfirm} class="flex-1">
					{m['common.actions_cancel']()}
				</Button>
				<Button type="button" onclick={confirmCreate} class="flex-1">
					{m['orgCreate.confirm.create']()}
				</Button>
			</div>
		</div>
	</div>
{/if}

<style>
	:global(.required::after) {
		content: ' *';
		color: hsl(var(--destructive));
	}
</style>
