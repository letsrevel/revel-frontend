<script lang="ts">
	import { CheckCircle, Clock, XCircle, Ticket as TicketIcon } from 'lucide-svelte';
	import { cn } from '$lib/utils';

	interface Props {
		status: 'pending' | 'active' | 'checked_in' | 'cancelled';
		class?: string;
	}

	let { status, class: className }: Props = $props();

	let config = $derived.by(() => {
		switch (status) {
			case 'active':
				return {
					label: 'Active',
					icon: CheckCircle,
					className: 'bg-green-100 text-green-800 border-green-200'
				};
			case 'checked_in':
				return {
					label: 'Checked In',
					icon: TicketIcon,
					className: 'bg-blue-100 text-blue-800 border-blue-200'
				};
			case 'pending':
				return {
					label: 'Pending',
					icon: Clock,
					className: 'bg-yellow-100 text-yellow-800 border-yellow-200'
				};
			case 'cancelled':
				return {
					label: 'Cancelled',
					icon: XCircle,
					className: 'bg-red-100 text-red-800 border-red-200'
				};
			default:
				return {
					label: status,
					icon: TicketIcon,
					className: 'bg-gray-100 text-gray-800 border-gray-200'
				};
		}
	});
</script>

<span
	class={cn(
		'inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-semibold',
		config().className,
		className
	)}
>
	<svelte:component this={config().icon} class="h-3.5 w-3.5" aria-hidden="true" />
	{config().label}
</span>
