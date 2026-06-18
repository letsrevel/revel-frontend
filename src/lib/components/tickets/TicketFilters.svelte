<script lang="ts">
	import * as m from '$lib/paraglide/messages.js';
	import SearchInput from '$lib/components/events/filters/SearchInput.svelte';
	import { parseTicketOrderBy, type TicketOrderBy } from './ticket-sort';

	interface Props {
		searchQuery: string;
		selectedStatus: string | null;
		selectedPaymentMethod: string | null;
		selectedOrderBy?: TicketOrderBy;
		onSearch: (value: string) => void;
		onStatusFilter: (status: string | null) => void;
		onPaymentMethodFilter: (method: string | null) => void;
		onSort?: (orderBy: TicketOrderBy | undefined) => void;
	}

	const {
		searchQuery,
		selectedStatus,
		selectedPaymentMethod,
		selectedOrderBy,
		onSearch,
		onStatusFilter,
		onPaymentMethodFilter,
		onSort
	}: Props = $props();

	// Mobile sort options (the desktop table sorts via clickable column headers).
	const sortOptions: { value: TicketOrderBy; label: () => string }[] = [
		{ value: '-created_at', label: m['eventTicketsAdmin.sortNewest'] },
		{ value: 'created_at', label: m['eventTicketsAdmin.sortOldest'] },
		{ value: 'tier__name', label: m['eventTicketsAdmin.sortTierAsc'] },
		{ value: '-tier__name', label: m['eventTicketsAdmin.sortTierDesc'] },
		{ value: 'price', label: m['eventTicketsAdmin.sortPriceAsc'] },
		{ value: '-price', label: m['eventTicketsAdmin.sortPriceDesc'] },
		{ value: 'status', label: m['eventTicketsAdmin.sortStatus'] },
		{ value: 'tier__payment_method', label: m['eventTicketsAdmin.sortPayment'] }
	];

	function handleSortChange(event: Event) {
		const value = (event.currentTarget as HTMLSelectElement).value;
		onSort?.(parseTicketOrderBy(value));
	}
</script>

<div class="mt-6 space-y-4">
	<!-- Search -->
	<SearchInput
		value={searchQuery}
		{onSearch}
		placeholder={m['eventTicketsAdmin.searchPlaceholder']()}
		ariaLabel={m['eventTicketsAdmin.searchPlaceholder']()}
	/>

	<!-- Mobile sort (desktop uses the table column headers) -->
	{#if onSort}
		<div class="md:hidden">
			<label for="ticket-sort" class="mb-2 block text-sm font-semibold">
				{m['eventTicketsAdmin.sortLabel']()}
			</label>
			<select
				id="ticket-sort"
				value={selectedOrderBy ?? ''}
				onchange={handleSortChange}
				class="h-10 w-full rounded-md border border-input bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
			>
				<option value="">{m['eventTicketsAdmin.sortDefault']()}</option>
				{#each sortOptions as option (option.value)}
					<option value={option.value}>{option.label()}</option>
				{/each}
			</select>
		</div>
	{/if}

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
