<script lang="ts">
	import { stripeSetupState } from '$lib/utils/org-setup-progress';
	import * as m from '$lib/paraglide/messages.js';
	import { page } from '$app/stores';
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import type { PageData } from './$types';
	import EventEditor from '$lib/components/events/admin/EventEditor.svelte';
	import DuplicateEventModal from '$lib/components/events/admin/DuplicateEventModal.svelte';
	import CancelEventDialog from '$lib/components/events/admin/CancelEventDialog.svelte';
	import { createMutation, createQuery, useQueryClient } from '@tanstack/svelte-query';
	import {
		eventadmincoreCancellationRefundPreview,
		eventadmincoreUpdateEventStatus,
		eventadmincoreDeleteEvent
	} from '$lib/api/generated/sdk.gen';
	import type { EventRefundPreviewSchema } from '$lib/api/generated/types.gen';
	import { authStore } from '$lib/stores/auth.svelte';
	import * as DropdownMenu from '$lib/components/ui/dropdown-menu';
	import * as Tooltip from '$lib/components/ui/tooltip';
	import {
		CheckCircle,
		XCircle,
		FileEdit,
		Trash2,
		Ban,
		MoreVertical,
		Copy,
		RotateCcw
	} from '@lucide/svelte';
	import { extractApiErrorDetail } from '$lib/utils/api-error-detail';
	import StatusBadge from '$lib/components/common/StatusBadge.svelte';
	import PageHeader from '$lib/components/common/PageHeader.svelte';
	import { Button } from '$lib/components/ui/button';
	import { onMount } from 'svelte';
	import { invalidateAll } from '$app/navigation';
	import { SvelteURLSearchParams } from 'svelte/reactivity';
	import { organizationadmincoreStripeAccountVerify } from '$lib/api/generated/sdk.gen';
	import StripeReturnNotice, {
		type StripeNotice
	} from '$lib/components/org-setup/StripeReturnNotice.svelte';
	import EventStripeConnect from '$lib/components/events/admin/editor/EventStripeConnect.svelte';
	import PublishShareCard from '$lib/components/events/admin/editor/PublishShareCard.svelte';
	import { eventPublicLinks } from '$lib/utils/event-links';
	import type { Tone } from '$lib/components/common/tones';

	const { data }: { data: PageData } = $props();

	const organization = $derived($page.data.organization);
	const event = $derived(data.event);
	// An unknown ?tab= would leave the controlled Tabs.Root with no active
	// panel; anything but a real tab name falls back to the default.
	const initialTab = $derived.by((): 'details' | 'ticketing' | 'listings' | undefined => {
		const tab = $page.url.searchParams.get('tab');
		return tab === 'details' || tab === 'ticketing' || tab === 'listings' ? tab : undefined;
	});
	const accessToken = $derived(authStore.accessToken);
	const queryClient = useQueryClient();

	// Current status
	const currentStatus = $derived(event.status);
	const statusTone = $derived.by((): Tone => {
		switch (currentStatus) {
			case 'open':
				return 'success';
			case 'closed':
			case 'cancelled':
				return 'danger';
			case 'draft':
			default:
				return 'neutral';
		}
	});

	const statusLabel = $derived(
		currentStatus === 'draft'
			? m['eventEditPage.statusDraft']()
			: currentStatus === 'open'
				? m['eventEditPage.statusPublished']()
				: currentStatus === 'closed'
					? m['eventEditPage.statusClosed']()
					: currentStatus === 'cancelled'
						? m['eventEditPage.statusCancelled']()
						: currentStatus
	);

	// Stripe returns the owner here (ticketing tab) with ?stripe_success=true, or
	// ?stripe_refresh=true when the onboarding link expired. Same handling as the
	// /welcome page; tab=ticketing and any other params are kept.
	let stripeNotice = $state<StripeNotice | null>(null);
	let showStripeModal = $state(false);
	// The publish flow lands here with ?published=1: show the share card once.
	let justPublished = $state(false);

	onMount(() => {
		const params = new SvelteURLSearchParams(window.location.search);
		const success = params.get('stripe_success') === 'true';
		const refresh = params.get('stripe_refresh') === 'true';
		justPublished = params.get('published') === '1';
		if (!success && !refresh && !justPublished) return;
		params.delete('stripe_success');
		params.delete('stripe_refresh');
		params.delete('published');
		const query = params.toString();
		window.history.replaceState(
			window.history.state,
			'',
			window.location.pathname + (query ? `?${query}` : '')
		);

		// Stripe onboarding and its verification are owner-only: staff just get the
		// params stripped.
		if (!data.isOwner || (!success && !refresh)) return;
		if (refresh) {
			stripeNotice = 'expired';
			return;
		}
		void (async () => {
			let chargesEnabled: boolean;
			try {
				const res = await organizationadmincoreStripeAccountVerify({
					path: { slug: organization.slug },
					headers: { Authorization: `Bearer ${accessToken ?? ''}` }
				});
				chargesEnabled = !res.error && !!res.data?.charges_enabled;
			} catch {
				chargesEnabled = false;
			}
			await invalidateAll();
			stripeNotice = chargesEnabled ? 'connected' : 'needsDetails';
		})();
	});

	// Update event status mutation
	const updateStatusMutation = createMutation(() => ({
		mutationFn: async (status: 'draft' | 'open' | 'closed' | 'cancelled') => {
			if (!accessToken) throw new Error(m['eventEditPage.error_notAuthenticated']());

			const response = await eventadmincoreUpdateEventStatus({
				path: { event_id: event.id, status },
				headers: {
					Authorization: `Bearer ${accessToken}`
				}
			});

			if (response.error) {
				const errorDetail =
					extractApiErrorDetail(response.error) ?? m['eventEditPage.error_updateStatusFailed']();
				throw new Error(errorDetail);
			}

			if (!response.data) {
				throw new Error(m['eventEditPage.error_updateStatusFailed']());
			}

			return response.data;
		},
		onSuccess: (_event, status) => {
			queryClient.invalidateQueries({ queryKey: ['events'] });
			if (status === 'open' && currentStatus === 'draft') {
				// Publishing: reload onto ?published=1 so the share card shows once.
				const url = new URL(window.location.href);
				url.searchParams.set('published', '1');
				window.location.assign(url.toString());
				return;
			}
			// Reload the page to get updated event data
			window.location.reload();
		},
		onError: (error: Error) => {
			alert(m['eventEditPage.updateStatusAlert']({ message: error.message }));
		}
	}));

	// Delete event mutation (permanent deletion)
	const deleteEventMutation = createMutation(() => ({
		mutationFn: async () => {
			if (!accessToken) throw new Error(m['eventEditPage.error_notAuthenticated']());

			const response = await eventadmincoreDeleteEvent({
				path: { event_id: event.id },
				headers: {
					Authorization: `Bearer ${accessToken}`
				}
			});

			if (response.error) {
				const errorDetail =
					extractApiErrorDetail(response.error) ?? m['eventEditPage.error_deleteFailed']();
				throw new Error(errorDetail);
			}
		},
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ['events'] });
			// Redirect to events list after deletion
			goto(resolve('/(auth)/org/[slug]/admin/events', { slug: organization.slug }));
		},
		onError: (error: Error) => {
			alert(m['eventEditPage.deleteAlert']({ message: error.message }));
		}
	}));

	/**
	 * Publish event (draft → open)
	 */
	function publishEvent(): void {
		if (confirm(m['eventEditPage.publishConfirm']())) {
			updateStatusMutation.mutate('open');
		}
	}

	// Platform-relative preview link; absolute (custom-domain aware) URL to share.
	const links = $derived(eventPublicLinks(organization, event.slug, $page.data, $page.url.origin));

	/**
	 * Close event (open → closed)
	 */
	function closeEvent(): void {
		if (confirm(m['eventEditPage.closeConfirm']())) {
			updateStatusMutation.mutate('closed');
		}
	}

	/**
	 * Mark as draft (open/closed → draft)
	 */
	function markAsDraft(): void {
		if (confirm(m['eventEditPage.draftConfirm']())) {
			updateStatusMutation.mutate('draft');
		}
	}

	/**
	 * Reopen event (closed → open). Same mutation target as publish but
	 * with reopen-specific confirmation copy so admins see the right
	 * intent when transitioning from closed.
	 */
	function reopenEvent(): void {
		if (confirm(m['orgAdmin.events.confirmations.reopen']())) {
			updateStatusMutation.mutate('open');
		}
	}

	/**
	 * Cancel event (any → cancelled). Opens the dedicated dialog so the
	 * organizer can attach an optional reason; the dialog drives the
	 * mutation itself.
	 */
	function cancelEvent(): void {
		showCancelEventDialog = true;
	}

	/**
	 * Delete event (permanent deletion). Already-cancelled events get a
	 * stronger confirmation that names what just happened (attendees
	 * notified, record removal on top of that).
	 */
	function deleteEvent(): void {
		const message =
			currentStatus === 'cancelled'
				? m['orgAdmin.events.confirmations.deleteCancelled']()
				: m['orgAdmin.events.confirmations.delete']();
		if (confirm(message)) {
			deleteEventMutation.mutate();
		}
	}

	// Duplicate modal state
	let showDuplicateModal = $state(false);

	// Cancel event dialog state
	let showCancelEventDialog = $state(false);

	// Cancelled events with refundable online payments left get a
	// "Retry refunds" affordance — re-POSTing cancel-with-refunds is the
	// supported way to resume a partial sweep (idempotent on the backend).
	const refundPreviewQuery = createQuery<EventRefundPreviewSchema>(() => ({
		queryKey: ['event-cancellation-refund-preview', event.id],
		queryFn: async () => {
			const response = await eventadmincoreCancellationRefundPreview({
				path: { event_id: event.id },
				headers: { Authorization: `Bearer ${accessToken}` }
			});
			if (response.error || !response.data) throw new Error('preview-failed');
			return response.data;
		},
		enabled: currentStatus === 'cancelled' && !!accessToken,
		retry: false
	}));
	const hasRefundableTickets = $derived(
		(refundPreviewQuery.data?.online_refundable_tickets ?? 0) > 0
	);

	/**
	 * Open duplicate modal
	 */
	function openDuplicateModal(): void {
		showDuplicateModal = true;
	}

	/**
	 * Close duplicate modal
	 */
	function closeDuplicateModal(): void {
		showDuplicateModal = false;
	}
</script>

<svelte:head>
	<title
		>{m['eventEditPage.headTitle']({ eventName: event.name })} - {organization.name} Admin | Revel</title
	>
	<meta
		name="description"
		content={m['eventEditPage.headDescription']({ eventName: event.name })}
	/>
	<meta name="robots" content="noindex, nofollow" />
</svelte:head>

{#snippet lifecycleButton(
	onclick: () => void,
	label: string,
	tooltip: string,
	Icon: typeof CheckCircle,
	variant: 'default' | 'outline' | 'destructive',
	disabled: boolean
)}
	<Tooltip.Root>
		<Tooltip.Trigger>
			{#snippet child({ props })}
				<Button {...props} {variant} {onclick} {disabled}>
					<Icon aria-hidden="true" />
					{label}
				</Button>
			{/snippet}
		</Tooltip.Trigger>
		<Tooltip.Content>{tooltip}</Tooltip.Content>
	</Tooltip.Root>
{/snippet}

<div class="space-y-6">
	<PageHeader kicker={m['orgAdmin.nav.events']()} title={event.name}>
		{#snippet titleAddon()}
			<StatusBadge tone={statusTone} label={statusLabel} />
		{/snippet}
		{#snippet actions()}
			<Tooltip.Provider delayDuration={300}>
				{#if currentStatus === 'draft'}
					{@render lifecycleButton(
						publishEvent,
						m['eventEditPage.publishButton'](),
						m['eventEditPage.tooltips.publish'](),
						CheckCircle,
						'default',
						updateStatusMutation.isPending
					)}
				{:else if currentStatus === 'open'}
					{@render lifecycleButton(
						closeEvent,
						m['eventEditPage.closeButton'](),
						m['eventEditPage.tooltips.close'](),
						XCircle,
						'outline',
						updateStatusMutation.isPending
					)}
					{@render lifecycleButton(
						markAsDraft,
						m['eventEditPage.draftButton'](),
						m['eventEditPage.tooltips.draft'](),
						FileEdit,
						'outline',
						updateStatusMutation.isPending
					)}
				{:else if currentStatus === 'closed'}
					{@render lifecycleButton(
						reopenEvent,
						m['eventEditPage.reopenButton'](),
						m['eventEditPage.tooltips.reopen'](),
						CheckCircle,
						'default',
						updateStatusMutation.isPending
					)}
					{@render lifecycleButton(
						markAsDraft,
						m['eventEditPage.draftButton'](),
						m['eventEditPage.tooltips.draft'](),
						FileEdit,
						'outline',
						updateStatusMutation.isPending
					)}
				{/if}

				<!-- Retry refunds (cancelled events with refundable online payments left) -->
				{#if currentStatus === 'cancelled' && hasRefundableTickets}
					{@render lifecycleButton(
						cancelEvent,
						m['cancelEvent.retryButton'](),
						m['cancelEvent.retryDescription'](),
						RotateCcw,
						'default',
						false
					)}
				{/if}

				<!-- Cancel event button (open/closed only — reversible, notifies attendees) -->
				{#if currentStatus === 'open' || currentStatus === 'closed'}
					{@render lifecycleButton(
						cancelEvent,
						m['cancelEvent.confirmButton'](),
						m['eventEditPage.tooltips.cancel'](),
						Ban,
						'destructive',
						updateStatusMutation.isPending
					)}
				{/if}

				<!-- More Actions Dropdown (Duplicate + Delete) — no Tooltip
				     wrapper here because nesting Tooltip.Trigger child
				     snippets with DropdownMenu.Trigger child snippets stacks
				     two competing keyboard/focus handlers on the same
				     button. The `aria-label` carries the accessible name
				     and `title` provides a native browser tooltip on hover. -->
				<DropdownMenu.Root>
					<DropdownMenu.Trigger>
						{#snippet child({ props })}
							<Button
								{...props}
								variant="outline"
								size="icon"
								aria-label={m['orgAdmin.events.actions.moreActions']()}
								title={m['eventEditPage.tooltips.more']()}
							>
								<MoreVertical aria-hidden="true" />
							</Button>
						{/snippet}
					</DropdownMenu.Trigger>
					<DropdownMenu.Content align="end" class="w-48">
						<DropdownMenu.Item onclick={openDuplicateModal}>
							<Copy class="mr-2 h-4 w-4" />
							{m['orgAdmin.events.actions.duplicate']()}
						</DropdownMenu.Item>
						<DropdownMenu.Item onclick={deleteEvent} class="text-destructive">
							<Trash2 class="mr-2 h-4 w-4" />
							{m['orgAdmin.events.actions.delete']()}
						</DropdownMenu.Item>
					</DropdownMenu.Content>
				</DropdownMenu.Root>
			</Tooltip.Provider>
		{/snippet}
	</PageHeader>

	{#if stripeNotice}
		<StripeReturnNotice
			notice={stripeNotice}
			onContinue={() => (showStripeModal = true)}
			onDismiss={() => (stripeNotice = null)}
		/>
	{/if}
	<EventStripeConnect
		bind:show={showStripeModal}
		orgSlug={organization.slug}
		eventId={event.id}
		defaultEmail={organization.contact_email ?? ''}
	/>

	{#if currentStatus === 'draft' || (currentStatus === 'open' && justPublished)}
		<PublishShareCard
			status={currentStatus}
			eventName={event.name}
			eventUrl={links.shareUrl}
			previewHref={links.previewHref}
			onPublish={publishEvent}
			publishing={updateStatusMutation.isPending}
		/>
	{/if}

	<!-- Event Editor Component. Keyed by event id: EventEditor snapshots
	     existingEvent (incl. the id it saves to) into $state once, so a
	     client-side navigation between two events' edit pages (e.g. the
	     duplicate flow's goto) must remount it or it keeps editing the
	     previous event. -->
	{#key event.id}
		<EventEditor
			{organization}
				feeConfig={data.feeConfig}
			existingEvent={event}
			userCity={data.userCity}
			orgCity={data.orgCity}
			eventSeries={data.eventSeries}
			{initialTab}
			isOwner={data.isOwner}
			onlinePaymentSetup={stripeSetupState(organization)}
		/>
	{/key}
</div>

<!-- Duplicate Event Modal -->
<DuplicateEventModal
	bind:open={showDuplicateModal}
	eventId={event.id}
	eventName={event.name}
	eventStart={event.start}
	organizationSlug={organization.slug}
	onClose={closeDuplicateModal}
/>

<!-- Cancel Event Dialog (doubles as the retry-refunds dialog once cancelled) -->
<CancelEventDialog
	bind:open={showCancelEventDialog}
	eventId={event.id}
	retryRefunds={currentStatus === 'cancelled'}
/>
