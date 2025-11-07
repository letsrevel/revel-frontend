<script lang="ts">
	import * as m from '$lib/paraglide/messages.js';
	import { CheckCircle, Clock, XCircle, Ticket as TicketIcon } from 'lucide-svelte';
	import { cn } from '$lib/utils';

	interface Props {
		status: string;
		class?: string;
	}

	let { status, class: className }: Props = $props();

	let config = $derived.by(() => {
		switch (status) {
			case 'active':
				return {
					label: m['ticketStatusBadge.active'](),
					icon: CheckCircle,
					className:
						'bg-green-100 text-green-800 border-green-200 dark:bg-green-950 dark:text-green-100 dark:border-green-800'
				};
			case 'pending':
				return {
					label: m['ticketStatusBadge.pending'](),
					icon: Clock,
					className:
						'bg-orange-100 text-orange-800 border-orange-200 dark:bg-orange-950 dark:text-orange-100 dark:border-orange-800'
				};
			case 'checked_in':
				return {
					label: m['ticketStatusBadge.checkedIn'](),
					icon: TicketIcon,
					className:
						'bg-blue-100 text-blue-800 border-blue-200 dark:bg-blue-950 dark:text-blue-100 dark:border-blue-800'
				};
			case 'cancelled':
				return {
					label: m['ticketStatusBadge.cancelled'](),
					icon: XCircle,
					className:
						'bg-red-100 text-red-800 border-red-200 dark:bg-red-950 dark:text-red-100 dark:border-red-800'
				};
			default:
				return {
					label: status.replace(/_/g, ' '),
					icon: TicketIcon,
					className:
						'bg-gray-100 text-gray-800 border-gray-200 dark:bg-gray-800 dark:text-gray-100 dark:border-gray-700'
				};
		}
	});

	let Icon = $derived(config.icon);
</script>

<span
	class={cn(
		'inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-semibold',
		config.className,
		className
	)}
>
	<Icon class="h-3.5 w-3.5" aria-hidden="true" />
	{config.label}
</span>
