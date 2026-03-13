<script lang="ts">
	import * as m from '$lib/paraglide/messages.js';
	import { enhance } from '$app/forms';
	import type { PageData, ActionData } from './$types';
	import CityAutocomplete from '$lib/components/forms/CityAutocomplete.svelte';
	import MarkdownEditor from '$lib/components/forms/MarkdownEditor.svelte';
	import OrgImageUploader from '$lib/components/organization/OrgImageUploader.svelte';
	import OrgTagManager from '$lib/components/organization/OrgTagManager.svelte';
	import OrgContactEmailModal from '$lib/components/organization/OrgContactEmailModal.svelte';
	import StripeConnect from '$lib/components/organization/StripeConnect.svelte';
	import type { CitySchema } from '$lib/api/generated';
	import {
		Building2,
		AlertCircle,
		Check,
		Eye,
		Mail,
		Instagram,
		Facebook,
		Send,
		AtSign
	} from 'lucide-svelte';
	import { authStore } from '$lib/stores/auth.svelte';
	import { toast } from 'svelte-sonner';

	interface Props {
		data: PageData;
		form: ActionData;
	}

	let { data, form }: Props = $props();

	const accessToken = $derived(authStore.accessToken);

	// Form state - always sync with latest data
	let description = $state(data.organization.description || '');
	let address = $state(data.organization.address || '');
	let selectedCity = $state<CitySchema | null>(data.organization.city || null);
	let visibility = $state(data.organization.visibility || 'public');
	let acceptNewMembers = $state(data.organization.accept_membership_requests || false);
	let isSubmitting = $state(false);

	// Social media state
	let instagramUrl = $state(data.organization.instagram_url || '');
	let facebookUrl = $state(data.organization.facebook_url || '');
	let blueskyUrl = $state(data.organization.bluesky_url || '');
	let telegramUrl = $state(data.organization.telegram_url || '');

	// Email modal state
	let showEmailModal = $state(false);

	// Registered save callbacks from child components
	let saveImageChanges: (() => Promise<void>) | null = $state(null);
	let saveTagChanges: (() => Promise<void>) | null = $state(null);

	// Sync form state when data changes (after submission)
	$effect(() => {
		description = data.organization.description || '';
		address = data.organization.address || '';
		selectedCity = data.organization.city || null;
		visibility = data.organization.visibility || 'public';
		acceptNewMembers = data.organization.accept_membership_requests || false;
		instagramUrl = data.organization.instagram_url || '';
		facebookUrl = data.organization.facebook_url || '';
		blueskyUrl = data.organization.bluesky_url || '';
		telegramUrl = data.organization.telegram_url || '';
	});

	// Show toast notification on form errors
	$effect(() => {
		if (form?.errors && 'form' in form.errors) {
			toast.error('Failed to save settings', {
				description: form.errors.form
			});
		}
	});

	// Handle city selection
	function handleCitySelect(city: CitySchema | null) {
		selectedCity = city;
	}

	// Process all child component changes when form is submitted
	async function processChildChanges() {
		await saveImageChanges?.();
		await saveTagChanges?.();
	}
</script>

<svelte:head>
	<title>{m['orgAdmin.settings.pageTitle']()} - {data.organization.name} Admin | Revel</title>
	<meta name="description" content={m['orgAdmin.settings.metaDescription']()} />
	<meta name="robots" content="noindex, nofollow" />
</svelte:head>

<div class="space-y-6 px-4 md:px-0">
	<!-- Header with Public Profile Button -->
	<div class="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
		<div>
			<h1 class="text-2xl font-bold tracking-tight md:text-3xl">
				{m['orgAdmin.settings.pageTitle']()}
			</h1>
			<p class="mt-1 text-sm text-muted-foreground">
				{m['orgAdmin.settings.pageDescription']()}
			</p>
		</div>

		<a
			href="/org/{data.organization.slug}"
			target="_blank"
			rel="noopener noreferrer"
			class="inline-flex items-center gap-2 rounded-md bg-secondary px-4 py-2 text-sm font-medium text-secondary-foreground transition-colors hover:bg-secondary/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
		>
			<Eye class="h-4 w-4" aria-hidden="true" />
			{m['orgAdmin.settings.viewPublicProfile']()}
		</a>
	</div>

	<!-- Success Message -->
	{#if form?.success}
		<div
			class="flex items-center gap-2 rounded-lg border border-green-200 bg-green-50 p-4 text-green-800 dark:border-green-800 dark:bg-green-950 dark:text-green-100"
			role="alert"
		>
			<Check class="h-5 w-5 shrink-0" aria-hidden="true" />
			<p class="text-sm font-medium">{m['orgAdmin.settings.successMessage']()}</p>
		</div>
	{/if}

	<!-- Error Message -->
	{#if form?.errors && 'form' in form.errors}
		<div
			class="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 p-4 text-red-800 dark:border-red-800 dark:bg-red-950 dark:text-red-100"
			role="alert"
		>
			<AlertCircle class="h-5 w-5 shrink-0" aria-hidden="true" />
			<p class="text-sm font-medium">{form.errors.form}</p>
		</div>
	{/if}

	<!-- Organization Identity (Read-only) -->
	<section class="rounded-lg border border-border bg-card p-6 shadow-sm">
		<div class="mb-4 flex items-center gap-2">
			<Building2 class="h-5 w-5 text-muted-foreground" aria-hidden="true" />
			<h2 class="text-lg font-semibold">{m['orgAdmin.settings.identity.heading']()}</h2>
		</div>

		<div class="grid gap-4 md:grid-cols-2">
			<!-- Name (Read-only) -->
			<div>
				<div class="block text-sm font-medium text-muted-foreground">
					{m['orgAdmin.settings.identity.orgNameLabel']()}
				</div>
				<div class="mt-1 rounded-md border border-border bg-muted px-3 py-2 text-sm">
					{data.organization.name}
				</div>
				<p class="mt-1 text-xs text-muted-foreground">
					{m['orgAdmin.settings.identity.orgNameHelp']()}
				</p>
			</div>

			<!-- Slug (Read-only) -->
			<div>
				<div class="block text-sm font-medium text-muted-foreground">
					{m['orgAdmin.settings.identity.urlSlugLabel']()}
				</div>
				<div class="mt-1 rounded-md border border-border bg-muted px-3 py-2 font-mono text-sm">
					{data.organization.slug}
				</div>
				<p class="mt-1 text-xs text-muted-foreground">
					{m['orgAdmin.settings.identity.urlSlugHelp']()}
				</p>
			</div>
		</div>
	</section>

	<!-- Platform Fees (Read-only) -->
	<section class="rounded-lg border border-border bg-card p-6 shadow-sm">
		<div class="mb-4 flex items-center gap-2">
			<Building2 class="h-5 w-5 text-muted-foreground" aria-hidden="true" />
			<h2 class="text-lg font-semibold">{m['orgAdmin.settings.platformFees.heading']()}</h2>
		</div>

		<div class="grid gap-4 md:grid-cols-2">
			<!-- Platform Fee Percent -->
			<div>
				<div class="block text-sm font-medium text-muted-foreground">
					{m['orgAdmin.settings.platformFees.percentLabel']()}
				</div>
				<div class="mt-1 rounded-md border border-border bg-muted px-3 py-2 text-sm">
					{data.organization.platform_fee_percent}%
				</div>
				<p class="mt-1 text-xs text-muted-foreground">
					{m['orgAdmin.settings.platformFees.percentHelp']()}
				</p>
			</div>

			<!-- Platform Fee Fixed -->
			<div>
				<div class="block text-sm font-medium text-muted-foreground">
					{m['orgAdmin.settings.platformFees.fixedLabel']()}
				</div>
				<div class="mt-1 rounded-md border border-border bg-muted px-3 py-2 text-sm">
					€{data.organization.platform_fee_fixed}
				</div>
				<p class="mt-1 text-xs text-muted-foreground">
					{m['orgAdmin.settings.platformFees.fixedHelp']()}
				</p>
			</div>
		</div>

		<p class="mt-4 text-xs text-muted-foreground">
			{m['orgAdmin.settings.platformFees.contactSupport']()}
		</p>
	</section>

	<!-- Stripe Connect Section -->
	<StripeConnect
		organizationSlug={data.organization.slug}
		stripeChargesEnabled={data.organization.stripe_charges_enabled}
		stripeDetailsSubmitted={data.organization.stripe_details_submitted}
		stripeAccountId={data.organization.stripe_account_id ?? null}
		stripeAccountEmail={data.organization.stripe_account_email ?? null}
		accessToken={accessToken || ''}
		billingInfoMissing={!data.organization.vat_country_code ||
			!data.organization.billing_address?.trim()}
	/>

	<!-- Images Section (Outside Form) -->
	<OrgImageUploader
		slug={data.organization.slug}
		logoPath={data.organization.logo}
		coverArtPath={data.organization.cover_art}
		{accessToken}
		onRegisterSave={(fn) => (saveImageChanges = fn)}
	/>

	<form
		method="POST"
		use:enhance={() => {
			isSubmitting = true;
			return async ({ update }) => {
				// Process image and tag changes
				await processChildChanges();

				// Submit form data (description, address, city, visibility)
				await update();
				isSubmitting = false;
			};
		}}
		class="space-y-8"
	>
		<!-- Profile Information -->
		<section class="space-y-4 rounded-lg border border-border bg-card p-6 shadow-sm">
			<h2 class="text-lg font-semibold">{m['orgAdmin.settings.profile.heading']()}</h2>

			<!-- Description -->
			<div>
				<MarkdownEditor
					bind:value={description}
					label={m['orgAdmin.settings.profile.descriptionLabel']()}
					placeholder={m['orgAdmin.settings.profile.descriptionPlaceholder']()}
					rows={8}
				/>
				<input type="hidden" name="description" value={description} />
			</div>

			<!-- City -->
			<div>
				<CityAutocomplete
					value={selectedCity}
					onSelect={handleCitySelect}
					label={m['orgAdmin.settings.profile.cityLabel']()}
					description=""
				/>
				<input type="hidden" name="city_id" value={selectedCity?.id || ''} />
			</div>

			<!-- Address -->
			<div>
				<label for="address" class="block text-sm font-medium">
					{m['orgAdmin.settings.profile.addressLabel']()}
					<span class="text-muted-foreground"
						>{m['orgAdmin.settings.profile.addressOptional']()}</span
					>
				</label>
				<input
					type="text"
					id="address"
					name="address"
					bind:value={address}
					placeholder={m['orgAdmin.settings.profile.addressPlaceholder']()}
					class="mt-1 flex w-full rounded-md border-2 border-gray-300 bg-white px-3 py-2 text-sm transition-colors placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
				/>
			</div>

			<!-- Visibility -->
			<div>
				<label for="visibility" class="block text-sm font-medium"
					>{m['orgAdmin.settings.profile.visibilityLabel']()}</label
				>
				<select
					id="visibility"
					name="visibility"
					bind:value={visibility}
					class="mt-1 flex w-full rounded-md border-2 border-gray-300 bg-white px-3 py-2 text-sm transition-colors focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
				>
					<option value="public">{m['orgAdmin.settings.profile.visibilityPublic']()}</option>
					<option value="members-only"
						>{m['orgAdmin.settings.profile.visibilityMembersOnly']()}</option
					>
					<option value="staff-only">{m['orgAdmin.settings.profile.visibilityStaffOnly']()}</option>
				</select>
				<p class="mt-1 text-xs text-muted-foreground">
					{#if visibility === 'public'}
						{m['orgAdmin.settings.profile.visibilityPublicHelp']()}
					{:else if visibility === 'members-only'}
						{m['orgAdmin.settings.profile.visibilityMembersOnlyHelp']()}
					{:else if visibility === 'staff-only'}
						{m['orgAdmin.settings.profile.visibilityStaffOnlyHelp']()}
					{/if}
				</p>
			</div>

			<!-- Tags -->
			<OrgTagManager
				slug={data.organization.slug}
				{accessToken}
				initialTags={data.organization.tags || []}
				onRegisterSave={(fn) => (saveTagChanges = fn)}
			/>
		</section>

		<!-- Social Media Links -->
		<section class="space-y-4 rounded-lg border border-border bg-card p-6 shadow-sm">
			<h2 class="text-lg font-semibold">{m['orgAdmin.settings.social.heading']()}</h2>
			<p class="text-sm text-muted-foreground">{m['orgAdmin.settings.social.description']()}</p>

			<div class="grid gap-4 md:grid-cols-2">
				<!-- Instagram -->
				<div>
					<label for="instagram_url" class="flex items-center gap-2 text-sm font-medium">
						<Instagram class="h-4 w-4 text-pink-500" aria-hidden="true" />
						Instagram
					</label>
					<input
						type="url"
						id="instagram_url"
						name="instagram_url"
						bind:value={instagramUrl}
						placeholder="https://instagram.com/yourorg"
						class="mt-1 flex w-full rounded-md border-2 border-gray-300 bg-white px-3 py-2 text-sm transition-colors placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
					/>
				</div>

				<!-- Facebook -->
				<div>
					<label for="facebook_url" class="flex items-center gap-2 text-sm font-medium">
						<Facebook class="h-4 w-4 text-blue-600" aria-hidden="true" />
						Facebook
					</label>
					<input
						type="url"
						id="facebook_url"
						name="facebook_url"
						bind:value={facebookUrl}
						placeholder="https://facebook.com/yourorg"
						class="mt-1 flex w-full rounded-md border-2 border-gray-300 bg-white px-3 py-2 text-sm transition-colors placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
					/>
				</div>

				<!-- Bluesky -->
				<div>
					<label for="bluesky_url" class="flex items-center gap-2 text-sm font-medium">
						<AtSign class="h-4 w-4 text-sky-500" aria-hidden="true" />
						Bluesky
					</label>
					<input
						type="url"
						id="bluesky_url"
						name="bluesky_url"
						bind:value={blueskyUrl}
						placeholder="https://bsky.app/profile/yourorg.bsky.social"
						class="mt-1 flex w-full rounded-md border-2 border-gray-300 bg-white px-3 py-2 text-sm transition-colors placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
					/>
				</div>

				<!-- Telegram -->
				<div>
					<label for="telegram_url" class="flex items-center gap-2 text-sm font-medium">
						<Send class="h-4 w-4 text-blue-400" aria-hidden="true" />
						Telegram
					</label>
					<input
						type="url"
						id="telegram_url"
						name="telegram_url"
						bind:value={telegramUrl}
						placeholder="https://t.me/yourorg"
						class="mt-1 flex w-full rounded-md border-2 border-gray-300 bg-white px-3 py-2 text-sm transition-colors placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
					/>
				</div>
			</div>
		</section>

		<!-- Membership Settings -->
		<section class="space-y-4 rounded-lg border border-border bg-card p-6 shadow-sm">
			<h2 class="text-lg font-semibold">{m['orgAdmin.settings.membership.heading']()}</h2>

			<!-- Accept New Members -->
			<div class="space-y-2">
				<div class="flex items-center gap-2">
					<input
						type="checkbox"
						id="accept_membership_requests"
						name="accept_membership_requests"
						value="true"
						bind:checked={acceptNewMembers}
						class="h-4 w-4 rounded border-gray-300 text-primary focus:ring-2 focus:ring-primary focus:ring-offset-2"
					/>
					<label for="accept_membership_requests" class="text-sm font-medium">
						{m['orgAdmin.settings.membership.acceptRequestsLabel']()}
					</label>
				</div>
				<p class="text-xs text-muted-foreground">
					{m['orgAdmin.settings.membership.acceptRequestsHelp']()}
				</p>
			</div>

			<!-- Contact Email (Read-only with Change Button) -->
			<div>
				<label class="block text-sm font-medium">
					{m['orgAdmin.settings.membership.contactEmailLabel']()}
				</label>
				<div class="mt-1 flex items-center gap-2">
					<div
						class="flex-1 rounded-md border-2 border-gray-300 bg-gray-50 px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-900"
					>
						{data.organization.contact_email || 'No contact email set'}
					</div>
					<button
						type="button"
						onclick={() => {
							showEmailModal = true;
						}}
						class="inline-flex items-center gap-1 rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2"
					>
						<Mail class="h-4 w-4" aria-hidden="true" />
						Change
					</button>
				</div>
				{#if data.organization.contact_email_verified}
					<p class="mt-1 flex items-center gap-1 text-xs text-green-600 dark:text-green-400">
						<Check class="h-3 w-3" aria-hidden="true" />
						{m['orgAdmin.settings.membership.emailVerified']()}
					</p>
				{:else if data.organization.contact_email}
					<p class="mt-1 flex items-center gap-1 text-xs text-orange-600 dark:text-orange-400">
						<AlertCircle class="h-3 w-3" aria-hidden="true" />
						{m['orgAdmin.settings.membership.emailNotVerified']()}
					</p>
				{/if}
				<p class="mt-1 text-xs text-muted-foreground">
					{m['orgAdmin.settings.membership.contactEmailHelp']()}
				</p>
			</div>
		</section>

		<!-- Actions -->
		<div class="flex items-center justify-end gap-3">
			<a
				href="/org/{data.organization.slug}/admin"
				class="rounded-md border border-border px-4 py-2 text-sm font-medium transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
			>
				{m['orgAdmin.settings.actions.cancel']()}
			</a>
			<button
				type="submit"
				disabled={isSubmitting}
				class="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
			>
				{#if isSubmitting}
					<div
						class="h-4 w-4 animate-spin rounded-full border-2 border-primary-foreground border-t-transparent"
						aria-hidden="true"
					></div>
					{m['orgAdmin.settings.actions.saving']()}
				{:else}
					{m['orgAdmin.settings.actions.saveChanges']()}
				{/if}
			</button>
		</div>
	</form>
</div>

<!-- Email Change Modal -->
<OrgContactEmailModal
	slug={data.organization.slug}
	{accessToken}
	currentEmail={data.organization.contact_email || ''}
	bind:open={showEmailModal}
	onClose={() => (showEmailModal = false)}
/>

<style>
	/* Ensure consistent focus states for accessibility */
	:global(button:focus-visible),
	:global(a:focus-visible) {
		outline: 2px solid hsl(var(--ring));
		outline-offset: 2px;
	}
</style>
