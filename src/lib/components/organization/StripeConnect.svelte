<script lang="ts">
	import { resolve } from '$app/paths';
	import * as m from '$lib/paraglide/messages.js';
	import { createQuery, createMutation } from '@tanstack/svelte-query';
	import { Button } from '$lib/components/ui/button';
	import { Card } from '$lib/components/ui/card';
	import {
		AlertCircle,
		Check,
		ExternalLink,
		CreditCard,
		AlertTriangle,
		BarChart3
	} from '@lucide/svelte';
	import { onMount } from 'svelte';
	import { browser } from '$app/environment';
	import {
		organizationadmincoreStripeConnect,
		organizationadmincoreStripeAccountVerify
	} from '$lib/api/generated/sdk.gen';
	import StripeConnectModal from './StripeConnectModal.svelte';
	import { extractApiErrorDetail } from '$lib/utils/api-error-detail';
	import SectionHeader from '$lib/components/common/SectionHeader.svelte';
	import type { Tone } from '$lib/components/common/tones';

	interface Props {
		organizationSlug: string;
		stripeChargesEnabled: boolean;
		stripeDetailsSubmitted: boolean;
		stripeAccountId: string | null;
		stripeAccountEmail: string | null;
		accessToken: string;
		billingInfoMissing?: boolean;
	}

	const {
		organizationSlug,
		stripeChargesEnabled,
		stripeDetailsSubmitted,
		stripeAccountId,
		stripeAccountEmail,
		accessToken,
		billingInfoMissing = false
	}: Props = $props();

	// Derived: Is Stripe connected (has account ID)
	const isConnected = $derived(!!stripeAccountId);

	// Check if user just returned from Stripe onboarding
	let justConnected = $state(false);
	let mounted = $state(false);

	// Modal state
	let showModal = $state(false);
	let modalError = $state<string | null>(null);

	onMount(() => {
		mounted = true;
		const urlParams = new URLSearchParams(window.location.search);
		// Check for stripe_success=true parameter (Stripe redirect)
		if (urlParams.get('stripe_success') === 'true') {
			justConnected = true;
			// Remove the query parameter from URL
			const cleanUrl = window.location.pathname;
			window.history.replaceState({}, '', cleanUrl);

			// Auto-verify account after returning from Stripe
			setTimeout(() => {
				verifyQuery?.refetch();
			}, 1000);
		}
	});

	// Query to verify Stripe account status - only create on client
	// createQuery returns a reactive object, not a store
	const verifyQuery = browser
		? createQuery(() => ({
				queryKey: ['stripe-status', organizationSlug],
				queryFn: async () => {
					const response = await organizationadmincoreStripeAccountVerify({
						path: { slug: organizationSlug },
						headers: { Authorization: `Bearer ${accessToken}` }
					});

					if (response.error || !response.data) {
						throw new Error('Failed to verify Stripe account');
					}

					return response.data;
				},
				enabled: isConnected && mounted
			}))
		: null;

	// Mutation to get Stripe onboarding link - only create on client
	const connectMutation = browser
		? createMutation(() => ({
				mutationFn: async (email: string) => {
					const response = await organizationadmincoreStripeConnect({
						path: { slug: organizationSlug },
						headers: { Authorization: `Bearer ${accessToken}` },
						body: { email }
					});

					if (response.error) {
						const errorMsg =
							extractApiErrorDetail(response.error) ?? m['stripeConnect.failedToCreateLink']();
						throw new Error(errorMsg);
					}

					if (!response.data) throw new Error(m['stripeConnect.failedToCreateLink']());
					return response.data;
				},
				onSuccess: (data) => {
					// Redirect to Stripe onboarding
					window.location.href = data.onboarding_url;
				},
				onError: (error) => {
					modalError = error.message;
				}
			}))
		: null;

	// Handle connect button click - open modal
	function handleConnect() {
		showModal = true;
		modalError = null;
	}

	// Handle modal confirm - call mutation with email
	function handleModalConfirm(email: string) {
		modalError = null;
		connectMutation?.mutate(email);
	}

	// Handle modal cancel
	function handleModalCancel() {
		showModal = false;
		modalError = null;
	}

	// Handle verify refetch
	function handleRefetch() {
		verifyQuery?.refetch();
	}

	type StripeStatusType =
		'not-connected' | 'loading' | 'fully-connected' | 'incomplete' | 'restricted' | 'unknown';

	// Determine overall status
	// Use query data if available (manual refresh), otherwise use props
	const status = $derived.by((): { type: StripeStatusType; title: string; message: string } => {
		if (!isConnected) {
			return {
				type: 'not-connected',
				title: m['stripeConnect.statusNotConnectedTitle'](),
				message: m['stripeConnect.statusNotConnectedMessage']()
			};
		}

		// Use data from query if available (manual refresh), otherwise use props
		const chargesEnabled = verifyQuery?.data?.charges_enabled ?? stripeChargesEnabled;
		const detailsSubmitted = verifyQuery?.data?.details_submitted ?? stripeDetailsSubmitted;

		// Show loading state while verifying
		if (browser && verifyQuery?.isFetching) {
			return {
				type: 'loading',
				title: m['stripeConnect.statusVerifyingTitle'](),
				message: m['stripeConnect.statusVerifyingMessage']()
			};
		}

		if (chargesEnabled && detailsSubmitted) {
			const emailMsg = stripeAccountEmail
				? ` ${m['stripeConnect.connectedWithEmail']({ email: stripeAccountEmail })}`
				: '';
			return {
				type: 'fully-connected',
				title: m['stripeConnect.statusConnectedTitle'](),
				message: `${m['stripeConnect.statusConnectedMessage']()}${emailMsg}`
			};
		}

		if (!detailsSubmitted) {
			return {
				type: 'incomplete',
				title: m['stripeConnect.statusIncompleteTitle'](),
				message: m['stripeConnect.statusIncompleteMessage']()
			};
		}

		if (!chargesEnabled) {
			return {
				type: 'restricted',
				title: m['stripeConnect.statusRestrictedTitle'](),
				message: m['stripeConnect.statusRestrictedMessage']()
			};
		}

		return {
			type: 'unknown',
			title: m['stripeConnect.statusUnknownTitle'](),
			message: m['stripeConnect.statusUnknownMessage']()
		};
	});

	// `unknown` collapses onto `neutral`, same as `not-connected`: neither is an
	// error the organizer caused, so neither should read as alarming.
	const STATUS_TONE: Record<StripeStatusType, Tone> = {
		'not-connected': 'neutral',
		loading: 'info',
		'fully-connected': 'success',
		incomplete: 'warning',
		restricted: 'danger',
		unknown: 'neutral'
	};
	const statusTone = $derived(STATUS_TONE[status.type]);

	// Soft tint on the status Card — background/border only, never text (see the
	// heading/message markup below: tone lives in the icon chip + this tint, not
	// in colored body text, which is how dark --destructive as TEXT fails AA).
	const CARD_TONE_CLASSES: Record<Tone, string> = {
		brand: 'border-primary/40 bg-primary/10',
		info: 'border-info/40 bg-info/10',
		success: 'border-success/40 bg-success/10',
		warning: 'border-highlight/40 bg-highlight/20',
		danger: 'border-destructive/40 bg-destructive/10',
		neutral: 'border-border bg-muted'
	};

	// Solid icon-chip fill — every pair is an audited *-foreground/* token pair.
	const ICON_CHIP_CLASSES: Record<Tone, string> = {
		brand: 'bg-primary text-primary-foreground',
		info: 'bg-info text-info-foreground',
		success: 'bg-success text-success-foreground',
		warning: 'bg-highlight text-highlight-foreground',
		danger: 'bg-destructive text-destructive-foreground',
		neutral: 'bg-muted text-muted-foreground'
	};
</script>

<section class="space-y-4 rounded-lg border border-border bg-card p-6 shadow-sm">
	<div class="mb-4 flex items-center gap-2">
		<CreditCard class="h-5 w-5 shrink-0 text-muted-foreground" aria-hidden="true" />
		<SectionHeader title={m['stripeConnect.paymentProcessing']()} class="flex-1" />
	</div>

	<!-- Success Message (when returning from Stripe) -->
	{#if justConnected}
		<div
			class="flex items-center gap-2 rounded-lg border border-success/40 bg-success/10 p-4 text-foreground"
			role="alert"
		>
			<Check class="h-5 w-5 shrink-0 text-success" aria-hidden="true" />
			<div>
				<p class="font-medium">{m['stripeConnect.welcomeBack']()}</p>
				<p class="text-sm text-muted-foreground">{m['stripeConnect.verifyingAccount']()}</p>
			</div>
		</div>
	{/if}

	<!-- Connection Status Card -->
	<Card class="border-2 p-4 {CARD_TONE_CLASSES[statusTone]}">
		<div class="flex items-start gap-3">
			<!-- Icon: this is where the status tone lives (WCAG-safe — the audited
			     *-foreground/* pair — rather than on the heading/message text below). -->
			<div class="shrink-0 rounded-full p-2 {ICON_CHIP_CLASSES[statusTone]}">
				{#if status.type === 'fully-connected'}
					<Check class="h-5 w-5" aria-hidden="true" />
				{:else if status.type === 'incomplete'}
					<AlertTriangle class="h-5 w-5" aria-hidden="true" />
				{:else if status.type === 'restricted'}
					<AlertCircle class="h-5 w-5" aria-hidden="true" />
				{:else if status.type === 'loading'}
					<div
						class="h-5 w-5 animate-spin rounded-full border-2 border-current border-t-transparent"
						aria-hidden="true"
					></div>
				{:else}
					<CreditCard class="h-5 w-5" aria-hidden="true" />
				{/if}
			</div>

			<!-- Content: heading/message stay on theme foreground tokens regardless of
			     tone — see the icon chip above for why. -->
			<div class="flex-1">
				<h3 class="font-bold text-foreground">
					{status.title}
				</h3>
				<p class="mt-1 text-sm text-muted-foreground">
					{status.message}
				</p>

				<!-- Status Details (if connected) -->
				{#if isConnected}
					{@const chargesEnabled = verifyQuery?.data?.charges_enabled ?? stripeChargesEnabled}
					{@const detailsSubmitted = verifyQuery?.data?.details_submitted ?? stripeDetailsSubmitted}
					<dl class="mt-3 grid grid-cols-2 gap-2 text-xs">
						<div>
							<dt class="font-medium text-muted-foreground">
								{m['stripeConnect.detailsSubmitted']()}
							</dt>
							<dd class="mt-0.5 flex items-center gap-1">
								{#if detailsSubmitted}
									<Check class="h-3 w-3 text-success" aria-hidden="true" />
									<span class="text-foreground">{m['stripeConnect.yes']()}</span>
								{:else}
									<AlertCircle
										class="h-3 w-3 text-highlight-foreground dark:text-highlight"
										aria-hidden="true"
									/>
									<span class="text-foreground">{m['stripeConnect.no']()}</span>
								{/if}
							</dd>
						</div>
						<div>
							<dt class="font-medium text-muted-foreground">
								{m['stripeConnect.chargesEnabled']()}
							</dt>
							<dd class="mt-0.5 flex items-center gap-1">
								{#if chargesEnabled}
									<Check class="h-3 w-3 text-success" aria-hidden="true" />
									<span class="text-foreground">{m['stripeConnect.yes']()}</span>
								{:else}
									<!-- This dl can render inside ANY status card (e.g. the
									     warning-tone "incomplete" card, bg-highlight/20), not
									     just the danger-tone one — plain text-destructive there
									     measured 1.85:1 in dark (destructive's dark hue sits too
									     close to the amber tint's lightness). destructive-foreground
									     (white) on that same composite measures 10.88:1. -->
									<AlertCircle
										class="h-3 w-3 text-destructive dark:text-destructive-foreground"
										aria-hidden="true"
									/>
									<span class="text-foreground">{m['stripeConnect.no']()}</span>
								{/if}
							</dd>
						</div>
					</dl>
				{/if}
			</div>
		</div>
	</Card>

	<!-- Error Display -->
	{#if connectMutation?.error}
		<div
			class="flex items-center gap-2 rounded-lg border border-destructive/50 bg-destructive/10 p-3 text-foreground"
			role="alert"
		>
			<!-- Icon carries the tone, not the body text: dark --destructive as TEXT
			     on this composite measures ~2.7-2.95:1 (fails both the 3:1 non-text
			     and 4.5:1 text floors) — see StripeConnect's status-card comment for
			     the same trap. -->
			<AlertCircle class="h-4 w-4 shrink-0 text-destructive" aria-hidden="true" />
			<p class="text-sm">{connectMutation.error.message}</p>
		</div>
	{/if}

	{#if verifyQuery?.error}
		<div
			class="flex items-center gap-2 rounded-lg border border-destructive/50 bg-destructive/10 p-3 text-foreground"
			role="alert"
		>
			<AlertCircle class="h-4 w-4 shrink-0 text-destructive" aria-hidden="true" />
			<p class="text-sm">{m['stripeConnect.failedToVerify']()}</p>
		</div>
	{/if}

	<!-- Action Buttons -->
	{#if browser}
		<div class="flex items-center gap-3">
			{#if !isConnected || status.type === 'incomplete' || status.type === 'restricted'}
				<Button
					onclick={handleConnect}
					disabled={connectMutation?.isPending}
					class="inline-flex items-center gap-2"
				>
					{#if connectMutation?.isPending}
						<div
							class="h-4 w-4 animate-spin rounded-full border-2 border-primary-foreground border-t-transparent"
							aria-hidden="true"
						></div>
						{m['stripeConnect.connecting']()}
					{:else}
						<ExternalLink class="h-4 w-4" aria-hidden="true" />
						{isConnected
							? m['stripeConnect.completeSetup']()
							: m['stripeConnect.connectWithStripe']()}
					{/if}
				</Button>
			{/if}

			{#if isConnected}
				<Button
					variant="outline"
					onclick={handleRefetch}
					disabled={verifyQuery?.isFetching}
					class="inline-flex items-center gap-2"
				>
					{#if verifyQuery?.isFetching}
						<div
							class="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent"
							aria-hidden="true"
						></div>
						{m['stripeConnect.verifying']()}
					{:else}
						<Check class="h-4 w-4" aria-hidden="true" />
						{m['stripeConnect.verifyAccountStatus']()}
					{/if}
				</Button>
			{/if}

			{#if isConnected && (verifyQuery?.data?.details_submitted ?? stripeDetailsSubmitted)}
				<a
					href="https://dashboard.stripe.com/"
					target="_blank"
					rel="noopener noreferrer"
					class="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
				>
					<BarChart3 class="h-4 w-4" aria-hidden="true" />
					{m['stripeConnect.goToDashboard']()}
					<ExternalLink class="h-3 w-3" aria-hidden="true" />
				</a>
			{/if}
		</div>
	{:else}
		<!-- Server-side placeholder -->
		<div class="flex items-center gap-3">
			{#if !isConnected || status.type === 'incomplete' || status.type === 'restricted'}
				<Button disabled class="inline-flex items-center gap-2">
					<ExternalLink class="h-4 w-4" aria-hidden="true" />
					{isConnected
						? m['stripeConnect.completeSetup']()
						: m['stripeConnect.connectWithStripe']()}
				</Button>
			{/if}

			{#if isConnected}
				<Button disabled variant="outline" class="inline-flex items-center gap-2">
					<Check class="h-4 w-4" aria-hidden="true" />
					{m['stripeConnect.verifyAccountStatus']()}
				</Button>
			{/if}

			{#if isConnected && stripeDetailsSubmitted}
				<a
					href="https://dashboard.stripe.com/"
					target="_blank"
					rel="noopener noreferrer"
					class="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
				>
					<BarChart3 class="h-4 w-4" aria-hidden="true" />
					{m['stripeConnect.goToDashboard']()}
					<ExternalLink class="h-3 w-3" aria-hidden="true" />
				</a>
			{/if}
		</div>
	{/if}

	<!-- Billing Info Nudge -->
	{#if billingInfoMissing && status.type === 'fully-connected'}
		<!-- No --warning token exists; highlight/amber IS the warning tone.
		     border-highlight/40 bg-highlight/20 + text-highlight-foreground
		     (light) / text-highlight dark: matches the hand-verified pattern in
		     tickets/MyTicket.svelte. -->
		<div
			class="flex items-start gap-3 rounded-lg border border-highlight/40 bg-highlight/20 p-4"
			role="alert"
		>
			<AlertCircle
				class="mt-0.5 h-5 w-5 shrink-0 text-highlight-foreground dark:text-highlight"
				aria-hidden="true"
			/>
			<div class="flex-1">
				<p class="font-bold text-highlight-foreground dark:text-highlight">
					{m['orgAdmin.billing.nudge.title']()}
				</p>
				<p class="mt-1 text-sm text-highlight-foreground dark:text-highlight">
					{m['orgAdmin.billing.nudge.message']()}
				</p>
				<a
					href={resolve('/(auth)/org/[slug]/admin/billing', { slug: organizationSlug })}
					class="mt-2 inline-flex items-center gap-1.5 rounded-md bg-highlight px-3 py-1.5 text-sm font-medium text-highlight-foreground transition-colors hover:bg-highlight/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
				>
					{m['orgAdmin.billing.nudge.action']()}
				</a>
			</div>
		</div>
	{/if}

	<!-- Informational Text -->
	<div class="rounded-md bg-muted p-4 text-sm text-muted-foreground">
		<p class="font-medium">{m['stripeConnect.aboutStripeConnect']()}</p>
		<p class="mt-1">
			{m['stripeConnect.aboutIntro']()}
		</p>
		<ul class="mt-2 list-inside list-disc space-y-1">
			<li>{m['stripeConnect.acceptPayments']()}</li>
			<li>{m['stripeConnect.offerPWYC']()}</li>
			<li>{m['stripeConnect.manageRefunds']()}</li>
			<li>{m['stripeConnect.accessAnalytics']()}</li>
		</ul>
		<p class="mt-2 text-xs">
			{m['stripeConnect.aboutFooter']()}
		</p>
	</div>
</section>

<!-- Stripe Connect Modal -->
<StripeConnectModal
	bind:show={showModal}
	initialEmail={stripeAccountEmail || ''}
	isLoading={connectMutation?.isPending || false}
	error={modalError}
	onConfirm={handleModalConfirm}
	onCancel={handleModalCancel}
/>
