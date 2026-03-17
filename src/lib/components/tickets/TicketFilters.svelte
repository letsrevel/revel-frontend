<script lang="ts">
	import * as m from '$lib/paraglide/messages.js';
	import { Search } from 'lucide-svelte';
	import { Input } from '$lib/components/ui/input';

	interface Props {
		searchQuery: string;
		selectedStatus: string | null;
		selectedPaymentMethod: string | null;
		onSearch: (e: Event) => void;
		onStatusFilter: (status: string | null) => void;
		onPaymentMethodFilter: (method: string | null) => void;
	}

	const {
		searchQuery,
		selectedStatus,
		selectedPaymentMethod,
		onSearch,
		onStatusFilter,
		onPaymentMethodFilter
	}: Props = $props();
</script>

<div class="mt-6 space-y-4">
	<!-- Search -->
	<div class="relative">
		<Search
			class="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
			aria-hidden="true"
		/>
		<Input
			type="search"
			placeholder={m['eventTicketsAdmin.searchPlaceholder']()}
			value={searchQuery}
			oninput={onSearch}
			class="pl-10"
			aria-label="Search tickets"
		/>
	</div>

	<!-- Status Filters -->
	<div>
		<h3 class="mb-2 text-sm font-semibold">{m['eventTicketsAdmin.filterByStatus']()}</h3>
		<div class="flex flex-wrap gap-2">
			<button
				type="button"
				onclick={() => onStatusFilter(null)}
				class="rounded-md border px-3 py-1 text-sm font-medium transition-colors {selectedStatus ===
				null
					? 'border-primary bg-primary text-primary-foreground'
					: 'border-input bg-background hover:bg-accent hover:text-accent-foreground'}"
			>
				{m['eventTicketsAdmin.filterAll']()}
			</button>
			<button
				type="button"
				onclick={() => onStatusFilter('pending')}
				class="rounded-md border px-3 py-1 text-sm font-medium transition-colors {selectedStatus ===
				'pending'
					? 'border-primary bg-primary text-primary-foreground'
					: 'border-input bg-background hover:bg-accent hover:text-accent-foreground'}"
			>
				{m['eventTicketsAdmin.statsPending']()}
			</button>
			<button
				type="button"
				onclick={() => onStatusFilter('active')}
				class="rounded-md border px-3 py-1 text-sm font-medium transition-colors {selectedStatus ===
				'active'
					? 'border-primary bg-primary text-primary-foreground'
					: 'border-input bg-background hover:bg-accent hover:text-accent-foreground'}"
			>
				{m['eventTicketsAdmin.statsActive']()}
			</button>
			<button
				type="button"
				onclick={() => onStatusFilter('checked_in')}
				class="rounded-md border px-3 py-1 text-sm font-medium transition-colors {selectedStatus ===
				'checked_in'
					? 'border-primary bg-primary text-primary-foreground'
					: 'border-input bg-background hover:bg-accent hover:text-accent-foreground'}"
			>
				{m['eventTicketsAdmin.statsCheckedIn']()}
			</button>
			<button
				type="button"
				onclick={() => onStatusFilter('cancelled')}
				class="rounded-md border px-3 py-1 text-sm font-medium transition-colors {selectedStatus ===
				'cancelled'
					? 'border-primary bg-primary text-primary-foreground'
					: 'border-input bg-background hover:bg-accent hover:text-accent-foreground'}"
			>
				{m['eventTicketsAdmin.statsCancelled']()}
			</button>
		</div>
	</div>

	<!-- Payment Method Filters -->
	<div>
		<h3 class="mb-2 text-sm font-semibold">{m['eventTicketsAdmin.filterByPaymentMethod']()}</h3>
		<div class="flex flex-wrap gap-2">
			<button
				type="button"
				onclick={() => onPaymentMethodFilter(null)}
				class="rounded-md border px-3 py-1 text-sm font-medium transition-colors {selectedPaymentMethod ===
				null
					? 'border-primary bg-primary text-primary-foreground'
					: 'border-input bg-background hover:bg-accent hover:text-accent-foreground'}"
			>
				{m['eventTicketsAdmin.filterAll']()}
			</button>
			<button
				type="button"
				onclick={() => onPaymentMethodFilter('online')}
				class="rounded-md border px-3 py-1 text-sm font-medium transition-colors {selectedPaymentMethod ===
				'online'
					? 'border-primary bg-primary text-primary-foreground'
					: 'border-input bg-background hover:bg-accent hover:text-accent-foreground'}"
			>
				{m['eventTicketsAdmin.paymentOnline']()}
			</button>
			<button
				type="button"
				onclick={() => onPaymentMethodFilter('offline')}
				class="rounded-md border px-3 py-1 text-sm font-medium transition-colors {selectedPaymentMethod ===
				'offline'
					? 'border-primary bg-primary text-primary-foreground'
					: 'border-input bg-background hover:bg-accent hover:text-accent-foreground'}"
			>
				{m['eventTicketsAdmin.paymentOffline']()}
			</button>
			<button
				type="button"
				onclick={() => onPaymentMethodFilter('at_the_door')}
				class="rounded-md border px-3 py-1 text-sm font-medium transition-colors {selectedPaymentMethod ===
				'at_the_door'
					? 'border-primary bg-primary text-primary-foreground'
					: 'border-input bg-background hover:bg-accent hover:text-accent-foreground'}"
			>
				{m['eventTicketsAdmin.paymentAtDoor']()}
			</button>
			<button
				type="button"
				onclick={() => onPaymentMethodFilter('free')}
				class="rounded-md border px-3 py-1 text-sm font-medium transition-colors {selectedPaymentMethod ===
				'free'
					? 'border-primary bg-primary text-primary-foreground'
					: 'border-input bg-background hover:bg-accent hover:text-accent-foreground'}"
			>
				{m['eventTicketsAdmin.paymentFree']()}
			</button>
		</div>
	</div>
</div>
