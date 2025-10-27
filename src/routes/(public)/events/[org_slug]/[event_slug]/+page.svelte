<script lang="ts">
	import type { PageData } from './$types';
	import { page } from '$app/state';
	import { createMutation, useQueryClient } from '@tanstack/svelte-query';
	import { eventTicketCheckout, eventTicketPwycCheckout } from '$lib/api';
	import type { TierSchemaWithId } from '$lib/types/tickets';
	import EventHeader from '$lib/components/events/EventHeader.svelte';
	import EventDetails from '$lib/components/events/EventDetails.svelte';
	import EventActionSidebar from '$lib/components/events/EventActionSidebar.svelte';
	import OrganizationInfo from '$lib/components/events/OrganizationInfo.svelte';
	import PotluckSection from '$lib/components/events/PotluckSection.svelte';
	import EventResources from '$lib/components/events/EventResources.svelte';
	import TicketTierList from '$lib/components/tickets/TicketTierList.svelte';
	import MyTicket from '$lib/components/tickets/MyTicket.svelte';
	import TicketTierModal from '$lib/components/tickets/TicketTierModal.svelte';
	import MyTicketModal from '$lib/components/tickets/MyTicketModal.svelte';
	import PWYCModal from '$lib/components/tickets/PWYCModal.svelte';
	import { generateEventStructuredData, structuredDataToJsonLd } from '$lib/utils/structured-data';
	import { isRSVP, isTicket } from '$lib/utils/eligibility';
	import { getPotluckPermissions } from '$lib/utils/permissions';
	import { formatEventLocation } from '$lib/utils/event';
	import { onMount } from 'svelte';
	import { browser } from '$app/environment';

	let { data }: { data: PageData } = $props();

	const queryClient = useQueryClient();

	// Create mutable copies for client-side updates
	let event = $state(data.event);
	let userStatus = $state(data.userStatus);
	let ticketTiers = $state<TierSchemaWithId[]>(data.ticketTiers as TierSchemaWithId[]);

	// Get structured data for SEO
	let structuredData = $derived(
		generateEventStructuredData(event, `${page.url.origin}${page.url.pathname}`)
	);
	let jsonLd = $derived(structuredDataToJsonLd(structuredData));

	// Check if user has RSVP'd (reactive to userStatus changes)
	let hasRSVPd = $derived.by(() => {
		if (!userStatus) return false;

		if (isRSVP(userStatus)) {
			return userStatus.status === 'yes';
		}

		if (isTicket(userStatus)) {
			return userStatus.status === 'active' || userStatus.status === 'checked_in';
		}

		return false;
	});

	// Compute permissions for potluck management
	let potluckPermissions = $derived(
		getPotluckPermissions(
			data.userPermissions,
			event.organization.id,
			event.id,
			event.potluck_open,
			hasRSVPd
		)
	);

	// Check if user has a ticket
	let userTicket = $derived.by(() => {
		if (!userStatus || !isTicket(userStatus)) return null;
		return userStatus;
	});

	// Modal states
	let showTicketTierModal = $state(false);
	let showMyTicketModal = $state(false);
	let showPWYCModal = $state(false);
	let pendingPWYCTier = $state<TierSchemaWithId | null>(null);

	// Handle modals
	function openTicketTierModal() {
		showTicketTierModal = true;
	}

	function closeTicketTierModal() {
		showTicketTierModal = false;
	}

	function openMyTicketModal() {
		showMyTicketModal = true;
	}

	function closeMyTicketModal() {
		showMyTicketModal = false;
	}

	function openPWYCModal(tier: TierSchemaWithId) {
		pendingPWYCTier = tier;
		showPWYCModal = true;
	}

	function closePWYCModal() {
		showPWYCModal = false;
		pendingPWYCTier = null;
	}

	// Ticket claiming mutation (for free/offline tickets)
	let claimTicketMutation = createMutation(() => ({
		mutationFn: async (tierId: string) => {
			const response = await eventTicketCheckout({
				path: { event_id: event.id, tier_id: tierId }
			});
			return response.data;
		},
		onSuccess: (data) => {
			// Update userStatus with new ticket
			if (data && 'status' in data) {
				userStatus = data as any;
			}
			// Invalidate event status query
			queryClient.invalidateQueries({ queryKey: ['event-status', event.id] });
		}
	}));

	// Fixed-price checkout mutation (for online payments)
	let checkoutMutation = createMutation(() => ({
		mutationFn: async (tierId: string) => {
			const response = await eventTicketCheckout({
				path: { event_id: event.id, tier_id: tierId }
			});
			if (response.error) {
				const errorDetail = (response.error as any)?.detail || 'Failed to checkout';
				throw new Error(typeof errorDetail === 'string' ? errorDetail : 'Failed to checkout');
			}
			return response.data;
		},
		onSuccess: (data) => {
			if (!data) return;

			// Check if we got a ticket directly (special permissions)
			if ('status' in data) {
				userStatus = data as any;
				queryClient.invalidateQueries({ queryKey: ['event-status', event.id] });
			}
			// Check if we got a checkout URL (redirect to Stripe)
			else if ('checkout_url' in data) {
				window.location.href = data.checkout_url;
			}
		}
	}));

	// PWYC checkout mutation
	let pwycCheckoutMutation = createMutation(() => ({
		mutationFn: async ({ tierId, amount }: { tierId: string; amount: number }) => {
			const response = await eventTicketPwycCheckout({
				path: { event_id: event.id, tier_id: tierId },
				body: { pwyc: amount }
			});
			if (response.error) {
				const errorDetail = (response.error as any)?.detail || 'Failed to checkout';
				throw new Error(typeof errorDetail === 'string' ? errorDetail : 'Failed to checkout');
			}
			return response.data;
		},
		onSuccess: (data) => {
			if (!data) return;

			// Close PWYC modal
			closePWYCModal();

			// Check if we got a ticket directly (special permissions)
			if ('status' in data) {
				userStatus = data as any;
				queryClient.invalidateQueries({ queryKey: ['event-status', event.id] });
			}
			// Check if we got a checkout URL (redirect to Stripe)
			else if ('checkout_url' in data) {
				window.location.href = data.checkout_url;
			}
		}
	}));

	async function handleClaimTicket(tierId: string) {
		claimTicketMutation.mutate(tierId);
	}

	async function handleCheckout(tierId: string, isPwyc: boolean) {
		if (isPwyc) {
			// Find the tier and open PWYC modal
			const tier = ticketTiers.find((t) => t.id === tierId);
			if (tier) {
				openPWYCModal(tier);
			}
		} else {
			// Direct checkout for fixed-price tiers
			checkoutMutation.mutate(tierId);
		}
	}

	async function handlePWYCConfirm(amount: number) {
		if (!pendingPWYCTier) return;
		pwycCheckoutMutation.mutate({ tierId: pendingPWYCTier.id, amount });
	}

	// Resume payment mutation (for pending tickets)
	let resumePaymentMutation = createMutation(() => ({
		mutationFn: async () => {
			if (!userTicket || !userTicket.tier?.id) {
				throw new Error('No pending ticket found');
			}

			const tierId = userTicket.tier.id;

			// For PWYC tiers, we need the original amount (use minimum as default)
			if (userTicket.tier.price_type === 'pwyc') {
				const amount = userTicket.tier.pwyc_min || userTicket.tier.price || 1;
				const response = await eventTicketPwycCheckout({
					path: { event_id: event.id, tier_id: tierId },
					body: { pwyc: amount }
				});
				if (response.error) {
					const errorDetail = (response.error as any)?.detail || 'Failed to resume checkout';
					throw new Error(typeof errorDetail === 'string' ? errorDetail : 'Failed to resume checkout');
				}
				return response.data;
			} else {
				// Fixed price or free
				const response = await eventTicketCheckout({
					path: { event_id: event.id, tier_id: tierId }
				});
				if (response.error) {
					const errorDetail = (response.error as any)?.detail || 'Failed to resume checkout';
					throw new Error(typeof errorDetail === 'string' ? errorDetail : 'Failed to resume checkout');
				}
				return response.data;
			}
		},
		onSuccess: (data) => {
			if (!data) return;

			// Check if we got a checkout URL (redirect to Stripe)
			if ('checkout_url' in data) {
				window.location.href = data.checkout_url;
			}
			// If we got a ticket directly, update userStatus
			else if ('status' in data) {
				userStatus = data as any;
				queryClient.invalidateQueries({ queryKey: ['event-status', event.id] });
			}
		}
	}));

	function handleResumePayment() {
		resumePaymentMutation.mutate();
	}

	// Handle payment success/cancelled redirects
	let paymentSuccess = $state(false);
	let paymentCancelled = $state(false);

	onMount(() => {
		if (browser) {
			const urlParams = new URLSearchParams(window.location.search);

			// Check for payment success
			if (urlParams.get('payment_success') === 'true') {
				paymentSuccess = true;
				// Remove parameter from URL
				const cleanUrl = window.location.pathname;
				window.history.replaceState({}, '', cleanUrl);

				// Refresh event status to get the ticket
				queryClient.invalidateQueries({ queryKey: ['event-status', event.id] });

				// Auto-open ticket modal after a delay
				setTimeout(() => {
					if (userTicket) {
						openMyTicketModal();
					}
				}, 1000);
			}

			// Check for payment cancelled
			if (urlParams.get('payment_cancelled') === 'true') {
				paymentCancelled = true;
				// Remove parameter from URL
				const cleanUrl = window.location.pathname;
				window.history.replaceState({}, '', cleanUrl);
			}
		}
	});
</script>

<svelte:head>
	<title>{event.name} | Revel</title>
	<meta
		name="description"
		content={event.description?.slice(0, 160) ||
			`Join ${event.name} organized by ${event.organization.name}`}
	/>

	<!-- Open Graph -->
	<meta property="og:type" content="event" />
	<meta property="og:title" content={event.name} />
	<meta property="og:description" content={event.description || `Join ${event.name}`} />
	{#if event.cover_art}
		<meta property="og:image" content={event.cover_art} />
	{/if}
	<meta property="og:url" content={page.url.href} />

	<!-- Twitter Card -->
	<meta name="twitter:card" content="summary_large_image" />
	<meta name="twitter:title" content={event.name} />
	<meta
		name="twitter:description"
		content={event.description?.slice(0, 200) || `Join ${event.name}`}
	/>
	{#if event.cover_art}
		<meta name="twitter:image" content={event.cover_art} />
	{/if}

	<!-- Structured Data (JSON-LD) -->
	{@html `<script type="application/ld+json">${jsonLd}<\/script>`}
</svelte:head>

<div class="min-h-screen bg-background">
	<!-- Payment Success Message -->
	{#if paymentSuccess}
		<div class="container mx-auto px-6 pt-4 md:px-8">
			<div
				class="flex items-center gap-2 rounded-lg border border-green-200 bg-green-50 p-4 text-green-800 dark:border-green-800 dark:bg-green-950 dark:text-green-100"
				role="alert"
			>
				<svg class="h-5 w-5 shrink-0" fill="currentColor" viewBox="0 0 20 20" aria-hidden="true">
					<path
						fill-rule="evenodd"
						d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.857-9.809a.75.75 0 00-1.214-.882l-3.483 4.79-1.88-1.88a.75.75 0 10-1.06 1.061l2.5 2.5a.75.75 0 001.137-.089l4-5.5z"
						clip-rule="evenodd"
					/>
				</svg>
				<div>
					<p class="font-medium">Payment successful!</p>
					<p class="text-sm">Your ticket has been confirmed. Check your email for details.</p>
				</div>
			</div>
		</div>
	{/if}

	<!-- Payment Cancelled Message -->
	{#if paymentCancelled}
		<div class="container mx-auto px-6 pt-4 md:px-8">
			<div
				class="flex items-center gap-2 rounded-lg border border-yellow-200 bg-yellow-50 p-4 text-yellow-800 dark:border-yellow-800 dark:bg-yellow-950 dark:text-yellow-100"
				role="alert"
			>
				<svg class="h-5 w-5 shrink-0" fill="currentColor" viewBox="0 0 20 20" aria-hidden="true">
					<path
						fill-rule="evenodd"
						d="M8.485 2.495c.673-1.167 2.357-1.167 3.03 0l6.28 10.875c.673 1.167-.17 2.625-1.516 2.625H3.72c-1.347 0-2.189-1.458-1.515-2.625L8.485 2.495zM10 5a.75.75 0 01.75.75v3.5a.75.75 0 01-1.5 0v-3.5A.75.75 0 0110 5zm0 9a1 1 0 100-2 1 1 0 000 2z"
						clip-rule="evenodd"
					/>
				</svg>
				<div>
					<p class="font-medium">Payment cancelled</p>
					<p class="text-sm">You can try again anytime.</p>
				</div>
			</div>
		</div>
	{/if}

	<!-- Event Header -->
	<EventHeader {event} class="mb-8" />

	<!-- Main Content -->
	<div class="container mx-auto px-6 pb-16 md:px-8">
		<!-- Mobile Action Card (at top, prominent) -->
		<div class="mb-8 lg:hidden">
			<EventActionSidebar
				{event}
				bind:userStatus
				isAuthenticated={data.isAuthenticated}
				userPermissions={data.userPermissions}
				variant="card"
				onGetTicketsClick={openTicketTierModal}
				onShowTicketClick={openMyTicketModal}
				onResumePayment={handleResumePayment}
				isResumingPayment={resumePaymentMutation.isPending}
			/>
		</div>

		<div class="grid gap-8 lg:grid-cols-3">
			<!-- Left Column: Event Details -->
			<div class="space-y-8 lg:col-span-2">
				<EventDetails {event} />

				<!-- My Ticket (if user has a ticket) -->
				{#if userTicket}
					<MyTicket
						ticket={userTicket}
						eventName={event.name}
						eventDate={event.start ? new Date(event.start).toLocaleString() : undefined}
						eventLocation={formatEventLocation(event)}
						onResumePayment={handleResumePayment}
						isResumingPayment={resumePaymentMutation.isPending}
					/>
				{/if}

				<!-- Ticket Tiers (if event requires tickets and user doesn't have one) -->
				{#if event.requires_ticket && !userTicket && ticketTiers.length > 0}
					<TicketTierList
						tiers={ticketTiers}
						isAuthenticated={data.isAuthenticated}
						hasTicket={!!userTicket}
						onClaimTicket={handleClaimTicket}
						onCheckout={handleCheckout}
					/>
				{/if}

				<!-- Potluck Section -->
				<!-- Show if potluck is open OR if there are existing items -->
				{#if event.potluck_open || data.potluckItems.length > 0}
					<PotluckSection
						{event}
						permissions={potluckPermissions}
						isAuthenticated={data.isAuthenticated}
						{hasRSVPd}
						initialItems={data.potluckItems}
					/>
				{/if}

				<!-- Resources Section -->
				<EventResources resources={data.resources} />

				<!-- Organization Info (below details on mobile, hidden on desktop) -->
				<div class="lg:hidden">
					<OrganizationInfo
						organization={event.organization}
						isAuthenticated={data.isAuthenticated}
						isMember={data.isMember}
						isOwner={data.isOwner}
						isStaff={data.isStaff}
					/>
				</div>
			</div>

			<!-- Right Column: Action Sidebar (desktop only, sticky) -->
			<aside class="hidden lg:col-span-1 lg:block">
				<div class="space-y-6">
					<EventActionSidebar
						{event}
						bind:userStatus
						isAuthenticated={data.isAuthenticated}
						userPermissions={data.userPermissions}
						variant="sidebar"
						onGetTicketsClick={openTicketTierModal}
						onShowTicketClick={openMyTicketModal}
						onResumePayment={handleResumePayment}
						isResumingPayment={resumePaymentMutation.isPending}
					/>

					<!-- Organization Info (desktop only) -->
					<OrganizationInfo
						organization={event.organization}
						isAuthenticated={data.isAuthenticated}
						isMember={data.isMember}
						isOwner={data.isOwner}
						isStaff={data.isStaff}
					/>
				</div>
			</aside>
		</div>
	</div>
</div>

<!-- Ticket Tier Selection Modal -->
<TicketTierModal
	bind:open={showTicketTierModal}
	tiers={ticketTiers}
	isAuthenticated={data.isAuthenticated}
	hasTicket={!!userTicket}
	onClose={closeTicketTierModal}
	onClaimTicket={handleClaimTicket}
	onCheckout={handleCheckout}
/>

<!-- PWYC Modal -->
{#if pendingPWYCTier}
	<PWYCModal
		bind:open={showPWYCModal}
		tier={pendingPWYCTier}
		onClose={closePWYCModal}
		onConfirm={handlePWYCConfirm}
		isProcessing={pwycCheckoutMutation.isPending}
	/>
{/if}

<!-- My Ticket Modal -->
{#if userTicket}
	<MyTicketModal
		bind:open={showMyTicketModal}
		ticket={userTicket}
		eventName={event.name}
		eventDate={event.start ? new Date(event.start).toLocaleString() : undefined}
		eventLocation={formatEventLocation(event)}
		onClose={closeMyTicketModal}
		onResumePayment={handleResumePayment}
		isResumingPayment={resumePaymentMutation.isPending}
	/>
{/if}
