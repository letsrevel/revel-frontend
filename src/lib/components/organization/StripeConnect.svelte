<script lang="ts">
	import { createQuery, createMutation } from '@tanstack/svelte-query';
	import { Button } from '$lib/components/ui/button';
	import { Card } from '$lib/components/ui/card';
	import { AlertCircle, Check, ExternalLink, CreditCard, AlertTriangle } from 'lucide-svelte';
	import { onMount } from 'svelte';
	import {
		organizationadminStripeConnect,
		organizationadminStripeAccountVerify
	} from '$lib/api/generated/sdk.gen';
	import type {
		StripeOnboardingLinkSchema,
		StripeAccountStatusSchema
	} from '$lib/api/generated/types.gen';

	interface Props {
		organizationSlug: string;
		isConnected: boolean;
		accessToken: string;
	}

	let { organizationSlug, isConnected, accessToken }: Props = $props();

	// Check if user just returned from Stripe onboarding
	let justConnected = $state(false);

	onMount(() => {
		const urlParams = new URLSearchParams(window.location.search);
		if (urlParams.get('stripe') === 'success') {
			justConnected = true;
			// Remove the query parameter from URL
			const cleanUrl = window.location.pathname;
			window.history.replaceState({}, '', cleanUrl);
		}
	});

	// Query to verify Stripe account status
	const verifyQuery = createQuery<StripeAccountStatusSchema>(() => ({
		queryKey: ['stripe-status', organizationSlug],
		queryFn: async () => {
			const response = await organizationadminStripeAccountVerify({
				path: { slug: organizationSlug },
				headers: { Authorization: `Bearer ${accessToken}` }
			});

			if (response.error) {
				throw new Error('Failed to verify Stripe account');
			}

			return response.data!;
		},
		enabled: isConnected // Only run if organization claims to be connected
	}));

	// Mutation to get Stripe onboarding link
	const connectMutation = createMutation<StripeOnboardingLinkSchema, Error>(() => ({
		mutationFn: async () => {
			const response = await organizationadminStripeConnect({
				path: { slug: organizationSlug },
				headers: { Authorization: `Bearer ${accessToken}` }
			});

			if (response.error) {
				throw new Error('Failed to create Stripe Connect link');
			}

			return response.data!;
		},
		onSuccess: (data) => {
			// Add success parameter so we can detect when user returns
			const returnUrl = `${window.location.pathname}?stripe=success`;
			// Redirect to Stripe onboarding with return URL
			const onboardingUrl = new URL(data.onboarding_url);
			window.location.href = onboardingUrl.toString();
		}
	}));

	// Handle connect button click
	function handleConnect() {
		$connectMutation.mutate();
	}

	// Determine overall status
	let status = $derived.by(() => {
		if (!isConnected) {
			return {
				type: 'not-connected',
				title: 'Stripe Not Connected',
				message: 'Connect your Stripe account to accept online payments for events.',
				color: 'gray'
			};
		}

		const verifyData = $verifyQuery?.data;
		if (!verifyData) {
			return {
				type: 'loading',
				title: 'Checking Connection...',
				message: 'Verifying your Stripe account status.',
				color: 'blue'
			};
		}

		if (verifyData.charges_enabled && verifyData.details_submitted) {
			return {
				type: 'fully-connected',
				title: 'Stripe Connected',
				message: 'Your Stripe account is fully set up and ready to accept payments.',
				color: 'green'
			};
		}

		if (!verifyData.details_submitted) {
			return {
				type: 'incomplete',
				title: 'Setup Incomplete',
				message: 'Complete your Stripe onboarding to start accepting payments.',
				color: 'yellow'
			};
		}

		if (!verifyData.charges_enabled) {
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
		<h2 class="text-lg font-semibold">Payment Processing</h2>
	</div>

	<!-- Success Message (when returning from Stripe) -->
	{#if justConnected}
		<div
			class="flex items-center gap-2 rounded-lg border border-green-200 bg-green-50 p-4 text-green-800 dark:border-green-800 dark:bg-green-950 dark:text-green-100"
			role="alert"
		>
			<Check class="h-5 w-5 shrink-0" aria-hidden="true" />
			<div>
				<p class="font-medium">Welcome back!</p>
				<p class="text-sm">We're verifying your Stripe account connection...</p>
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
				{#if $verifyQuery.data}
					<dl class="mt-3 grid grid-cols-2 gap-2 text-xs">
						<div>
							<dt class="font-medium text-muted-foreground">Details Submitted</dt>
							<dd class="mt-0.5 flex items-center gap-1">
								{#if $verifyQuery.data.details_submitted}
									<Check class="h-3 w-3 text-green-600" aria-hidden="true" />
									<span class="text-green-700 dark:text-green-300">Yes</span>
								{:else}
									<AlertCircle class="h-3 w-3 text-yellow-600" aria-hidden="true" />
									<span class="text-yellow-700 dark:text-yellow-300">No</span>
								{/if}
							</dd>
						</div>
						<div>
							<dt class="font-medium text-muted-foreground">Charges Enabled</dt>
							<dd class="mt-0.5 flex items-center gap-1">
								{#if $verifyQuery.data.charges_enabled}
									<Check class="h-3 w-3 text-green-600" aria-hidden="true" />
									<span class="text-green-700 dark:text-green-300">Yes</span>
								{:else}
									<AlertCircle class="h-3 w-3 text-red-600" aria-hidden="true" />
									<span class="text-red-700 dark:text-red-300">No</span>
								{/if}
							</dd>
						</div>
					</dl>
				{/if}
			</div>
		</div>
	</Card>

	<!-- Error Display -->
	{#if $connectMutation.error}
		<div
			class="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-red-800 dark:border-red-800 dark:bg-red-950 dark:text-red-100"
			role="alert"
		>
			<AlertCircle class="h-4 w-4 shrink-0" aria-hidden="true" />
			<p class="text-sm">{$connectMutation.error.message}</p>
		</div>
	{/if}

	{#if $verifyQuery.error}
		<div
			class="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-red-800 dark:border-red-800 dark:bg-red-950 dark:text-red-100"
			role="alert"
		>
			<AlertCircle class="h-4 w-4 shrink-0" aria-hidden="true" />
			<p class="text-sm">Failed to verify Stripe account status</p>
		</div>
	{/if}

	<!-- Action Buttons -->
	<div class="flex items-center gap-3">
		{#if !isConnected || status.type === 'incomplete' || status.type === 'restricted'}
			<Button
				onclick={handleConnect}
				disabled={$connectMutation.isPending}
				class="inline-flex items-center gap-2"
			>
				{#if $connectMutation.isPending}
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
				onclick={() => $verifyQuery.refetch()}
				disabled={$verifyQuery.isFetching}
				class="inline-flex items-center gap-2"
			>
				{#if $verifyQuery.isFetching}
					<div
						class="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent"
						aria-hidden="true"
					></div>
					Checking...
				{:else}
					Refresh Status
				{/if}
			</Button>
		{/if}
	</div>

	<!-- Informational Text -->
	<div class="rounded-md bg-muted p-4 text-sm text-muted-foreground">
		<p class="font-medium">About Stripe Connect</p>
		<p class="mt-1">
			Stripe Connect allows you to accept online payments for event tickets. When you connect your
			Stripe account, you'll be able to:
		</p>
		<ul class="mt-2 list-inside list-disc space-y-1">
			<li>Accept credit and debit card payments</li>
			<li>Offer Pay What You Can pricing</li>
			<li>Manage refunds and disputes</li>
			<li>Access detailed payment analytics</li>
		</ul>
		<p class="mt-2 text-xs">
			Revel uses Stripe Connect to securely process payments. Your Stripe account is separate from
			Revel and you maintain full control over your funds.
		</p>
	</div>
</section>
