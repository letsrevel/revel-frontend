<script lang="ts">
	import * as m from '$lib/paraglide/messages.js';
	import type { HeldSeriesPassSchema } from '$lib/api/generated/types.gen';
	import { Card } from '$lib/components/ui/card';
	import TicketStatusBadge from '$lib/components/tickets/TicketStatusBadge.svelte';
	import MyPassModal from './MyPassModal.svelte';
	import { Ticket, QrCode } from '@lucide/svelte';
	import { formatDate } from '$lib/utils/date';
	import { formatPrice } from '$lib/utils/format';

	interface Props {
		heldPass: HeldSeriesPassSchema;
	}

	const { heldPass }: Props = $props();

	let showPassModal = $state(false);

	const purchasedDate = $derived(formatDate(heldPass.created_at));
	const progressPct = $derived(
		heldPass.total_event_count > 0
			? Math.round(
					((heldPass.total_event_count - heldPass.remaining_event_count) /
						heldPass.total_event_count) *
						100
				)
			: 0
	);
</script>

<Card class="group overflow-hidden transition-shadow hover:shadow-lg">
	<div class="flex flex-col gap-4 p-4 md:p-6">
		<div class="flex items-start gap-4">
			<div class="shrink-0">
				<div
					class="flex h-16 w-16 items-center justify-center rounded-lg bg-primary/10 text-primary"
				>
					<Ticket class="h-8 w-8" aria-hidden="true" />
				</div>
			</div>

			<div class="min-w-0 flex-1">
				<div class="mb-2 flex items-start justify-between gap-2">
					<div class="min-w-0 flex-1">
						<h3 class="text-lg font-semibold">{heldPass.series_pass.name}</h3>
						<p class="text-sm text-muted-foreground">{heldPass.series.name}</p>
					</div>
					<TicketStatusBadge status={heldPass.status} />
				</div>

				<dl class="space-y-1.5 text-sm text-muted-foreground">
					<div>
						<dt class="inline font-medium">{m['seriesPass.coverageLabel']()}:</dt>
						<dd class="inline">
							{m['seriesPass.coverageValue']({
								remaining: heldPass.remaining_event_count,
								total: heldPass.total_event_count
							})}
						</dd>
					</div>
					<div>
						<dt class="inline font-medium">{m['seriesPass.pricePaidLabel']()}:</dt>
						<dd class="inline">
							{formatPrice(
								heldPass.price_paid,
								heldPass.series_pass.currency,
								m['seriesPass.free']()
							)}
						</dd>
					</div>
					<div>
						<dt class="inline font-medium">{m['ticketListCard.purchased']()}</dt>
						<dd class="inline">{purchasedDate}</dd>
					</div>
				</dl>

				<!-- Coverage progress -->
				<div class="mt-3">
					<div
						class="h-1.5 w-full overflow-hidden rounded-full bg-muted"
						role="progressbar"
						aria-valuenow={progressPct}
						aria-valuemin={0}
						aria-valuemax={100}
						aria-label={m['seriesPass.progressLabel']()}
					>
						<div class="h-full bg-primary transition-all" style="width: {progressPct}%"></div>
					</div>
				</div>
			</div>
		</div>

		<div class="border-t border-border pt-4">
			{#if heldPass.status !== 'cancelled'}
				<button
					type="button"
					onclick={() => (showPassModal = true)}
					class="inline-flex w-full items-center justify-center gap-1.5 rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
				>
					<QrCode class="h-4 w-4" aria-hidden="true" />
					{m['seriesPass.viewPass']()}
				</button>
			{/if}
		</div>
	</div>
</Card>

{#if showPassModal}
	<MyPassModal open={showPassModal} {heldPass} onClose={() => (showPassModal = false)} />
{/if}
