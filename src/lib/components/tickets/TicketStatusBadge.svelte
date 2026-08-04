<script lang="ts">
	import * as m from '$lib/paraglide/messages.js';
	import { CheckCircle, Clock, XCircle, Ticket as TicketIcon } from '@lucide/svelte';
	import StatusBadge from '$lib/components/common/StatusBadge.svelte';
	import type { Tone } from '$lib/components/common/tones';

	interface Props {
		status: string;
		class?: string;
	}

	const { status, class: className }: Props = $props();

	// Thin mapper over the shared StatusBadge (rebrand primitive): same filename,
	// same props, same visible labels as before — only the rendering delegates
	// to the audited solid-fill tone system instead of hand-picked hues.
	const config = $derived.by((): { label: string; icon: typeof CheckCircle; tone: Tone } => {
		switch (status) {
			case 'active':
				return { label: m['ticketStatusBadge.active'](), icon: CheckCircle, tone: 'success' };
			case 'pending':
				return { label: m['ticketStatusBadge.pending'](), icon: Clock, tone: 'warning' };
			case 'checked_in':
				return { label: m['ticketStatusBadge.checkedIn'](), icon: TicketIcon, tone: 'info' };
			case 'cancelled':
				return { label: m['ticketStatusBadge.cancelled'](), icon: XCircle, tone: 'danger' };
			default:
				return { label: status.replace(/_/g, ' '), icon: TicketIcon, tone: 'neutral' };
		}
	});
</script>

<StatusBadge tone={config.tone} label={config.label} icon={config.icon} class={className} />
