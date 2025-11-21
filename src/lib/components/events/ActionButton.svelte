<script lang="ts">
	import * as m from '$lib/paraglide/messages.js';
	import type { UserEventStatus } from '$lib/utils/eligibility';
	import {
		isRSVP,
		isTicket,
		isEligibility,
		getActionButtonText,
		isActionDisabled,
		getRSVPStatusText,
		getTicketStatusText
	} from '$lib/utils/eligibility';
	import { Ticket, Check, X } from 'lucide-svelte';
	import { cn } from '$lib/utils/cn';

	interface Props {
		userStatus: UserEventStatus | null;
		requiresTicket: boolean;
		isAuthenticated: boolean;
		canAttendWithoutLogin?: boolean;
		onclick?: () => void;
		class?: string;
	}

	let {
		userStatus,
		requiresTicket,
		isAuthenticated,
		canAttendWithoutLogin = false,
		onclick,
		class: className
	}: Props = $props();

	// Determine button state
	let buttonText = $derived.by(() => {
		if (!isAuthenticated && !canAttendWithoutLogin) {
			return requiresTicket
				? m['actionButton.loginToGetTickets']()
				: m['actionButton.signInToAttend']();
		}

		if (!isAuthenticated && canAttendWithoutLogin) {
			return requiresTicket ? m['actionButton.getTickets']() : m['actionButton.rsvp']();
		}

		if (!userStatus) {
			return requiresTicket ? m['actionButton.getTickets']() : m['actionButton.rsvp']();
		}

		// User has RSVP
		if (isRSVP(userStatus)) {
			return getRSVPStatusText(userStatus.status);
		}

		// User has ticket
		if (isTicket(userStatus)) {
			return getTicketStatusText(userStatus.status);
		}

		// Eligibility check
		if (isEligibility(userStatus) && userStatus.next_step) {
			return getActionButtonText(userStatus.next_step);
		}

		return requiresTicket ? m['actionButton.getTickets']() : m['actionButton.viewDetails']();
	});

	let isDisabled = $derived.by(() => {
		if (!isAuthenticated && !canAttendWithoutLogin) return false; // Can redirect to sign in
		if (!isAuthenticated && canAttendWithoutLogin) return false; // Can show guest dialog

		if (!userStatus) return false; // Can always attempt RSVP/ticket

		// If user already has RSVP or ticket, disable button
		if (isRSVP(userStatus) || isTicket(userStatus)) {
			return true;
		}

		// Check if eligibility state is a waiting state
		if (isEligibility(userStatus) && userStatus.next_step) {
			return isActionDisabled(userStatus.next_step);
		}

		return false;
	});

	let variant = $derived.by(() => {
		if (!isAuthenticated) return 'secondary';

		if (!userStatus) return 'primary';

		if (isRSVP(userStatus)) {
			// RSVP status is 'yes' | 'no' | 'maybe'
			if (userStatus.status === 'yes') return 'success';
			if (userStatus.status === 'no') return 'destructive';
			return 'secondary';
		}

		if (isTicket(userStatus)) {
			// Ticket status is 'pending' | 'active' | 'checked_in' | 'cancelled' (with double-L)
			if (userStatus.status === 'active') return 'success';
			if (userStatus.status === 'cancelled') return 'destructive';
			return 'secondary';
		}

		if (isEligibility(userStatus)) {
			if (userStatus.allowed) return 'primary';
			return 'secondary';
		}

		return 'secondary';
	});

	function handleClick(): void {
		if (!isAuthenticated && !canAttendWithoutLogin) {
			// Redirect to login with return URL
			window.location.href = `/login?redirect=${encodeURIComponent(window.location.pathname)}`;
			return;
		}

		// Call parent's onclick handler (works for both authenticated and guest flows)
		onclick?.();
	}
</script>

<button
	type="button"
	onclick={handleClick}
	disabled={isDisabled}
	class={cn(
		'w-full rounded-md px-6 py-3 font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
		variant === 'primary' && 'bg-primary text-primary-foreground hover:bg-primary/90',
		variant === 'secondary' &&
			'border border-input bg-background hover:bg-accent hover:text-accent-foreground',
		variant === 'success' &&
			'bg-green-600 text-white hover:bg-green-700 dark:bg-green-500 dark:hover:bg-green-600',
		variant === 'destructive' &&
			'bg-destructive text-destructive-foreground hover:bg-destructive/90',
		isDisabled && 'cursor-not-allowed opacity-50',
		className
	)}
	aria-live="polite"
>
	<span class="flex items-center justify-center gap-2">
		{#if userStatus && isRSVP(userStatus) && userStatus.status === 'yes'}
			<Check class="h-5 w-5" aria-hidden="true" />
		{:else if userStatus && isRSVP(userStatus) && userStatus.status === 'no'}
			<X class="h-5 w-5" aria-hidden="true" />
		{:else if userStatus && (isTicket(userStatus) || (isEligibility(userStatus) && userStatus.next_step === 'purchase_ticket'))}
			<Ticket class="h-5 w-5" aria-hidden="true" />
		{/if}
		{buttonText}
	</span>
</button>
