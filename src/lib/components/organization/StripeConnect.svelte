<script lang="ts">
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
	} from 'lucide-svelte';
	import { onMount } from 'svelte';
	import { browser } from '$app/environment';
	import {
		organizationadmincoreStripeConnect,
		organizationadmincoreStripeAccountVerify
	} from '$lib/api/generated/sdk.gen';
	import StripeConnectModal from './StripeConnectModal.svelte';

	interface Props {
		organizationSlug: string;
		stripeChargesEnabled: boolean;
		stripeDetailsSubmitted: boolean;
		stripeAccountId: string | null;
		stripeAccountEmail: string | null;
		accessToken: string;
	}

	let {
		organizationSlug,
		stripeChargesEnabled,
		stripeDetailsSubmitted,
		stripeAccountId,
		stripeAccountEmail,
		accessToken
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

					if (response.error) {
						throw new Error('Failed to verify Stripe account');
					}

					return response.data!;
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
							typeof response.error === 'object' && response.error && 'detail' in response.error
								? String(response.error.detail)
								: 'Failed to create Stripe Connect link';
						throw new Error(errorMsg);
					}

					return response.data!;
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

	// Determine overall status
	// Use query data if available (manual refresh), otherwise use props
	let status = $derived.by(() => {
		if (!isConnected) {
			return {
				type: 'not-connected',
				title: 'Stripe Not Connected',
				message: 'Connect your Stripe account to accept online payments for events.',
				color: 'gray'
			};
		}

		// Use data from query if available (manual refresh), otherwise use props
		const chargesEnabled = verifyQuery?.data?.charges_enabled ?? stripeChargesEnabled;
		const detailsSubmitted = verifyQuery?.data?.details_submitted ?? stripeDetailsSubmitted;

		// Show loading state while verifying
		if (browser && verifyQuery?.isFetching) {
			return {
				type: 'loading',
				title: 'Verifying...',
				message: 'Checking your Stripe account status.',
				color: 'blue'
			};
		}

		if (chargesEnabled && detailsSubmitted) {
			const emailMsg = stripeAccountEmail ? ` Connected with: ${stripeAccountEmail}` : '';
			return {
				type: 'fully-connected',
				title: 'Stripe Connected',
				message: `Your Stripe account is fully set up and ready to accept payments.${emailMsg}`,
				color: 'green'
			};
		}

		if (!detailsSubmitted) {
			return {
				type: 'incomplete',
				title: 'Setup Incomplete',
				message: 'Complete your Stripe onboarding to start accepting payments.',
				color: 'yellow'
			};
		}

		if (!chargesEnabled) {
			return {
				type: 'restricted',
				title: 'Charges Disabled',
				message:
					'Your Stripe account cannot accept charges yet. Complete the verification process.',
				color: 'red'
			};
		}

		return {
			type: 'unknown',
			title: 'Unknown Status',
			message: 'Unable to determine Stripe account status.',
			color: 'gray'
		};
	});
</script>

<section class="space-y-4 rounded-lg border border-border bg-card p-6 shadow-sm">
	<div class="mb-4 flex items-center gap-2">
		<CreditCard class="h-5 w-5 text-muted-foreground" aria-hidden="true" />
		<h2 class="text-lg font-semibold">{m['stripeConnect.paymentProcessing']()}</h2>
	</div>

	<!-- Success Message (when returning from Stripe) -->
	{#if justConnected}
		<div
			class="flex items-center gap-2 rounded-lg border border-green-200 bg-green-50 p-4 text-green-800 dark:border-green-800 dark:bg-green-950 dark:text-green-100"
			role="alert"
		>
			<Check class="h-5 w-5 shrink-0" aria-hidden="true" />
			<div>
				<p class="font-medium">{m['stripeConnect.welcomeBack']()}</p>
				<p class="text-sm">{m['stripeConnect.verifyingAccount']()}</p>
			</div>
		</div>
	{/if}

	<!-- Connection Status Card -->
	<Card
		class="border-2 p-4 {status.color === 'green'
			? 'border-green-200 bg-green-50 dark:border-green-800 dark:bg-green-950/30'
			: status.color === 'yellow'
				? 'border-yellow-200 bg-yellow-50 dark:border-yellow-800 dark:bg-yellow-950/30'
				: status.color === 'red'
					? 'border-red-200 bg-red-50 dark:border-red-800 dark:bg-red-950/30'
					: 'border-border bg-muted'}"
	>
		<div class="flex items-start gap-3">
			<!-- Icon -->
			<div class="shrink-0">
				{#if status.type === 'fully-connected'}
					<div class="rounded-full bg-green-600 p-2">
						<Check class="h-5 w-5 text-white" aria-hidden="true" />
					</div>
				{:else if status.type === 'incomplete'}
					<div class="rounded-full bg-yellow-600 p-2">
						<AlertTriangle class="h-5 w-5 text-white" aria-hidden="true" />
					</div>
				{:else if status.type === 'restricted'}
					<div class="rounded-full bg-red-600 p-2">
						<AlertCircle class="h-5 w-5 text-white" aria-hidden="true" />
					</div>
				{:else if status.type === 'loading'}
					<div class="rounded-full bg-blue-600 p-2">
						<div
							class="h-5 w-5 animate-spin rounded-full border-2 border-white border-t-transparent"
							aria-hidden="true"
						></div>
					</div>
				{:else}
					<div class="rounded-full bg-gray-400 p-2">
						<CreditCard class="h-5 w-5 text-white" aria-hidden="true" />
					</div>
				{/if}
			</div>

			<!-- Content -->
			<div class="flex-1">
				<h3
					class="font-semibold {status.color === 'green'
						? 'text-green-900 dark:text-green-100'
						: status.color === 'yellow'
							? 'text-yellow-900 dark:text-yellow-100'
							: status.color === 'red'
								? 'text-red-900 dark:text-red-100'
								: 'text-foreground'}"
				>
					{status.title}
				</h3>
				<p
					class="mt-1 text-sm {status.color === 'green'
						? 'text-green-800 dark:text-green-200'
						: status.color === 'yellow'
							? 'text-yellow-800 dark:text-yellow-200'
							: status.color === 'red'
								? 'text-red-800 dark:text-red-200'
								: 'text-muted-foreground'}"
				>
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
									<Check class="h-3 w-3 text-green-600" aria-hidden="true" />
									<span class="text-green-700 dark:text-green-300">{m['stripeConnect.yes']()}</span>
								{:else}
									<AlertCircle class="h-3 w-3 text-yellow-600" aria-hidden="true" />
									<span class="text-yellow-700 dark:text-yellow-300">{m['stripeConnect.no']()}</span
									>
								{/if}
							</dd>
						</div>
						<div>
							<dt class="font-medium text-muted-foreground">
								{m['stripeConnect.chargesEnabled']()}
							</dt>
							<dd class="mt-0.5 flex items-center gap-1">
								{#if chargesEnabled}
									<Check class="h-3 w-3 text-green-600" aria-hidden="true" />
									<span class="text-green-700 dark:text-green-300">{m['stripeConnect.yes']()}</span>
								{:else}
									<AlertCircle class="h-3 w-3 text-red-600" aria-hidden="true" />
									<span class="text-red-700 dark:text-red-300">{m['stripeConnect.no']()}</span>
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
			class="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-red-800 dark:border-red-800 dark:bg-red-950 dark:text-red-100"
			role="alert"
		>
			<AlertCircle class="h-4 w-4 shrink-0" aria-hidden="true" />
			<p class="text-sm">{connectMutation.error.message}</p>
		</div>
	{/if}

	{#if verifyQuery?.error}
		<div
			class="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-red-800 dark:border-red-800 dark:bg-red-950 dark:text-red-100"
			role="alert"
		>
			<AlertCircle class="h-4 w-4 shrink-0" aria-hidden="true" />
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
						Connecting...
					{:else}
						<ExternalLink class="h-4 w-4" aria-hidden="true" />
						{isConnected ? 'Complete Stripe Setup' : 'Connect with Stripe'}
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
						Verifying...
					{:else}
						<Check class="h-4 w-4" aria-hidden="true" />
						Verify Account Status
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
					Go to Stripe Dashboard
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
					{isConnected ? 'Complete Stripe Setup' : 'Connect with Stripe'}
				</Button>
			{/if}

			{#if isConnected}
				<Button disabled variant="outline" class="inline-flex items-center gap-2">
					<Check class="h-4 w-4" aria-hidden="true" />
					Verify Account Status
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
					Go to Stripe Dashboard
					<ExternalLink class="h-3 w-3" aria-hidden="true" />
				</a>
			{/if}
		</div>
	{/if}

	<!-- Informational Text -->
	<div class="rounded-md bg-muted p-4 text-sm text-muted-foreground">
		<p class="font-medium">{m['stripeConnect.aboutStripeConnect']()}</p>
		<p class="mt-1">
			Stripe Connect allows you to accept online payments for event tickets. When you connect your
			Stripe account, you'll be able to:
		</p>
		<ul class="mt-2 list-inside list-disc space-y-1">
			<li>{m['stripeConnect.acceptPayments']()}</li>
			<li>{m['stripeConnect.offerPWYC']()}</li>
			<li>{m['stripeConnect.manageRefunds']()}</li>
			<li>{m['stripeConnect.accessAnalytics']()}</li>
		</ul>
		<p class="mt-2 text-xs">
			Revel uses Stripe Connect to securely process payments. Your Stripe account is separate from
			Revel and you maintain full control over your funds.
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
