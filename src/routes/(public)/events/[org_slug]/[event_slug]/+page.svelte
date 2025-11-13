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
	import DietarySummary from '$lib/components/events/DietarySummary.svelte';
	import EventResources from '$lib/components/events/EventResources.svelte';
	import AttendeeList from '$lib/components/events/AttendeeList.svelte';
	import TicketTierList from '$lib/components/tickets/TicketTierList.svelte';
	import MyTicket from '$lib/components/tickets/MyTicket.svelte';
	import TicketTierModal from '$lib/components/tickets/TicketTierModal.svelte';
	import MyTicketModal from '$lib/components/tickets/MyTicketModal.svelte';
	import GuestRsvpDialog from '$lib/components/events/GuestRsvpDialog.svelte';
	import GuestTicketDialog from '$lib/components/events/GuestTicketDialog.svelte';
	import { generateEventStructuredData, structuredDataToJsonLd } from '$lib/utils/structured-data';
	import { generateEventMeta } from '$lib/utils/seo';
	import { isRSVP, isTicket } from '$lib/utils/eligibility';
	import { getPotluckPermissions } from '$lib/utils/permissions';
	import { formatEventLocation } from '$lib/utils/event';
	import { onMount } from 'svelte';
	import { browser } from '$app/environment';
	import * as m from '$lib/paraglide/messages.js';

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

	// Generate comprehensive meta tags
	let metaTags = $derived(generateEventMeta(event, `${page.url.origin}${page.url.pathname}`));

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
	let showGuestRsvpDialog = $state(false);
	let showGuestTicketDialog = $state(false);
	let selectedTierForGuest = $state<TierSchemaWithId | null>(null);

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

	// Guest dialog handlers
	function openGuestRsvpDialog() {
		showGuestRsvpDialog = true;
	}

	function closeGuestRsvpDialog() {
		showGuestRsvpDialog = false;
	}

	function openGuestTicketDialog(tier?: TierSchemaWithId) {
		if (tier) {
			selectedTierForGuest = tier;
		}
		showGuestTicketDialog = true;
	}

	function closeGuestTicketDialog() {
		showGuestTicketDialog = false;
		selectedTierForGuest = null;
	}

	function handleGuestAttendanceSuccess() {
		// Optionally refresh data or show a message
		queryClient.invalidateQueries({ queryKey: ['event-status', event.id] });
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

	async function handleCheckout(tierId: string, isPwyc: boolean, amount?: number) {
		if (isPwyc && amount !== undefined) {
			// PWYC checkout with amount from confirmation dialog
			pwycCheckoutMutation.mutate({ tierId, amount });
		} else {
			// Direct checkout for fixed-price tiers
			checkoutMutation.mutate(tierId);
		}
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
					throw new Error(
						typeof errorDetail === 'string' ? errorDetail : 'Failed to resume checkout'
					);
				}
				return response.data;
			} else {
				// Fixed price or free
				const response = await eventTicketCheckout({
					path: { event_id: event.id, tier_id: tierId }
				});
				if (response.error) {
					const errorDetail = (response.error as any)?.detail || 'Failed to resume checkout';
					throw new Error(
						typeof errorDetail === 'string' ? errorDetail : 'Failed to resume checkout'
					);
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

	// Handle guest confirmation redirects
	let rsvpConfirmed = $state<string | null>(null); // 'yes' | 'no' | 'maybe'
	let ticketConfirmed = $state(false);

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

			// Check for RSVP confirmation
			const rsvpParam = urlParams.get('rsvp');
			if (rsvpParam && ['yes', 'no', 'maybe'].includes(rsvpParam)) {
				rsvpConfirmed = rsvpParam;
				// Remove parameter from URL
				const cleanUrl = window.location.pathname;
				window.history.replaceState({}, '', cleanUrl);

				// Refresh event status
				queryClient.invalidateQueries({ queryKey: ['event-status', event.id] });
			}

			// Check for ticket confirmation
			if (urlParams.get('ticket_id')) {
				ticketConfirmed = true;
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
		}
	});
</script>

<svelte:head>
	<title>{metaTags.title}</title>
	<meta name="description" content={metaTags.description} />
	{#if metaTags.canonical}
		<link rel="canonical" href={metaTags.canonical} />
	{/if}

	<!-- Open Graph -->
	<meta property="og:type" content={metaTags.ogType || 'website'} />
	<meta property="og:title" content={metaTags.ogTitle || metaTags.title} />
	<meta property="og:description" content={metaTags.ogDescription || metaTags.description} />
	{#if metaTags.ogImage}
		<meta property="og:image" content={metaTags.ogImage} />
		<meta property="og:image:width" content="1200" />
		<meta property="og:image:height" content="630" />
		<meta property="og:image:alt" content={`${event.name} cover image`} />
	{/if}
	<meta property="og:url" content={metaTags.ogUrl || page.url.href} />
	<meta property="og:site_name" content="Revel" />
	<meta property="og:locale" content="en_US" />

	<!-- Twitter Card -->
	<meta name="twitter:card" content={metaTags.twitterCard || 'summary_large_image'} />
	<meta name="twitter:title" content={metaTags.twitterTitle || metaTags.title} />
	<meta name="twitter:description" content={metaTags.twitterDescription || metaTags.description} />
	{#if metaTags.twitterImage}
		<meta name="twitter:image" content={metaTags.twitterImage} />
		<meta name="twitter:image:alt" content={`${event.name} cover image`} />
	{/if}

	<!-- Additional SEO meta tags -->
	<meta name="robots" content="index, follow" />
	<meta name="author" content={event.organization.name} />

	<!-- Event-specific meta tags -->
	{#if event.start}
		<meta property="event:start_time" content={event.start} />
	{/if}
	{#if event.end}
		<meta property="event:end_time" content={event.end} />
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
					<p class="font-medium">{m['eventDetails.payment_successTitle']()}</p>
					<p class="text-sm">{m['eventDetails.payment_successMessage']()}</p>
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
					<p class="font-medium">{m['eventDetails.payment_cancelledTitle']()}</p>
					<p class="text-sm">{m['eventDetails.payment_cancelledMessage']()}</p>
				</div>
			</div>
		</div>
	{/if}

	<!-- RSVP Confirmation Message -->
	{#if rsvpConfirmed}
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
					<p class="font-medium">{m['guest_attendance.rsvp_confirmed_title']()}</p>
					<p class="text-sm">{m['guest_attendance.rsvp_confirmed_body']()}</p>
				</div>
			</div>
		</div>
	{/if}

	<!-- Ticket Confirmation Message -->
	{#if ticketConfirmed}
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
					<p class="font-medium">{m['guest_attendance.ticket_confirmed_title']()}</p>
					<p class="text-sm">{m['guest_attendance.ticket_confirmed_body']()}</p>
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
				eventTokenDetails={data.eventTokenDetails}
				variant="card"
				canAttendWithoutLogin={event.can_attend_without_login}
				onGetTicketsClick={openTicketTierModal}
				onShowTicketClick={openMyTicketModal}
				onResumePayment={handleResumePayment}
				isResumingPayment={resumePaymentMutation.isPending}
				onGuestRsvpClick={openGuestRsvpDialog}
				onGuestTicketClick={openGuestTicketDialog}
			/>
		</div>

		<div class="grid gap-8 lg:grid-cols-3">
			<!-- Left Column: Event Details -->
			<div class="space-y-8 lg:col-span-2">
				<EventDetails {event} />

				<!-- Potluck Coordination Section -->
				<!-- Show if potluck is open OR if there are existing items -->
				{#if event.potluck_open || data.potluckItems.length > 0}
					<div class="space-y-6">
						<!-- Dietary Summary -->
						<DietarySummary
							eventId={event.id}
							authToken={data.accessToken}
							isAuthenticated={data.isAuthenticated}
						/>

						<!-- Potluck Items -->
						<PotluckSection
							{event}
							permissions={potluckPermissions}
							isAuthenticated={data.isAuthenticated}
							{hasRSVPd}
							initialItems={data.potluckItems}
						/>
					</div>
				{/if}

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
						{userStatus}
						eventId={event.id}
						eventSlug={event.slug}
						organizationSlug={event.organization.slug}
						eventName={event.name}
						eventTokenDetails={data.eventTokenDetails}
						canAttendWithoutLogin={event.can_attend_without_login}
						onClaimTicket={handleClaimTicket}
						onCheckout={handleCheckout}
						onGuestTierClick={openGuestTicketDialog}
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

				<!-- Event Series (mobile only) -->
				{#if event.event_series}
					<section
						aria-labelledby="series-heading-mobile"
						class="rounded-lg border bg-card lg:hidden"
					>
						<div class="border-b p-4">
							<h2 id="series-heading-mobile" class="font-semibold">
								{m['eventDetails.series_heading']()}
							</h2>
						</div>
						<a
							href="/events/{event.organization.slug}/series/{event.event_series.slug}"
							class="block p-4 transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
						>
							<div class="font-medium">{event.event_series.name}</div>
							{#if event.event_series.description_html}
								<div class="prose prose-sm dark:prose-invert mt-1 text-sm text-muted-foreground">
									{@html event.event_series.description_html}
								</div>
							{:else if event.event_series.description}
								<p class="mt-1 text-sm text-muted-foreground">
									{event.event_series.description}
								</p>
							{/if}
						</a>
					</section>
				{/if}

				<!-- Attendee List (mobile only) -->
				<div class="lg:hidden">
					<AttendeeList
						eventId={event.id}
						totalAttendees={event.attendee_count}
						isAuthenticated={data.isAuthenticated}
					/>
				</div>
			</div>

			<!-- Right Column: Action Sidebar (desktop only) -->
			<aside class="hidden lg:col-span-1 lg:block">
				<div class="sticky top-4 space-y-6">
					<EventActionSidebar
						{event}
						bind:userStatus
						isAuthenticated={data.isAuthenticated}
						userPermissions={data.userPermissions}
						eventTokenDetails={data.eventTokenDetails}
						variant="card"
						canAttendWithoutLogin={event.can_attend_without_login}
						onGetTicketsClick={openTicketTierModal}
						onShowTicketClick={openMyTicketModal}
						onResumePayment={handleResumePayment}
						isResumingPayment={resumePaymentMutation.isPending}
						onGuestRsvpClick={openGuestRsvpDialog}
						onGuestTicketClick={openGuestTicketDialog}
					/>

					<!-- Organization Info (desktop only) -->
					<OrganizationInfo
						organization={event.organization}
						isAuthenticated={data.isAuthenticated}
						isMember={data.isMember}
						isOwner={data.isOwner}
						isStaff={data.isStaff}
					/>

					<!-- Event Series (desktop only) -->
					{#if event.event_series}
						<section aria-labelledby="series-heading-desktop" class="rounded-lg border bg-card">
							<div class="border-b p-4">
								<h2 id="series-heading-desktop" class="font-semibold">
									{m['eventDetails.series_heading']()}
								</h2>
							</div>
							<a
								href="/events/{event.organization.slug}/series/{event.event_series.slug}"
								class="block p-4 transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
							>
								<div class="font-medium">{event.event_series.name}</div>
								{#if event.event_series.description_html}
									<div class="prose prose-sm dark:prose-invert mt-1 text-sm text-muted-foreground">
										{@html event.event_series.description_html}
									</div>
								{:else if event.event_series.description}
									<p class="mt-1 text-sm text-muted-foreground">
										{event.event_series.description}
									</p>
								{/if}
							</a>
						</section>
					{/if}

					<!-- Attendee List (desktop only) -->
					<AttendeeList
						eventId={event.id}
						totalAttendees={event.attendee_count}
						isAuthenticated={data.isAuthenticated}
					/>
				</div>
			</aside>
		</div>

		<!-- Tags Section (bottom of page) -->
		{#if event.tags && event.tags.length > 0}
			<section aria-labelledby="tags-heading" class="container mx-auto border-t px-6 py-8 md:px-8">
				<h2 id="tags-heading" class="mb-4 text-xl font-semibold">
					{m['eventDetails.tags_heading']()}
				</h2>
				<div class="flex flex-wrap gap-2">
					{#each event.tags as tag (tag)}
						<span class="rounded-full bg-primary/10 px-3 py-1 text-sm font-medium text-primary">
							{tag}
						</span>
					{/each}
				</div>
			</section>
		{/if}
	</div>
</div>

<!-- Ticket Tier Selection Modal -->
<TicketTierModal
	bind:open={showTicketTierModal}
	tiers={ticketTiers}
	isAuthenticated={data.isAuthenticated}
	hasTicket={!!userTicket}
	canAttendWithoutLogin={event.can_attend_without_login}
	onClose={closeTicketTierModal}
	onClaimTicket={handleClaimTicket}
	onCheckout={handleCheckout}
	onGuestTierClick={openGuestTicketDialog}
/>

<!-- My Ticket Modal -->
{#if userTicket}
	<MyTicketModal
		bind:open={showMyTicketModal}
		ticket={userTicket}
		eventName={event.name}
		eventDate={event.start ? new Date(event.start).toLocaleString() : undefined}
		eventLocation={formatEventLocation(event)}
		onResumePayment={handleResumePayment}
		isResumingPayment={resumePaymentMutation.isPending}
	/>
{/if}

<!-- Guest RSVP Dialog -->
{#if !data.isAuthenticated && event.can_attend_without_login && !event.requires_ticket}
	<GuestRsvpDialog
		bind:open={showGuestRsvpDialog}
		eventId={event.id}
		eventName={event.name}
		onClose={closeGuestRsvpDialog}
		onSuccess={handleGuestAttendanceSuccess}
	/>
{/if}

<!-- Guest Ticket Dialog -->
{#if !data.isAuthenticated && event.can_attend_without_login && event.requires_ticket && selectedTierForGuest}
	<GuestTicketDialog
		bind:open={showGuestTicketDialog}
		eventId={event.id}
		eventName={event.name}
		tier={selectedTierForGuest}
		onClose={closeGuestTicketDialog}
		onSuccess={handleGuestAttendanceSuccess}
	/>
{/if}
