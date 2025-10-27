<script lang="ts">
	import type { TicketTierDetailSchema } from '$lib/api/generated/types.gen';
	import { Button } from '$lib/components/ui/button';
	import { Card } from '$lib/components/ui/card';
	import { Edit } from 'lucide-svelte';

	interface Props {
		tier: TicketTierDetailSchema;
		onEdit: () => void;
		onDelete?: () => void; // Phase 2: Add delete functionality
	}

	let { tier, onEdit }: Props = $props();

	const CURRENCY_SYMBOLS: Record<string, string> = {
		EUR: '€',
		USD: '$',
		GBP: '£',
		JPY: '¥',
		AUD: 'A$',
		CAD: 'C$',
		CHF: 'CHF',
		CNY: '¥',
		INR: '₹',
		KRW: '₩',
		RUB: '₽',
		TRY: '₺',
		BRL: 'R$',
		MXN: 'Mex$',
		ZAR: 'R'
	};

	function formatPrice(amount: string | number, currency: string): string {
		const symbol = CURRENCY_SYMBOLS[currency] || currency;
		return `${symbol}${Number(amount).toFixed(2)}`;
	}

	function formatDate(dateString: string | null | undefined): string {
		if (!dateString) return 'Not set';
		const date = new Date(dateString);
		return date.toLocaleString('en-US', {
			month: 'short',
			day: 'numeric',
			year: 'numeric',
			hour: '2-digit',
			minute: '2-digit'
		});
	}

	let priceDisplay = $derived(() => {
		const currency = tier.currency || 'EUR';
		if (tier.payment_method === 'free') return 'Free';
		if (tier.price_type === 'pwyc') {
			const min = formatPrice(tier.pwyc_min || 1, currency);
			const max = tier.pwyc_max ? formatPrice(tier.pwyc_max, currency) : 'any amount';
			return `${min} - ${max}`;
		}
		return formatPrice(tier.price || 0, currency);
	});

	let priceTypeDisplay = $derived(() => {
		if (tier.payment_method === 'free') return 'Free';
		return tier.price_type === 'pwyc' ? 'Pay What You Can' : 'Fixed Price';
	});

	let quantityDisplay = $derived(() => {
		if (tier.total_quantity === null) return 'Unlimited';
		const available = tier.total_available ?? 0;
		return `${available} of ${tier.total_quantity} remaining`;
	});

	let paymentMethodDisplay = $derived(() => {
		const methods: Record<string, string> = {
			free: 'Free',
			online: 'Online (Stripe)',
			offline: 'Offline',
			at_the_door: 'At the Door'
		};
		const pm = tier.payment_method ?? 'online';
		return methods[pm] || pm.replace(/_/g, ' ');
	});

	let visibilityDisplay = $derived(() => {
		return (tier.visibility ?? 'public').replace(/-/g, ' ');
	});

	let purchasableByDisplay = $derived(() => {
		const options: Record<string, string> = {
			public: 'Anyone',
			members: 'Members Only',
			invited: 'Invited Only',
			invited_and_members: 'Invited + Members'
		};
		const pb = tier.purchasable_by ?? 'public';
		return options[pb] || pb.replace(/_/g, ' ');
	});

	let salesWindowDisplay = $derived(() => {
		const start = formatDate(tier.sales_start_at);
		const end = formatDate(tier.sales_end_at);
		if (start === 'Not set' && end === 'Not set') return 'Always available';
		if (start === 'Not set') return `Until ${end}`;
		if (end === 'Not set') return `From ${start}`;
		return `${start} - ${end}`;
	});
</script>

<Card class="p-4">
	<div class="flex items-start justify-between">
		<div class="flex-1">
			<!-- Header -->
			<div class="flex items-center gap-2">
				<h3 class="text-lg font-semibold">🎟️ {tier.name}</h3>
				{#if tier.name === 'General Admission'}
					<span
						class="rounded bg-blue-100 px-2 py-1 text-xs text-blue-700 dark:bg-blue-950 dark:text-blue-300"
						>Default</span
					>
				{/if}
			</div>

			<!-- Description -->
			{#if tier.description}
				<p class="mt-1 text-sm text-muted-foreground">{tier.description}</p>
			{/if}

			<!-- Tier Details Grid -->
			<dl class="mt-3 grid grid-cols-2 gap-x-6 gap-y-3 text-sm">
				<!-- Price & Type -->
				<div>
					<dt class="text-muted-foreground">Price</dt>
					<dd class="font-medium">{priceDisplay()}</dd>
				</div>
				<div>
					<dt class="text-muted-foreground">Type</dt>
					<dd class="font-medium">{priceTypeDisplay()}</dd>
				</div>

				<!-- Payment Method -->
				<div>
					<dt class="text-muted-foreground">Payment Method</dt>
					<dd class="font-medium">{paymentMethodDisplay()}</dd>
				</div>

				<!-- Quantity -->
				<div>
					<dt class="text-muted-foreground">Quantity</dt>
					<dd class="font-medium">{quantityDisplay()}</dd>
				</div>

				<!-- Visibility -->
				<div>
					<dt class="text-muted-foreground">Visibility</dt>
					<dd class="font-medium capitalize">{visibilityDisplay()}</dd>
				</div>

				<!-- Available To -->
				<div>
					<dt class="text-muted-foreground">Available to</dt>
					<dd class="font-medium">{purchasableByDisplay()}</dd>
				</div>

				<!-- Sales Window (full width) -->
				<div class="col-span-2">
					<dt class="text-muted-foreground">Sales Window</dt>
					<dd class="font-medium">{salesWindowDisplay()}</dd>
				</div>
			</dl>

			<!-- Manual Payment Instructions -->
			{#if tier.manual_payment_instructions}
				<div class="mt-3 rounded-md border border-border bg-muted/50 p-2">
					<p class="text-xs font-medium text-muted-foreground">Payment Instructions:</p>
					<p class="mt-1 text-sm">{tier.manual_payment_instructions}</p>
				</div>
			{/if}
		</div>

		<Button variant="ghost" size="icon" onclick={onEdit} aria-label="Edit {tier.name}">
			<Edit class="h-4 w-4" />
		</Button>
	</div>
</Card>
