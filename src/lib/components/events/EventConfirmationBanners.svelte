<script lang="ts">
	import * as m from '$lib/paraglide/messages.js';

	interface Props {
		paymentSuccess: boolean;
		paymentCancelled: boolean;
		/** RSVP confirmation status ('yes' | 'no' | 'maybe') or null when absent. */
		rsvpConfirmed: string | null;
		ticketConfirmed: boolean;
	}
	const { paymentSuccess, paymentCancelled, rsvpConfirmed, ticketConfirmed }: Props = $props();
</script>

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
