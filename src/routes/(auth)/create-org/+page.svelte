<script lang="ts">
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { enhance, applyAction } from '$app/forms';
	import { authStore } from '$lib/stores/auth.svelte';
	import { Button } from '$lib/components/ui/button';
	import { Input } from '$lib/components/ui/input';
	import { Label } from '$lib/components/ui/label';
	import { Textarea } from '$lib/components/ui/textarea';
	import CityAutocomplete from '$lib/components/forms/CityAutocomplete.svelte';
	import PageHeader from '$lib/components/common/PageHeader.svelte';
	import { AlertCircle, Building2, CheckCircle, Loader2, Mail } from '@lucide/svelte';
	import * as m from '$lib/paraglide/messages.js';
	import type { PageData, ActionData } from './$types';
	import type { CitySchema } from '$lib/api/generated';

	interface Props {
		data: PageData;
		form: ActionData;
	}

	const { data, form }: Props = $props();

	const user = $derived(authStore.user); // Use authStore.user for full user object with email_verified
	const permissions = $derived(authStore.permissions);

	// Check if user already owns an organization
	const ownsOrganization = $derived.by(() => {
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
	const originalEmail = $derived(user?.email || data.user?.email || '');

	// Update contact email when authStore loads (if not already set)
	$effect(() => {
		if (user?.email && contactEmail !== user.email && !contactEmail) {
			contactEmail = user.email;
		}
	});

	// Track if user has changed the contact email from default
	const contactEmailChanged = $derived(contactEmail !== originalEmail);

	// Form state
	let isSubmitting = $state(false);
	let showConfirmDialog = $state(false);
	let formElement = $state<HTMLFormElement>();

	const errors = $derived((form?.errors || {}) as Record<string, string>);

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

<!-- The one Celebration moment in this cluster: creating an organization is an
     acquisition milestone, so it gets the uplift's full welcome band while the
     wizard body below stays studio-calm. `bg-secondary` at full strength is an
     audit-enforced pair in BOTH modes (so the band respects the light/dark
     axis) and the kicker/subtitle inherit it through PageHeader's `onBand`
     affordance — the default `text-primary` kicker measures 4.12:1 there,
     below AA. The old `bg-primary/10` circle becomes the poster-tinted tilted
     chip (EmptyState's recipe; audited purple/white pair, mode-inert by the
     imagery rule, aria-hidden ornament) — it carries the same
     `ring-1 ring-inset ring-border` every `ToneTile` tint chip does, since the
     chip itself is mode-inert but the `bg-secondary` band under it is not,
     and this pairing measures 2.23:1 (near-invisible) in dark mode without
     the ring. -->
<div class="min-h-[calc(100vh-4rem)] bg-background">
	<section class="bg-secondary text-secondary-foreground">
		<div class="container mx-auto max-w-2xl px-4 pb-20 pt-10 text-center sm:pt-14">
			<span
				aria-hidden="true"
				class="mx-auto mb-5 flex h-16 w-16 -rotate-2 items-center justify-center rounded-2xl bg-poster-purple text-poster-white shadow-poster ring-1 ring-inset ring-border"
			>
				<Building2 class="h-8 w-8" />
			</span>
			<PageHeader
				volume="poster"
				onBand
				kicker={m['orgCreate.kicker']()}
				title={m['orgCreate.title']()}
				subtitle={m['orgCreate.subtitle']()}
				class="text-center sm:flex-col sm:items-center"
			/>
			<p class="mt-2 text-sm">
				{m['createOrgPage.customizeHint']()}
			</p>
		</div>
	</section>

	<div class="container mx-auto -mt-12 max-w-2xl px-4 pb-16">
		<!-- Check if user already owns an organization -->
		{#if ownsOrganization}
			<!-- Warning tint mirrors ToneTile's amber recipe (see security page). -->
			<div class="rounded-lg border-2 border-highlight/40 bg-highlight/20 p-6 shadow-poster">
				<div class="flex gap-3">
					<AlertCircle
						class="h-5 w-5 flex-shrink-0 text-highlight-foreground dark:text-highlight"
						aria-hidden="true"
					/>
					<div>
						<h3 class="font-bold text-highlight-foreground dark:text-highlight">
							{m['orgCreate.alreadyOwner']()}
						</h3>
						<p class="mt-1 text-sm text-foreground">
							{m['orgCreate.alreadyOwnerDescription']()}
						</p>
						<div class="mt-4">
							<a
								href={resolve('/(auth)/dashboard', {})}
								class="inline-flex items-center gap-2 rounded-md bg-highlight px-4 py-2 text-sm font-medium text-highlight-foreground hover:bg-highlight/90"
							>
								{m['orgCreate.backToDashboard']()}
							</a>
						</div>
					</div>
				</div>
			</div>
		{:else if !user?.email_verified}
			<!-- Email not verified warning -->
			<!-- Border/tint + icon carry the tone and the heading reads on
		     --foreground (danger-framing rule: meaning is never color-only).
		     `text-destructive` would now be safe here too — 6.05:1 in dark since
		     the token split (#781), against 2.68:1 before it — but the framing
		     rule stands on its own. -->
			<div class="rounded-lg border-2 border-destructive/40 bg-destructive/10 p-6 shadow-poster">
				<div class="flex gap-3">
					<AlertCircle class="h-5 w-5 flex-shrink-0 text-destructive" aria-hidden="true" />
					<div>
						<h3 class="font-bold text-foreground">
							{m['orgCreate.emailNotVerified']()}
						</h3>
						<p class="mt-1 text-sm text-foreground">
							{m['orgCreate.emailNotVerifiedDescription']()}
						</p>
						<div class="mt-4">
							<a
								href={resolve('/(auth)/account/profile', {})}
								class="inline-flex items-center gap-2 rounded-md bg-destructive px-4 py-2 text-sm font-medium text-destructive-foreground hover:bg-destructive/90"
							>
								{m['orgCreate.verifyEmail']()}
							</a>
						</div>
					</div>
				</div>
			</div>
		{:else}
			<!-- Creation Form -->
			<div class="rounded-lg border-2 bg-card p-6 shadow-poster md:p-8">
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
							<div class="flex gap-2 rounded-md border border-info/30 bg-info/10 p-3">
								<Mail class="h-4 w-4 flex-shrink-0 text-info" aria-hidden="true" />
								<p id="contact-email-hint" class="text-xs text-foreground">
									{m['orgCreate.form.contactEmailVerificationNeeded']()}
								</p>
							</div>
						{:else}
							<div class="flex gap-2 rounded-md border border-success/30 bg-success/10 p-3">
								<CheckCircle class="h-4 w-4 flex-shrink-0 text-success" aria-hidden="true" />
								<p id="contact-email-hint" class="text-xs text-foreground">
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
							onclick={() => goto(resolve('/(auth)/dashboard', {}))}
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
</div>

<!-- Confirmation Dialog -->
{#if showConfirmDialog}
	<div class="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
		<div class="w-full max-w-md rounded-lg border-2 bg-card p-6 shadow-poster-lg">
			<div class="mb-4 flex justify-center">
				<div class="rounded-full bg-highlight p-3 text-highlight-foreground">
					<AlertCircle class="h-6 w-6" aria-hidden="true" />
				</div>
			</div>
			<h3 class="mb-2 text-center text-lg font-bold">
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
