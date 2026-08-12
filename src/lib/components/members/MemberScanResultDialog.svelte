<script lang="ts">
	import * as m from '$lib/paraglide/messages.js';
	import type { MemberScanResponseSchema } from '$lib/api/generated/types.gen';
	import {
		Dialog,
		DialogContent,
		DialogHeader,
		DialogTitle,
		DialogDescription
	} from '$lib/components/ui/dialog';
	import { Button } from '$lib/components/ui/button';
	import MemberVerificationCard from './MemberVerificationCard.svelte';
	import TicketStatusBadge from '$lib/components/tickets/TicketStatusBadge.svelte';
	import { Loader2 } from '@lucide/svelte';

	/**
	 * What the event scanner shows when a MEMBERSHIP card was scanned.
	 *
	 * The defining fact, stated in the dialog rather than implied: **nothing was
	 * checked in**. A membership card is an identity credential, and the backend
	 * only burns a ticket when the member holds exactly one non-cancelled ticket
	 * for this event — in which case this dialog never opens at all.
	 */
	interface Props {
		report: MemberScanResponseSchema | null;
		/** Id of the ticket row currently being resolved, if any. */
		pendingTicketId?: string | null;
		/** Check in one specific ticket the member holds. */
		onCheckInTicket: (ticketId: string) => void;
		onClose: () => void;
	}

	const { report, pendingTicketId = null, onCheckInTicket, onClose }: Props = $props();

	const tickets = $derived(report?.tickets ?? []);

	/**
	 * Only a live ticket can be checked in. A cancelled one never appears here
	 * (the backend filters them out) and an already-checked-in one would only earn
	 * a 400 — showing its badge and no button says that without a round trip.
	 */
	function isCheckInable(status: string): boolean {
		return status === 'active' || status === 'pending';
	}
</script>

<Dialog open={!!report} onOpenChange={(isOpen) => !isOpen && onClose()}>
	<DialogContent class="max-h-[90vh] overflow-y-auto sm:max-w-[480px]">
		<DialogHeader>
			<DialogTitle>{m['memberScan.title']()}</DialogTitle>
			<DialogDescription>{m['memberScan.dialogDescription']()}</DialogDescription>
		</DialogHeader>

		{#if report}
			<div class="space-y-4">
				<MemberVerificationCard member={report.member} />

				<!--
					The backend's own localized sentence, not a client-side reconstruction
					of it: it is the only thing that knows WHY nothing was checked in
					(no ticket at all vs several to choose from), and re-deriving that
					from `tickets.length` would drift the moment the rule changes.
				-->
				<p class="rounded-lg border bg-muted p-3 text-sm">{report.detail}</p>

				{#if tickets.length > 0}
					<div class="space-y-2">
						<h3 class="text-sm font-bold">{m['memberScan.ticketsHeading']()}</h3>
						<ul class="divide-y rounded-lg border">
							{#each tickets as ticket (ticket.id)}
								<li class="flex items-center justify-between gap-3 p-3">
									<div class="min-w-0">
										<p class="truncate text-sm font-medium">
											{ticket.tier_name ?? m['memberScan.untitledTier']()}
										</p>
										<TicketStatusBadge status={ticket.status} />
									</div>
									{#if isCheckInable(ticket.status)}
										<Button
											size="sm"
											onclick={() => onCheckInTicket(ticket.id)}
											disabled={!!pendingTicketId}
											aria-busy={pendingTicketId === ticket.id}
										>
											{#if pendingTicketId === ticket.id}
												<Loader2 class="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />
											{/if}
											{m['memberScan.checkInTicket']()}
										</Button>
									{/if}
								</li>
							{/each}
						</ul>
					</div>
				{/if}

				<div class="flex justify-end">
					<Button variant="outline" onclick={onClose}>{m['memberScan.close']()}</Button>
				</div>
			</div>
		{/if}
	</DialogContent>
</Dialog>
