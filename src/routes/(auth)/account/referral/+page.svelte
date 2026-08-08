<script lang="ts">
	import * as m from '$lib/paraglide/messages.js';
	import { onMount } from 'svelte';
	import { authStore } from '$lib/stores/auth.svelte';
	import { createQuery, createMutation } from '@tanstack/svelte-query';
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { Button } from '$lib/components/ui/button';
	import {
		Check,
		AlertCircle,
		AlertTriangle,
		CreditCard,
		ExternalLink,
		Copy,
		CircleCheck,
		Circle,
		Loader2
	} from '@lucide/svelte';
	import {
		referralstripeConnect,
		referralstripeVerify,
		userbillingGetBillingProfile
	} from '$lib/api/generated/sdk.gen';
	import type {
		UserBillingProfileSchema,
		StripeAccountStatusSchema
	} from '$lib/api/generated/types.gen';
	import { BillingProfileForm } from '$lib/components/billing';
	import PageHeader from '$lib/components/common/PageHeader.svelte';
	import SectionHeader from '$lib/components/common/SectionHeader.svelte';
	import type { Tone } from '$lib/components/common/tones';

	const user = $derived(authStore.user);
	const accessToken = $derived(authStore.accessToken);
	const referralCode = $derived(user?.referral_code);

	// Redirect non-referrers
	$effect(() => {
		if (user && !user.referral_code) {
			goto(resolve('/(auth)/dashboard', {}));
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
			// No billing profile yet is 200 + null since BE #861 (404 kept for
			// deploy-lag tolerance with older backends) - return null
			if (response.response?.status === 404) return null;
			if (response.error) throw new Error('Failed to fetch billing profile');
			return (response.data as UserBillingProfileSchema | null | undefined) ?? null;
		},
		enabled: !!accessToken && !!referralCode,
		retry: false,
		staleTime: 60_000
	}));

	const billingProfile = $derived(billingQuery.data);
	const hasBillingProfile = $derived(billingProfile !== null && billingProfile !== undefined);

	const isBillingComplete = $derived(
		hasBillingProfile &&
			!!billingProfile?.billing_name &&
			!!billingProfile?.vat_country_code &&
			!!billingProfile?.billing_address
	);

	const isSelfBillingAgreed = $derived(billingProfile?.self_billing_agreed ?? false);

	// Payout eligibility
	const isPayoutEligible = $derived(isStripeFullySetup && isBillingComplete && isSelfBillingAgreed);

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

	// Stripe status display. `tone` drives the StatusBadge/card tint below —
	// each of the five states gets its own tone so no real distinction (e.g.
	// "incomplete" vs "restricted") collapses onto the same color.
	const stripeStatusInfo = $derived.by((): { type: string; tone: Tone } => {
		if (!stripeStatus || !isStripeConnected) {
			return { type: 'not-connected', tone: 'neutral' };
		}
		if (stripeStatusQuery.isFetching) {
			return { type: 'loading', tone: 'info' };
		}
		if (stripeChargesEnabled && stripeDetailsSubmitted) {
			return { type: 'fully-connected', tone: 'success' };
		}
		if (!stripeDetailsSubmitted) {
			return { type: 'incomplete', tone: 'warning' };
		}
		if (!stripeChargesEnabled) {
			return { type: 'restricted', tone: 'danger' };
		}
		return { type: 'unknown', tone: 'neutral' };
	});
</script>

<svelte:head>
	<title>{m['referral.settings']()} - Revel</title>
</svelte:head>

<div class="container mx-auto max-w-2xl px-4 py-8">
	<PageHeader kicker={m['myInvoices.account']()} title={m['referral.referralProgram']()} />

	{#if !referralCode}
		<p class="mt-4 text-muted-foreground">{m['referralPage.loading']()}</p>
	{:else}
		<!-- Referral Code & Share Link -->
		<div class="mt-6 rounded-lg border bg-card p-4">
			<div class="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
				<div>
					<p class="text-sm text-muted-foreground">{m['referral.yourCode']()}</p>
					<p class="font-mono text-lg font-black">{referralCode.code}</p>
					{#if !referralCode.is_active}
						<!-- text-highlight-foreground is contrast-safe but reads as plain
						     dark text on an untinted surface — pair with a visible icon so
						     the warning survives without relying on color alone. -->
						<p
							class="flex items-center gap-1 text-sm text-highlight-foreground dark:text-highlight"
						>
							<AlertCircle class="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
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
			<SectionHeader title={m['referral.setupChecklist']()} />
			<p class="mt-1 text-sm text-muted-foreground">{m['referral.setupDescription']()}</p>

			<div class="mt-4 space-y-3">
				{#each [{ done: isStripeFullySetup, label: m['referral.stepStripe']() }, { done: isBillingComplete, label: m['referral.stepBilling']() }, { done: isSelfBillingAgreed, label: m['referral.stepSelfBilling']() }] as step, i (i)}
					<div class="flex items-center gap-3">
						{#if step.done}
							<CircleCheck class="h-5 w-5 shrink-0 text-success" aria-hidden="true" />
						{:else}
							<Circle class="h-5 w-5 shrink-0 text-muted-foreground" aria-hidden="true" />
						{/if}
						<span class={step.done ? 'text-success' : ''}>
							{step.label}
						</span>
					</div>
				{/each}
			</div>

			{#if isPayoutEligible}
				<!-- Composited tint mirrors ToneTile's audited success pair. -->
				<div
					class="mt-4 flex items-center gap-2 rounded-md border border-success/30 bg-success/10 p-3 text-foreground"
					role="status"
				>
					<Check class="h-5 w-5 shrink-0 text-success" aria-hidden="true" />
					<span class="text-sm font-medium">{m['referral.allStepsComplete']()}</span>
				</div>
			{/if}
		</section>

		<!-- Stripe Connect Section -->
		<section class="mt-6 rounded-lg border bg-card p-6">
			<div class="mb-4 flex items-center gap-2">
				<CreditCard class="h-5 w-5 text-muted-foreground" aria-hidden="true" />
				<SectionHeader title={m['referral.stripeConnect']()} class="flex-1" />
			</div>
			<p class="text-sm text-muted-foreground">{m['referral.stripeConnectDescription']()}</p>

			{#if justReturnedFromStripe}
				<!-- Composited tint mirrors ToneTile's audited success pair. -->
				<div
					class="mt-4 flex items-center gap-2 rounded-lg border border-success/30 bg-success/10 p-4 text-foreground"
					role="alert"
				>
					<Check class="h-5 w-5 shrink-0 text-success" aria-hidden="true" />
					<div>
						<p class="font-medium">{m['referral.stripeWelcomeBack']()}</p>
						<p class="text-sm">{m['referral.stripeVerifyingAccount']()}</p>
					</div>
				</div>
			{/if}

			<!-- Status Card. Tone-tinted border/bg mirror the audited icon/accent
			     pairs (>=3:1 vs background/card); body copy stays on
			     --foreground/--muted-foreground so contrast never depends on the tint. -->
			<div
				class="mt-4 rounded-lg border-2 p-4
					{stripeStatusInfo.tone === 'success'
					? 'border-success/30 bg-success/10'
					: stripeStatusInfo.tone === 'warning'
						? 'border-highlight/40 bg-highlight/20'
						: stripeStatusInfo.tone === 'danger'
							? 'border-destructive/30 bg-destructive/10'
							: 'border-border bg-muted'}"
			>
				<div class="flex items-start gap-3">
					<div class="shrink-0">
						{#if stripeStatusInfo.type === 'fully-connected'}
							<div class="rounded-full bg-success p-2 text-success-foreground">
								<Check class="h-5 w-5" aria-hidden="true" />
							</div>
						{:else if stripeStatusInfo.type === 'incomplete'}
							<div class="rounded-full bg-highlight p-2 text-highlight-foreground">
								<AlertTriangle class="h-5 w-5" aria-hidden="true" />
							</div>
						{:else if stripeStatusInfo.type === 'restricted'}
							<div class="rounded-full bg-destructive p-2 text-destructive-foreground">
								<AlertCircle class="h-5 w-5" aria-hidden="true" />
							</div>
						{:else}
							<div class="rounded-full bg-muted-foreground p-2 text-background">
								<CreditCard class="h-5 w-5" aria-hidden="true" />
							</div>
						{/if}
					</div>
					<div class="flex-1">
						<h3 class="font-bold">
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
											<Check class="h-3 w-3 text-success" aria-hidden="true" />
											<span class="text-success">{m['referral.yes']()}</span>
										{:else}
											<AlertCircle
												class="h-3 w-3 text-highlight-foreground dark:text-highlight"
												aria-hidden="true"
											/>
											<span class="text-highlight-foreground dark:text-highlight"
												>{m['referral.no']()}</span
											>
										{/if}
									</dd>
								</div>
								<div>
									<dt class="font-medium text-muted-foreground">
										{m['referral.chargesEnabled']()}
									</dt>
									<!-- Only the icon carries the tone; the label reads on
									     --foreground (danger-framing rule). Bare
									     `text-destructive` on this card is 6.42:1 in dark since
									     the token split (#781), against 2.85:1 before it. -->
									<dd class="mt-0.5 flex items-center gap-1">
										{#if stripeChargesEnabled}
											<Check class="h-3 w-3 text-success" aria-hidden="true" />
											<span class="text-success">{m['referral.yes']()}</span>
										{:else}
											<AlertCircle class="h-3 w-3 text-destructive" aria-hidden="true" />
											<span class="text-foreground">{m['referral.no']()}</span>
										{/if}
									</dd>
								</div>
							</dl>
						{/if}
					</div>
				</div>
			</div>

			{#if stripeConnectMutation.error}
				<!-- Border/tint + icon carry the tone, the message reads on
				     --foreground (danger-framing rule). `text-destructive` would clear
				     AA on this tint too — 6.05:1 in dark since #781, against 2.85:1
				     before it — but error copy stays on the body-text pair. -->
				<div
					class="mt-3 flex items-center gap-2 rounded-lg border border-destructive/50 bg-destructive/10 p-3 text-foreground"
					role="alert"
				>
					<AlertCircle class="h-4 w-4 shrink-0 text-destructive" aria-hidden="true" />
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
			<div class="flex items-center gap-2">
				<CreditCard class="h-5 w-5 text-muted-foreground" aria-hidden="true" />
				<SectionHeader title={m['billing.form.title']()} class="flex-1" />
			</div>
			<p class="mt-1 text-sm text-muted-foreground">{m['billing.form.description']()}</p>
			<BillingProfileForm authToken={accessToken} showSelfBilling={true} />
		</section>

		<!-- Link to Payouts -->
		<div class="mt-6">
			<a
				href={resolve('/(auth)/account/referral/payouts', {})}
				class="inline-flex items-center gap-2 text-sm font-medium text-primary hover:underline"
			>
				{m['referral.payouts']()} &rarr;
			</a>
		</div>
	{/if}
</div>
