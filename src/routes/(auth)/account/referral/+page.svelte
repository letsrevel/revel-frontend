<script lang="ts">
	import * as m from '$lib/paraglide/messages.js';
	import { onMount } from 'svelte';
	import { authStore } from '$lib/stores/auth.svelte';
	import { createQuery, createMutation, useQueryClient } from '@tanstack/svelte-query';
	import { goto } from '$app/navigation';
	import { Button } from '$lib/components/ui/button';
	import { Input } from '$lib/components/ui/input';
	import {
		Check,
		AlertCircle,
		AlertTriangle,
		CreditCard,
		ExternalLink,
		FileText,
		Copy,
		CircleCheck,
		Circle,
		Loader2
	} from 'lucide-svelte';
	import {
		referralstripeConnect,
		referralstripeVerify,
		userbillingGetBillingProfile,
		userbillingCreateBillingProfile,
		userbillingUpdateBillingProfile,
		userbillingSetVatId,
		userbillingDeleteVatId
	} from '$lib/api/generated/sdk.gen';
	import type {
		UserBillingProfileSchema,
		StripeAccountStatusSchema
	} from '$lib/api/generated/types.gen';

	const queryClient = useQueryClient();
	const user = $derived(authStore.user);
	const accessToken = $derived(authStore.accessToken);
	const referralCode = $derived(user?.referral_code);

	// Redirect non-referrers
	$effect(() => {
		if (user && !user.referral_code) {
			goto('/dashboard');
		}
	});

	// Stripe query param handling
	let justReturnedFromStripe = $state(false);

	onMount(() => {
		const params = new URLSearchParams(window.location.search);
		if (params.get('stripe_success') === 'true') {
			justReturnedFromStripe = true;
			window.history.replaceState({}, '', window.location.pathname);
			setTimeout(() => stripeStatusQuery.refetch(), 1000);
		}
		if (params.get('stripe_refresh') === 'true') {
			window.history.replaceState({}, '', window.location.pathname);
			handleStripeConnect();
		}
	});

	// --- Stripe Status ---
	const stripeStatusQuery = createQuery(() => ({
		queryKey: ['referral-stripe-status'],
		queryFn: async () => {
			const response = await referralstripeVerify({
				headers: { Authorization: `Bearer ${accessToken}` }
			});
			if (response.error) throw new Error('Failed to verify Stripe status');
			return response.data as StripeAccountStatusSchema;
		},
		enabled: !!accessToken && !!referralCode,
		retry: false,
		staleTime: 60_000
	}));

	const stripeStatus = $derived(stripeStatusQuery.data);
	const isStripeConnected = $derived(stripeStatus?.is_connected ?? false);
	const stripeChargesEnabled = $derived(stripeStatus?.charges_enabled ?? false);
	const stripeDetailsSubmitted = $derived(stripeStatus?.details_submitted ?? false);
	const isStripeFullySetup = $derived(
		isStripeConnected && stripeChargesEnabled && stripeDetailsSubmitted
	);

	const stripeConnectMutation = createMutation(() => ({
		mutationFn: async () => {
			const response = await referralstripeConnect({
				headers: { Authorization: `Bearer ${accessToken}` }
			});
			if (response.error || !response.data) throw new Error(m['referral.forbidden']());
			return response.data;
		},
		onSuccess: (data) => {
			window.location.href = data.onboarding_url;
		}
	}));

	function handleStripeConnect() {
		stripeConnectMutation.mutate();
	}

	// --- Billing Profile ---
	const billingQuery = createQuery(() => ({
		queryKey: ['user-billing-profile'],
		queryFn: async () => {
			const response = await userbillingGetBillingProfile({
				headers: { Authorization: `Bearer ${accessToken}` }
			});
			// 404 means no billing profile yet - return null
			if (response.response?.status === 404) return null;
			if (response.error) throw new Error('Failed to fetch billing profile');
			return response.data as UserBillingProfileSchema;
		},
		enabled: !!accessToken && !!referralCode,
		retry: false,
		staleTime: 60_000
	}));

	const billingProfile = $derived(billingQuery.data);
	const hasBillingProfile = $derived(billingProfile !== null && billingProfile !== undefined);

	// Form state for billing
	let billingName = $state('');
	let billingAddress = $state('');
	let vatCountryCode = $state('');
	let billingEmail = $state('');
	let vatIdInput = $state('');
	let selfBillingAgreed = $state(false);
	let billingSaveStatus = $state<'idle' | 'saving' | 'saved' | 'error'>('idle');

	// Sync form state from query data
	$effect(() => {
		if (billingProfile) {
			billingName = billingProfile.billing_name || '';
			billingAddress = billingProfile.billing_address || '';
			vatCountryCode = billingProfile.vat_country_code || '';
			billingEmail = billingProfile.billing_email || '';
			vatIdInput = billingProfile.vat_id || '';
			selfBillingAgreed = billingProfile.self_billing_agreed ?? false;
		}
	});

	const isBillingComplete = $derived(
		hasBillingProfile &&
			!!billingProfile?.billing_name &&
			!!billingProfile?.vat_country_code &&
			!!billingProfile?.billing_address
	);

	const isSelfBillingAgreed = $derived(billingProfile?.self_billing_agreed ?? false);

	// Payout eligibility
	const isPayoutEligible = $derived(isStripeFullySetup && isBillingComplete && isSelfBillingAgreed);

	// Billing save mutation
	const billingSaveMutation = createMutation(() => ({
		mutationFn: async () => {
			const headers = { Authorization: `Bearer ${accessToken}` };
			const body = {
				billing_name: billingName,
				billing_address: billingAddress,
				vat_country_code: vatCountryCode,
				...(billingEmail ? { billing_email: billingEmail } : {}),
				self_billing_agreed: selfBillingAgreed
			};

			if (hasBillingProfile) {
				const response = await userbillingUpdateBillingProfile({
					headers,
					body
				});
				if (response.error) throw new Error('Failed to update billing profile');
				return response.data;
			} else {
				const response = await userbillingCreateBillingProfile({
					headers,
					body
				});
				if (response.error) throw new Error('Failed to create billing profile');
				return response.data;
			}
		},
		onSuccess: () => {
			billingSaveStatus = 'saved';
			queryClient.invalidateQueries({ queryKey: ['user-billing-profile'] });
			setTimeout(() => (billingSaveStatus = 'idle'), 2000);
		},
		onError: () => {
			billingSaveStatus = 'error';
			setTimeout(() => (billingSaveStatus = 'idle'), 3000);
		}
	}));

	function handleBillingSave() {
		billingSaveStatus = 'saving';
		billingSaveMutation.mutate();
	}

	// VAT ID mutations
	const vatSetMutation = createMutation(() => ({
		mutationFn: async () => {
			const response = await userbillingSetVatId({
				headers: { Authorization: `Bearer ${accessToken}` },
				body: { vat_id: vatIdInput }
			});
			if (response.error) throw new Error('Failed to set VAT ID');
			return response.data;
		},
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ['user-billing-profile'] });
		}
	}));

	const vatDeleteMutation = createMutation(() => ({
		mutationFn: async () => {
			const response = await userbillingDeleteVatId({
				headers: { Authorization: `Bearer ${accessToken}` }
			});
			if (response.error) throw new Error('Failed to remove VAT ID');
			return response.data;
		},
		onSuccess: () => {
			vatIdInput = '';
			queryClient.invalidateQueries({ queryKey: ['user-billing-profile'] });
		}
	}));

	// Copy referral link
	let linkCopied = $state(false);

	function copyReferralLink() {
		if (!referralCode) return;
		const origin = typeof window !== 'undefined' ? window.location.origin : '';
		const link = `${origin}/register?ref=${referralCode.code}`;
		navigator.clipboard.writeText(link);
		linkCopied = true;
		setTimeout(() => (linkCopied = false), 2000);
	}

	// Stripe status display
	const stripeStatusInfo = $derived.by(() => {
		if (!stripeStatus || !isStripeConnected) {
			return { type: 'not-connected', color: 'gray' };
		}
		if (stripeStatusQuery.isFetching) {
			return { type: 'loading', color: 'blue' };
		}
		if (stripeChargesEnabled && stripeDetailsSubmitted) {
			return { type: 'fully-connected', color: 'green' };
		}
		if (!stripeDetailsSubmitted) {
			return { type: 'incomplete', color: 'yellow' };
		}
		if (!stripeChargesEnabled) {
			return { type: 'restricted', color: 'red' };
		}
		return { type: 'unknown', color: 'gray' };
	});
</script>

<svelte:head>
	<title>{m['referral.settings']()} - Revel</title>
</svelte:head>

<div class="container mx-auto max-w-2xl px-4 py-8">
	<h1 class="text-2xl font-bold">{m['referral.referralProgram']()}</h1>

	{#if !referralCode}
		<p class="mt-4 text-muted-foreground">Loading...</p>
	{:else}
		<!-- Referral Code & Share Link -->
		<div class="mt-6 rounded-lg border bg-card p-4">
			<div class="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
				<div>
					<p class="text-sm text-muted-foreground">{m['referral.yourCode']()}</p>
					<p class="font-mono text-lg font-bold">{referralCode.code}</p>
					{#if !referralCode.is_active}
						<p class="text-sm text-amber-600 dark:text-amber-400">
							{m['referral.codeInactive']()}
						</p>
					{/if}
				</div>
				<Button variant="outline" onclick={copyReferralLink} class="gap-2">
					{#if linkCopied}
						<Check class="h-4 w-4" aria-hidden="true" />
						{m['referral.copied']()}
					{:else}
						<Copy class="h-4 w-4" aria-hidden="true" />
						{m['referral.copyLink']()}
					{/if}
				</Button>
			</div>
		</div>

		<!-- Payout Setup Checklist -->
		<section class="mt-8 rounded-lg border bg-card p-6">
			<h2 class="text-lg font-semibold">{m['referral.setupChecklist']()}</h2>
			<p class="mt-1 text-sm text-muted-foreground">{m['referral.setupDescription']()}</p>

			<div class="mt-4 space-y-3">
				{#each [{ done: isStripeFullySetup, label: m['referral.stepStripe']() }, { done: isBillingComplete, label: m['referral.stepBilling']() }, { done: isSelfBillingAgreed, label: m['referral.stepSelfBilling']() }] as step}
					<div class="flex items-center gap-3">
						{#if step.done}
							<CircleCheck
								class="h-5 w-5 shrink-0 text-emerald-600 dark:text-emerald-400"
								aria-hidden="true"
							/>
						{:else}
							<Circle class="h-5 w-5 shrink-0 text-muted-foreground" aria-hidden="true" />
						{/if}
						<span class={step.done ? 'text-emerald-700 dark:text-emerald-300' : ''}>
							{step.label}
						</span>
					</div>
				{/each}
			</div>

			{#if isPayoutEligible}
				<div
					class="mt-4 flex items-center gap-2 rounded-md bg-emerald-50 p-3 text-emerald-800 dark:bg-emerald-950/30 dark:text-emerald-200"
					role="status"
				>
					<Check class="h-5 w-5 shrink-0" aria-hidden="true" />
					<span class="text-sm font-medium">{m['referral.allStepsComplete']()}</span>
				</div>
			{/if}
		</section>

		<!-- Stripe Connect Section -->
		<section class="mt-6 rounded-lg border bg-card p-6">
			<div class="mb-4 flex items-center gap-2">
				<CreditCard class="h-5 w-5 text-muted-foreground" aria-hidden="true" />
				<h2 class="text-lg font-semibold">{m['referral.stripeConnect']()}</h2>
			</div>
			<p class="text-sm text-muted-foreground">{m['referral.stripeConnectDescription']()}</p>

			{#if justReturnedFromStripe}
				<div
					class="mt-4 flex items-center gap-2 rounded-lg border border-green-200 bg-green-50 p-4 text-green-800 dark:border-green-800 dark:bg-green-950 dark:text-green-100"
					role="alert"
				>
					<Check class="h-5 w-5 shrink-0" aria-hidden="true" />
					<div>
						<p class="font-medium">{m['referral.stripeWelcomeBack']()}</p>
						<p class="text-sm">{m['referral.stripeVerifyingAccount']()}</p>
					</div>
				</div>
			{/if}

			<!-- Status Card -->
			<div
				class="mt-4 rounded-lg border-2 p-4
					{stripeStatusInfo.color === 'green'
					? 'border-green-200 bg-green-50 dark:border-green-800 dark:bg-green-950/30'
					: stripeStatusInfo.color === 'yellow'
						? 'border-yellow-200 bg-yellow-50 dark:border-yellow-800 dark:bg-yellow-950/30'
						: stripeStatusInfo.color === 'red'
							? 'border-red-200 bg-red-50 dark:border-red-800 dark:bg-red-950/30'
							: 'border-border bg-muted'}"
			>
				<div class="flex items-start gap-3">
					<div class="shrink-0">
						{#if stripeStatusInfo.type === 'fully-connected'}
							<div class="rounded-full bg-green-600 p-2">
								<Check class="h-5 w-5 text-white" aria-hidden="true" />
							</div>
						{:else if stripeStatusInfo.type === 'incomplete'}
							<div class="rounded-full bg-yellow-600 p-2">
								<AlertTriangle class="h-5 w-5 text-white" aria-hidden="true" />
							</div>
						{:else if stripeStatusInfo.type === 'restricted'}
							<div class="rounded-full bg-red-600 p-2">
								<AlertCircle class="h-5 w-5 text-white" aria-hidden="true" />
							</div>
						{:else}
							<div class="rounded-full bg-gray-400 p-2">
								<CreditCard class="h-5 w-5 text-white" aria-hidden="true" />
							</div>
						{/if}
					</div>
					<div class="flex-1">
						<h3 class="font-semibold">
							{#if stripeStatusInfo.type === 'fully-connected'}
								{m['referral.stripeConnected']()}
							{:else if stripeStatusInfo.type === 'incomplete'}
								{m['referral.stripeIncomplete']()}
							{:else if stripeStatusInfo.type === 'restricted'}
								{m['referral.stripeRestricted']()}
							{:else}
								{m['referral.stripeNotConnected']()}
							{/if}
						</h3>
						<p class="mt-1 text-sm text-muted-foreground">
							{#if stripeStatusInfo.type === 'fully-connected'}
								{m['referral.stripeConnectedDescription']()}
							{:else if stripeStatusInfo.type === 'incomplete'}
								{m['referral.stripeIncompleteDescription']()}
							{:else if stripeStatusInfo.type === 'restricted'}
								{m['referral.stripeRestrictedDescription']()}
							{:else}
								{m['referral.stripeNotConnectedDescription']()}
							{/if}
						</p>

						{#if isStripeConnected}
							<dl class="mt-3 grid grid-cols-2 gap-2 text-xs">
								<div>
									<dt class="font-medium text-muted-foreground">
										{m['referral.detailsSubmitted']()}
									</dt>
									<dd class="mt-0.5 flex items-center gap-1">
										{#if stripeDetailsSubmitted}
											<Check class="h-3 w-3 text-green-600" aria-hidden="true" />
											<span class="text-green-700 dark:text-green-300">{m['referral.yes']()}</span>
										{:else}
											<AlertCircle class="h-3 w-3 text-yellow-600" aria-hidden="true" />
											<span class="text-yellow-700 dark:text-yellow-300">{m['referral.no']()}</span>
										{/if}
									</dd>
								</div>
								<div>
									<dt class="font-medium text-muted-foreground">
										{m['referral.chargesEnabled']()}
									</dt>
									<dd class="mt-0.5 flex items-center gap-1">
										{#if stripeChargesEnabled}
											<Check class="h-3 w-3 text-green-600" aria-hidden="true" />
											<span class="text-green-700 dark:text-green-300">{m['referral.yes']()}</span>
										{:else}
											<AlertCircle class="h-3 w-3 text-red-600" aria-hidden="true" />
											<span class="text-red-700 dark:text-red-300">{m['referral.no']()}</span>
										{/if}
									</dd>
								</div>
							</dl>
						{/if}
					</div>
				</div>
			</div>

			{#if stripeConnectMutation.error}
				<div
					class="mt-3 flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-red-800 dark:border-red-800 dark:bg-red-950 dark:text-red-100"
					role="alert"
				>
					<AlertCircle class="h-4 w-4 shrink-0" aria-hidden="true" />
					<p class="text-sm">{stripeConnectMutation.error.message}</p>
				</div>
			{/if}

			<div class="mt-4 flex items-center gap-3">
				{#if !isStripeConnected || stripeStatusInfo.type === 'incomplete' || stripeStatusInfo.type === 'restricted'}
					<Button
						onclick={handleStripeConnect}
						disabled={stripeConnectMutation.isPending}
						class="gap-2"
					>
						{#if stripeConnectMutation.isPending}
							<Loader2 class="h-4 w-4 animate-spin" aria-hidden="true" />
						{:else}
							<ExternalLink class="h-4 w-4" aria-hidden="true" />
						{/if}
						{isStripeConnected
							? m['referral.completeStripeSetup']()
							: m['referral.connectStripe']()}
					</Button>
				{/if}
				{#if isStripeConnected}
					<Button
						variant="outline"
						onclick={() => stripeStatusQuery.refetch()}
						disabled={stripeStatusQuery.isFetching}
						class="gap-2"
					>
						{#if stripeStatusQuery.isFetching}
							<Loader2 class="h-4 w-4 animate-spin" aria-hidden="true" />
						{:else}
							<Check class="h-4 w-4" aria-hidden="true" />
						{/if}
						{m['referral.verifyStatus']()}
					</Button>
				{/if}
			</div>
		</section>

		<!-- Billing Information -->
		<section class="mt-6 rounded-lg border bg-card p-6">
			<div class="mb-4 flex items-center gap-2">
				<FileText class="h-5 w-5 text-muted-foreground" aria-hidden="true" />
				<h2 class="text-lg font-semibold">{m['referral.billingInfo']()}</h2>
			</div>
			<p class="text-sm text-muted-foreground">{m['referral.billingInfoDescription']()}</p>

			{#if hasBillingProfile && !isBillingComplete}
				<div
					class="mt-4 flex items-start gap-3 rounded-lg border border-amber-300 bg-amber-50 p-4 dark:border-amber-700 dark:bg-amber-950/30"
					role="alert"
				>
					<AlertTriangle
						class="mt-0.5 h-5 w-5 shrink-0 text-amber-600 dark:text-amber-400"
						aria-hidden="true"
					/>
					<div>
						<p class="font-medium text-amber-900 dark:text-amber-100">
							{m['referral.billingIncomplete']()}
						</p>
						<p class="mt-1 text-sm text-amber-800 dark:text-amber-200">
							{m['referral.billingIncompleteDescription']()}
						</p>
					</div>
				</div>
			{/if}

			<form
				onsubmit={(e) => {
					e.preventDefault();
					handleBillingSave();
				}}
				class="mt-4 space-y-4"
			>
				<div class="space-y-2">
					<label for="billingName" class="block text-sm font-medium">
						{m['referral.billingName']()} *
					</label>
					<Input
						id="billingName"
						bind:value={billingName}
						placeholder={m['referral.billingNamePlaceholder']()}
						required
					/>
				</div>

				<div class="space-y-2">
					<label for="billingAddress" class="block text-sm font-medium">
						{m['referral.billingAddress']()} *
					</label>
					<Input
						id="billingAddress"
						bind:value={billingAddress}
						placeholder={m['referral.billingAddressPlaceholder']()}
						required
					/>
				</div>

				<div class="space-y-2">
					<label for="vatCountryCode" class="block text-sm font-medium">
						{m['referral.vatCountryCode']()} *
					</label>
					<Input
						id="vatCountryCode"
						bind:value={vatCountryCode}
						placeholder={m['referral.vatCountryCodePlaceholder']()}
						maxlength={2}
						class="uppercase"
						required
					/>
				</div>

				<div class="space-y-2">
					<label for="billingEmail" class="block text-sm font-medium">
						{m['referral.billingEmail']()}
					</label>
					<Input
						id="billingEmail"
						type="email"
						bind:value={billingEmail}
						placeholder={m['referral.billingEmailPlaceholder']()}
					/>
				</div>

				<!-- Self-Billing Agreement -->
				<div class="rounded-lg border bg-muted/50 p-4">
					<h3 class="text-sm font-semibold">{m['referral.selfBilling']()}</h3>
					<p class="mt-1 text-xs text-muted-foreground">
						{m['referral.selfBillingDescription']()}
					</p>
					<label class="mt-3 flex items-start gap-3">
						<input
							type="checkbox"
							bind:checked={selfBillingAgreed}
							class="mt-1 h-4 w-4 rounded border-input text-primary focus:ring-2 focus:ring-ring focus:ring-offset-2"
						/>
						<span class="text-sm">
							{m['referral.selfBillingCheckbox']()}
							<a
								href="/legal/terms"
								target="_blank"
								rel="noopener noreferrer"
								class="text-primary underline-offset-4 hover:underline"
							>
								{m['referral.termsAndConditions']()}
							</a>.
						</span>
					</label>
				</div>

				<div class="flex items-center gap-3">
					<Button type="submit" disabled={billingSaveMutation.isPending || !billingName}>
						{#if billingSaveStatus === 'saving'}
							<Loader2 class="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />
							{m['referral.saving']()}
						{:else if billingSaveStatus === 'saved'}
							<Check class="mr-2 h-4 w-4" aria-hidden="true" />
							{m['referral.saved']()}
						{:else}
							{hasBillingProfile ? m['referral.updateBilling']() : m['referral.saveBilling']()}
						{/if}
					</Button>

					{#if billingSaveStatus === 'error'}
						<span class="text-sm text-destructive">{m['referral.error']()}</span>
					{/if}
				</div>
			</form>

			<!-- VAT ID Section (only shown after billing profile exists) -->
			{#if hasBillingProfile}
				<div class="mt-6 border-t pt-4">
					<h3 class="text-sm font-semibold">{m['referral.vatId']()}</h3>
					<p class="mt-1 text-xs text-muted-foreground">
						{m['referral.vatIdDescription']()}
					</p>

					{#if billingProfile?.vat_id}
						<div class="mt-3 flex items-center gap-3">
							<span class="font-mono text-sm">{billingProfile.vat_id}</span>
							{#if billingProfile.vat_id_validated}
								<span
									class="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-800 dark:bg-emerald-900/50 dark:text-emerald-300"
								>
									<Check class="h-3 w-3" aria-hidden="true" />
									{m['referral.vatIdValidated']()}
								</span>
							{:else}
								<span
									class="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800 dark:bg-amber-900/50 dark:text-amber-300"
								>
									<AlertCircle class="h-3 w-3" aria-hidden="true" />
									{m['referral.vatIdNotValidated']()}
								</span>
							{/if}
							<Button
								variant="ghost"
								size="sm"
								onclick={() => vatDeleteMutation.mutate()}
								disabled={vatDeleteMutation.isPending}
								class="text-destructive"
							>
								{m['referral.removeVatId']()}
							</Button>
						</div>
					{:else}
						<div class="mt-3 flex gap-2">
							<Input
								bind:value={vatIdInput}
								placeholder={m['referral.vatIdPlaceholder']()}
								class="max-w-xs uppercase"
							/>
							<Button
								variant="outline"
								onclick={() => vatSetMutation.mutate()}
								disabled={vatSetMutation.isPending || !vatIdInput.trim()}
							>
								{#if vatSetMutation.isPending}
									<Loader2 class="h-4 w-4 animate-spin" />
								{:else}
									{m['referral.setVatId']()}
								{/if}
							</Button>
						</div>
					{/if}
				</div>
			{/if}
		</section>

		<!-- Link to Payouts -->
		<div class="mt-6">
			<a
				href="/account/referral/payouts"
				class="inline-flex items-center gap-2 text-sm font-medium text-primary hover:underline"
			>
				{m['referral.payouts']()} &rarr;
			</a>
		</div>
	{/if}
</div>
