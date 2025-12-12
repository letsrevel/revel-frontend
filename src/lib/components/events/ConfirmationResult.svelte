<script lang="ts">
	import { onMount } from 'svelte';
	import * as m from '$lib/paraglide/messages.js';
	import { Button } from '$lib/components/ui/button';
	import { Alert, AlertDescription } from '$lib/components/ui/alert';
	import { CheckCircle2, XCircle, Loader2 } from 'lucide-svelte';
	import { eventConfirmGuestAction } from '$lib/api';
	import { handleGuestAttendanceError } from '$lib/utils/guestAttendance';

	interface Props {
		token: string;
		onEventNavigate?: (eventId: string) => void;
	}

	let { token, onEventNavigate }: Props = $props();

	// State
	let isLoading = $state(true);
	let result = $state<{
		success: boolean;
		eventId?: string;
		type?: 'rsvp' | 'ticket';
		rsvpStatus?: 'yes' | 'no' | 'maybe';
		ticketId?: string;
		error?: string;
	}>({ success: false });

	// Auto-trigger confirmation on mount
	onMount(async () => {
		await confirmAction();
	});

	async function confirmAction() {
		isLoading = true;

		try {
			const response = await eventConfirmGuestAction({
				body: { token }
			});

			const data = response.data;

			if (!data) {
				throw new Error('No data returned from confirmation');
			}

			// Determine if this is an RSVP or ticket based on response shape
			// RSVP has 'status' field with values "yes" | "no" | "maybe"
			// Ticket has 'tier' field and 'status' with values "pending" | "active" | etc.
			const isRsvp =
				'status' in data &&
				typeof data.status === 'string' &&
				['yes', 'no', 'maybe'].includes(data.status);

			// Get event ID - RSVP has event_id, Ticket has event.id
			const eventId = isRsvp
				? 'event_id' in data
					? data.event_id
					: undefined
				: 'event' in data && data.event
					? data.event.id
					: undefined;

			result = {
				success: true,
				eventId,
				type: isRsvp ? 'rsvp' : 'ticket',
				rsvpStatus: isRsvp ? (data.status as 'yes' | 'no' | 'maybe') : undefined,
				ticketId: !isRsvp && 'id' in data ? (data.id ?? undefined) : undefined
			};
		} catch (error: any) {
			result = {
				success: false,
				error: handleGuestAttendanceError(error)
			};
		} finally {
			isLoading = false;
		}
	}

	function handleRetry() {
		confirmAction();
	}

	function handleNavigateToEvent() {
		if (!result.eventId) return;

		// Build URL with query params to trigger success message on event page
		let url = `/events/${result.eventId}`;
		const params = new URLSearchParams();

		if (result.type === 'rsvp' && result.rsvpStatus) {
			params.set('rsvp', result.rsvpStatus);
		} else if (result.type === 'ticket' && result.ticketId) {
			params.set('ticket_id', result.ticketId);
		}

		const queryString = params.toString();
		if (queryString) {
			url += `?${queryString}`;
		}

		window.location.href = url;
	}
</script>

<div class="mx-auto max-w-lg space-y-6 py-12">
	{#if isLoading}
		<!-- Loading State -->
		<div class="flex flex-col items-center justify-center space-y-4 text-center">
			<div class="relative">
				<Loader2 class="h-16 w-16 animate-spin text-primary" aria-hidden="true" />
			</div>
			<div class="space-y-2">
				<h1 class="text-2xl font-bold">{m['guest_attendance.confirmation_processing']()}</h1>
				<p class="text-muted-foreground">
					{m['guest_attendance.confirmation_wait']()}
				</p>
			</div>
		</div>
	{:else if result.success}
		<!-- Success State -->
		<div class="flex flex-col items-center justify-center space-y-6 text-center">
			<div class="rounded-full bg-primary/10 p-6">
				<CheckCircle2 class="h-16 w-16 text-primary" aria-hidden="true" />
			</div>

			<div class="space-y-3">
				<h1 class="text-3xl font-bold">
					{result.type === 'rsvp'
						? m['guest_attendance.rsvp_confirmed_title']()
						: m['guest_attendance.ticket_confirmed_title']()}
				</h1>
				<p class="text-lg text-muted-foreground">
					{result.type === 'rsvp'
						? m['guest_attendance.rsvp_confirmed_body']()
						: m['guest_attendance.ticket_confirmed_body']()}
				</p>
			</div>

			{#if result.eventId}
				<Button size="lg" onclick={handleNavigateToEvent} class="mt-4">
					{m['guest_attendance.view_event']()}
				</Button>
			{:else}
				<Button size="lg" onclick={() => (window.location.href = '/')} class="mt-4">
					{m['guest_attendance.common_goToHomepage']()}
				</Button>
			{/if}

			<!-- Success message for screen readers -->
			<div class="sr-only" role="status" aria-live="polite">
				{result.type === 'rsvp'
					? m['guest_attendance.rsvp_confirmed_title']()
					: m['guest_attendance.ticket_confirmed_title']()}
			</div>
		</div>
	{:else}
		<!-- Error State -->
		<div class="flex flex-col items-center justify-center space-y-6 text-center">
			<div class="rounded-full bg-destructive/10 p-6">
				<XCircle class="h-16 w-16 text-destructive" aria-hidden="true" />
			</div>

			<div class="space-y-3">
				<h1 class="text-3xl font-bold">Confirmation Failed</h1>
				<Alert variant="destructive" class="text-left">
					<AlertDescription>
						{result.error || m['guest_attendance.network_error']()}
					</AlertDescription>
				</Alert>
			</div>

			<div class="flex flex-col gap-3 sm:flex-row">
				<Button variant="outline" onclick={handleRetry}>
					{m['guest_attendance.retry']()}
				</Button>
				<Button onclick={() => (window.location.href = '/')}>
					{m['guest_attendance.common_goToHomepage']()}
				</Button>
			</div>

			<!-- Error message for screen readers -->
			<div class="sr-only" role="alert" aria-live="assertive">
				Confirmation failed. {result.error}
			</div>
		</div>
	{/if}
</div>
