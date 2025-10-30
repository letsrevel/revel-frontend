<script lang="ts">
	import { cn } from '$lib/utils/cn';

	interface Props {
		status: 'active' | 'expired' | 'limit-reached' | 'staff';
		class?: string;
	}

	let { status, class: className }: Props = $props();

	const statusConfig = {
		active: {
			label: 'Active',
			classes: 'bg-green-100 text-green-800 border-green-200'
		},
		expired: {
			label: 'Expired',
			classes: 'bg-red-100 text-red-800 border-red-200'
		},
		'limit-reached': {
			label: 'Limit Reached',
			classes: 'bg-yellow-100 text-yellow-800 border-yellow-200'
		},
		staff: {
			label: 'Staff',
			classes: 'bg-purple-100 text-purple-800 border-purple-200'
		}
	};

	const config = $derived(statusConfig[status]);
</script>

<span
	class={cn(
		'inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold',
		config.classes,
		className
	)}
>
	{config.label}
</span>
