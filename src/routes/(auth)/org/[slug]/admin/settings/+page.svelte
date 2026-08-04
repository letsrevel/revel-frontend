<script lang="ts">
	import { resolve } from '$app/paths';
	import * as m from '$lib/paraglide/messages.js';
	import { enhance } from '$app/forms';
	import { page } from '$app/stores';
	import type { PageData, ActionData } from './$types';
	import CityAutocomplete from '$lib/components/forms/CityAutocomplete.svelte';
	import MarkdownEditor from '$lib/components/forms/MarkdownEditor.svelte';
	import OrgImageUploader from '$lib/components/organization/OrgImageUploader.svelte';
	import OrgTagManager from '$lib/components/organization/OrgTagManager.svelte';
	import OrgContactEmailModal from '$lib/components/organization/OrgContactEmailModal.svelte';
	import StripeConnect from '$lib/components/organization/StripeConnect.svelte';
	import OrgSubscriptionPolicySection from '$lib/components/organization/OrgSubscriptionPolicySection.svelte';
	import type { CitySchema, RevenueReportCadence } from '$lib/api/generated';
	import { Building2, AlertCircle, Check, Eye, Mail, Send, AtSign } from '@lucide/svelte';
	import Instagram from '$lib/components/icons/brand/Instagram.svelte';
	import Facebook from '$lib/components/icons/brand/Facebook.svelte';
	import { authStore } from '$lib/stores/auth.svelte';
	import { toast } from 'svelte-sonner';
	import PageHeader from '$lib/components/common/PageHeader.svelte';
	import SectionHeader from '$lib/components/common/SectionHeader.svelte';
	import StatusBadge from '$lib/components/common/StatusBadge.svelte';
	import { Button } from '$lib/components/ui/button';

	interface Props {
		data: PageData;
		form: ActionData;
	}

	const { data, form }: Props = $props();

	const accessToken = $derived(authStore.accessToken);
	const features = $derived($page.data.features);

	// Form state - always sync with latest data
	let description = $state(data.organization.description || '');
	let address = $state(data.organization.address || '');
	let selectedCity = $state<CitySchema | null>(data.organization.city || null);
	let visibility = $state(data.organization.visibility || 'public');
	let acceptNewMembers = $state(data.organization.accept_membership_requests || false);
	let contactMethod = $state<'none' | 'email' | 'form'>(data.organization.contact_method || 'none');
	let reportCadence = $state<RevenueReportCadence>(
		data.organization.revenue_report_cadence || 'none'
	);
	// Membership policy defaults. Same rule as the subscription-policy section: these
	// always render and always post, so the action's formData.has() guards can pin
	// payload inclusion to controls that were really rendered (the #491 class).
	let defaultQuestionnaireId = $state(data.organization.default_membership_questionnaire_id || '');
	let defaultRequiresApproval = $state(
		data.organization.default_requires_membership_approval ?? false
	);
	let isSubmitting = $state(false);

	// Scheduled revenue-report delivery requires a billing email to send to.
	const billingEmailMissing = $derived(!data.organization.billing_email?.trim());

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
		contactMethod = data.organization.contact_method || 'none';
		reportCadence = data.organization.revenue_report_cadence || 'none';
		defaultQuestionnaireId = data.organization.default_membership_questionnaire_id || '';
		defaultRequiresApproval = data.organization.default_requires_membership_approval ?? false;
		instagramUrl = data.organization.instagram_url || '';
		facebookUrl = data.organization.facebook_url || '';
		blueskyUrl = data.organization.bluesky_url || '';
		telegramUrl = data.organization.telegram_url || '';
	});

	// If selected method requires a verified email but it isn't, force back to 'none' on submit.
	const contactEmailVerified = $derived(data.organization.contact_email_verified === true);
	const canEnableContact = $derived(contactEmailVerified);

	// Show toast notification on form errors
	$effect(() => {
		if (form?.errors && 'form' in form.errors) {
			toast.error(m['orgSettingsPage.toast_saveFailed'](), {
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
	{#snippet publicProfileAction()}
		<Button
			href={resolve('/(public)/org/[slug]', { slug: data.organization.slug })}
			target="_blank"
			rel="noopener noreferrer"
			variant="secondary"
			class="gap-2"
		>
			<Eye class="h-4 w-4" aria-hidden="true" />
			{m['orgAdmin.settings.viewPublicProfile']()}
		</Button>
	{/snippet}
	<PageHeader
		title={m['orgAdmin.settings.pageTitle']()}
		subtitle={m['orgAdmin.settings.pageDescription']()}
		actions={publicProfileAction}
	/>

	<!-- Success Message -->
	{#if form?.success}
		<div
			class="flex items-center gap-2 rounded-lg border border-success/40 bg-success/10 p-4 text-foreground"
			role="alert"
		>
			<Check class="h-5 w-5 shrink-0 text-success" aria-hidden="true" />
			<p class="text-sm font-medium">{m['orgAdmin.settings.successMessage']()}</p>
		</div>
	{/if}

	<!-- Error Message -->
	{#if form?.errors && 'form' in form.errors}
		<!-- Icon carries the tone, not the body text: dark --destructive as TEXT on
		     this composite measures ~2.7-2.95:1 (fails both the 3:1 non-text and
		     4.5:1 text floors). -->
		<div
			class="flex items-center gap-2 rounded-lg border border-destructive/50 bg-destructive/10 p-4 text-foreground"
			role="alert"
		>
			<AlertCircle class="h-5 w-5 shrink-0 text-destructive" aria-hidden="true" />
			<p class="text-sm font-medium">{form.errors.form}</p>
		</div>
	{/if}

	<!-- Organization Identity (Read-only) -->
	<section class="rounded-lg border border-border bg-card p-6 shadow-sm">
		<div class="mb-4 flex items-center gap-2">
			<Building2 class="h-5 w-5 shrink-0 text-muted-foreground" aria-hidden="true" />
			<SectionHeader title={m['orgAdmin.settings.identity.heading']()} class="flex-1" />
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
			<Building2 class="h-5 w-5 shrink-0 text-muted-foreground" aria-hidden="true" />
			<SectionHeader title={m['orgAdmin.settings.platformFees.heading']()} class="flex-1" />
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
			!data.organization.billing_address?.trim() ||
			!data.organization.billing_name?.trim()}
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
			<SectionHeader title={m['orgAdmin.settings.profile.heading']()} />

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
					class="mt-1 flex w-full rounded-md border-2 border-input bg-background px-3 py-2 text-sm text-foreground transition-colors placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2"
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
					class="mt-1 flex w-full rounded-md border-2 border-input bg-background px-3 py-2 text-sm text-foreground transition-colors focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2"
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
			<SectionHeader title={m['orgAdmin.settings.social.heading']()} />
			<p class="text-sm text-muted-foreground">{m['orgAdmin.settings.social.description']()}</p>

			<div class="grid gap-4 md:grid-cols-2">
				<!-- Instagram -->
				<div>
					<label for="instagram_url" class="flex items-center gap-2 text-sm font-medium">
						<Instagram class="h-4 w-4 text-[hsl(var(--brand-instagram))]" aria-hidden="true" />
						Instagram
					</label>
					<input
						type="url"
						id="instagram_url"
						name="instagram_url"
						bind:value={instagramUrl}
						placeholder="https://instagram.com/yourorg"
						class="mt-1 flex w-full rounded-md border-2 border-input bg-background px-3 py-2 text-sm text-foreground transition-colors placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2"
					/>
				</div>

				<!-- Facebook -->
				<div>
					<label for="facebook_url" class="flex items-center gap-2 text-sm font-medium">
						<Facebook class="h-4 w-4 text-[hsl(var(--brand-facebook))]" aria-hidden="true" />
						Facebook
					</label>
					<input
						type="url"
						id="facebook_url"
						name="facebook_url"
						bind:value={facebookUrl}
						placeholder="https://facebook.com/yourorg"
						class="mt-1 flex w-full rounded-md border-2 border-input bg-background px-3 py-2 text-sm text-foreground transition-colors placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2"
					/>
				</div>

				<!-- Bluesky -->
				<div>
					<label for="bluesky_url" class="flex items-center gap-2 text-sm font-medium">
						<AtSign class="h-4 w-4 text-[hsl(var(--brand-bluesky))]" aria-hidden="true" />
						Bluesky
					</label>
					<input
						type="url"
						id="bluesky_url"
						name="bluesky_url"
						bind:value={blueskyUrl}
						placeholder="https://bsky.app/profile/yourorg.bsky.social"
						class="mt-1 flex w-full rounded-md border-2 border-input bg-background px-3 py-2 text-sm text-foreground transition-colors placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2"
					/>
				</div>

				<!-- Telegram -->
				{#if features.telegram}
					<div>
						<label for="telegram_url" class="flex items-center gap-2 text-sm font-medium">
							<Send class="h-4 w-4 text-[hsl(var(--brand-telegram-text))]" aria-hidden="true" />
							Telegram
						</label>
						<input
							type="url"
							id="telegram_url"
							name="telegram_url"
							bind:value={telegramUrl}
							placeholder="https://t.me/yourorg"
							class="mt-1 flex w-full rounded-md border-2 border-input bg-background px-3 py-2 text-sm text-foreground transition-colors placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2"
						/>
					</div>
				{/if}
			</div>
		</section>

		<!-- Membership Settings -->
		<section class="space-y-4 rounded-lg border border-border bg-card p-6 shadow-sm">
			<SectionHeader title={m['orgAdmin.settings.membership.heading']()} />

			<!-- Accept New Members -->
			<div class="space-y-2">
				<div class="flex items-center gap-2">
					<input
						type="checkbox"
						id="accept_membership_requests"
						name="accept_membership_requests"
						value="true"
						bind:checked={acceptNewMembers}
						class="h-4 w-4 rounded border-input text-primary focus:ring-2 focus:ring-primary focus:ring-offset-2"
					/>
					<label for="accept_membership_requests" class="text-sm font-medium">
						{m['orgAdmin.settings.membership.acceptRequestsLabel']()}
					</label>
				</div>
				<p class="text-xs text-muted-foreground">
					{m['orgAdmin.settings.membership.acceptRequestsHelp']()}
				</p>
			</div>

			<!-- Default membership questionnaire -->
			<div>
				<label for="default_membership_questionnaire_id" class="block text-sm font-medium">
					{m['orgAdmin.settings.membership.defaultQuestionnaireLabel']()}
				</label>
				<select
					id="default_membership_questionnaire_id"
					name="default_membership_questionnaire_id"
					bind:value={defaultQuestionnaireId}
					class="mt-1 flex w-full rounded-md border-2 border-input bg-background px-3 py-2 text-sm text-foreground transition-colors focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 sm:max-w-xs"
				>
					<option value="">{m['orgAdmin.settings.membership.defaultQuestionnaireNone']()}</option>
					{#each data.membershipQuestionnaires as oq (oq.id)}
						<option value={oq.id}>{oq.questionnaire.name}</option>
					{/each}
				</select>
				<p class="mt-1 text-xs text-muted-foreground">
					{m['orgAdmin.settings.membership.defaultQuestionnaireHelp']()}
				</p>
				{#if data.membershipQuestionnaires.length === 0}
					<p class="mt-1 text-xs text-muted-foreground">
						{m['orgAdmin.settings.membership.noMembershipQuestionnaires']()}
						<a
							href={resolve('/(auth)/org/[slug]/admin/questionnaires', {
								slug: data.organization.slug
							})}
							class="font-medium underline underline-offset-2"
						>
							{m['orgAdmin.settings.membership.manageQuestionnairesLink']()}
						</a>
					</p>
				{/if}
			</div>

			<!-- Require manual approval by default -->
			<div class="space-y-2">
				<div class="flex items-center gap-2">
					<input type="hidden" name="default_requires_membership_approval_present" value="1" />
					<input
						type="checkbox"
						id="default_requires_membership_approval"
						name="default_requires_membership_approval"
						value="true"
						bind:checked={defaultRequiresApproval}
						class="h-4 w-4 rounded border-input text-primary focus:ring-2 focus:ring-primary focus:ring-offset-2"
					/>
					<label for="default_requires_membership_approval" class="text-sm font-medium">
						{m['orgAdmin.settings.membership.requireApprovalLabel']()}
					</label>
				</div>
				<p class="text-xs text-muted-foreground">
					{m['orgAdmin.settings.membership.requireApprovalHelp']()}
				</p>
			</div>

			<!-- Contact Email (Read-only with Change Button) -->
			<div>
				<span class="block text-sm font-medium">
					{m['orgAdmin.settings.membership.contactEmailLabel']()}
				</span>
				<div class="mt-1 flex items-center gap-2">
					<div class="flex-1 rounded-md border-2 border-input bg-muted px-3 py-2 text-sm">
						{data.organization.contact_email || m['orgSettingsPage.noContactEmail']()}
					</div>
					<button
						type="button"
						onclick={() => {
							showEmailModal = true;
						}}
						class="inline-flex items-center gap-1 rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2"
					>
						<Mail class="h-4 w-4" aria-hidden="true" />
						{m['orgSettingsPage.changeButton']()}
					</button>
				</div>
				{#if data.organization.contact_email_verified}
					<!-- No icon: the label copy already carries its own "✓" glyph. -->
					<StatusBadge
						tone="success"
						label={m['orgAdmin.settings.membership.emailVerified']()}
						aria-label={m['orgAdmin.settings.membership.emailVerified']()}
						size="sm"
						class="mt-1"
					/>
				{:else if data.organization.contact_email}
					<StatusBadge
						tone="warning"
						icon={AlertCircle}
						label={m['orgAdmin.settings.membership.emailNotVerified']()}
						aria-label={m['orgAdmin.settings.membership.emailNotVerified']()}
						size="sm"
						class="mt-1"
					/>
				{/if}
				<p class="mt-1 text-xs text-muted-foreground">
					{m['orgAdmin.settings.membership.contactEmailHelp']()}
				</p>
			</div>

			<!-- Contact Method -->
			<div>
				<label for="contact_method" class="block text-sm font-medium">
					{m['orgAdmin.settings.membership.contactMethodLabel']()}
				</label>
				<select
					id="contact_method"
					name="contact_method"
					bind:value={contactMethod}
					class="mt-1 flex w-full rounded-md border-2 border-input bg-background px-3 py-2 text-sm text-foreground transition-colors focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 sm:max-w-xs"
				>
					<option value="none">
						{m['orgAdmin.settings.membership.contactMethodNone']()}
					</option>
					<option value="email" disabled={!canEnableContact}>
						{m['orgAdmin.settings.membership.contactMethodEmail']()}
					</option>
					<option value="form" disabled={!canEnableContact}>
						{m['orgAdmin.settings.membership.contactMethodForm']()}
					</option>
				</select>
				<p class="mt-1 text-xs text-muted-foreground">
					{#if contactMethod === 'none'}
						{m['orgAdmin.settings.membership.contactMethodNoneHelp']()}
					{:else if contactMethod === 'email'}
						{m['orgAdmin.settings.membership.contactMethodEmailHelp']()}
					{:else if contactMethod === 'form'}
						{m['orgAdmin.settings.membership.contactMethodFormHelp']()}
					{/if}
				</p>

				{#if !canEnableContact}
					<div
						class="mt-2 flex items-start gap-2 rounded-md border border-highlight/40 bg-highlight/20 p-3 text-xs text-highlight-foreground dark:text-highlight"
						role="note"
					>
						<AlertCircle class="h-4 w-4 shrink-0" aria-hidden="true" />
						<span>{m['orgAdmin.settings.membership.contactMethodVerifyHint']()}</span>
					</div>
				{/if}
			</div>
		</section>

		<!-- Subscription policy — rules for paid memberships. Its fields always render and
		     always post; the action includes each one only when it actually arrived (the
		     component explains why). -->
		<OrgSubscriptionPolicySection organization={data.organization} />

		<!-- Financial Reports (owner-only — mirrors the owner-only financials/revenue
		     endpoints; staff with edit_organization must not change report delivery) -->
		{#if data.isOwner}
			<section class="space-y-4 rounded-lg border border-border bg-card p-6 shadow-sm">
				<SectionHeader title={m['orgSettingsPage.reports.heading']()} />
				<p class="text-sm text-muted-foreground">{m['orgSettingsPage.reports.description']()}</p>

				<div>
					<label for="revenue_report_cadence" class="block text-sm font-medium">
						{m['orgSettingsPage.reports.cadenceLabel']()}
					</label>
					<!-- A non-`none` cadence requires a billing email (backend 422s otherwise).
					     When it is missing we display + submit `none` (disabled), so the control
					     honestly reflects that scheduled delivery is off — no silent surprise on
					     the next save. The select carries the field `name` so the value posts
					     natively (no JS needed); the hidden `none` is only rendered when the
					     select is disabled, so the two never collide. -->
					{#if billingEmailMissing}
						<input type="hidden" name="revenue_report_cadence" value="none" />
					{/if}
					<select
						id="revenue_report_cadence"
						name="revenue_report_cadence"
						value={billingEmailMissing ? 'none' : reportCadence}
						onchange={(e) => (reportCadence = e.currentTarget.value as RevenueReportCadence)}
						disabled={billingEmailMissing}
						class="mt-1 flex w-full rounded-md border-2 border-input bg-background px-3 py-2 text-sm text-foreground transition-colors focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60 sm:max-w-xs"
					>
						<option value="none">{m['orgSettingsPage.reports.cadenceNone']()}</option>
						<option value="quarterly">{m['orgSettingsPage.reports.cadenceQuarterly']()}</option>
						<option value="monthly">{m['orgSettingsPage.reports.cadenceMonthly']()}</option>
					</select>
					<p class="mt-1 text-xs text-muted-foreground">
						{m['orgSettingsPage.reports.cadenceHelp']()}
					</p>

					{#if billingEmailMissing}
						<div
							class="mt-2 flex items-start gap-2 rounded-md border border-highlight/40 bg-highlight/20 p-3 text-xs text-highlight-foreground dark:text-highlight"
							role="note"
						>
							<AlertCircle class="h-4 w-4 shrink-0" aria-hidden="true" />
							<span>
								{m['orgSettingsPage.reports.billingEmailRequired']()}
								<a
									href={resolve('/(auth)/org/[slug]/admin/billing', {
										slug: data.organization.slug
									})}
									class="font-medium underline underline-offset-2"
								>
									{m['orgSettingsPage.reports.billingEmailLink']()}
								</a>
							</span>
						</div>
					{/if}
				</div>
			</section>
		{/if}

		<!-- Actions -->
		<div class="flex items-center justify-end gap-3">
			<a
				href={resolve('/(auth)/org/[slug]/admin', { slug: data.organization.slug })}
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
	currentContactMethod={data.organization.contact_method}
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
