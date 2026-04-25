<script lang="ts">
	import * as m from '$lib/paraglide/messages.js';
	import { cn } from '$lib/utils/cn';
	import { getUserDisplayName } from '$lib/utils/user-display';
	import { getTicketStatusColor, getTicketStatusLabel } from '$lib/utils/status-colors';
	import { formatPrice } from '$lib/utils/format';
	import {
		getGuestNameIfDifferent,
		getSeatDisplay,
		getTicketPrice,
		canCheckIn,
		canConfirmPayment,
		canManageTicket,
		canUnconfirmPayment,
		getPaymentMethodLabel
	} from '$lib/utils/ticket-helpers';
	import { Button } from '$lib/components/ui/button';
	import { Badge } from '$lib/components/ui/badge';
	import {
		Check,
		X,
		CreditCard,
		Banknote,
		Coins,
		Gift,
		ExternalLink,
		UserPlus,
		MoreVertical,
		Ban,
		Undo2
	} from 'lucide-svelte';
	import * as DropdownMenu from '$lib/components/ui/dropdown-menu';
	import UserAvatar from '$lib/components/common/UserAvatar.svelte';

	interface Props {
		tickets: any[];
		checkInPending: boolean;
		confirmPaymentPending: boolean;
		cancelTicketPending: boolean;
		addMemberPending: boolean;
		unconfirmPaymentPending: boolean;
		tiersLoading: boolean;
		onCheckIn: (ticket: any) => void;
		onConfirmPayment: (ticket: any) => void;
		onMakeMember: (ticket: any) => void;
		onCancelTicket: (ticket: any) => void;
		onBlacklist: (ticket: any) => void;
		onUnconfirmPayment: (ticket: any) => void;
	}

	const {
		tickets,
		checkInPending,
		confirmPaymentPending,
		cancelTicketPending,
		addMemberPending,
		unconfirmPaymentPending,
		tiersLoading,
		onCheckIn,
		onConfirmPayment,
		onMakeMember,
		onCancelTicket,
		onBlacklist,
		onUnconfirmPayment
	}: Props = $props();
</script>

{#snippet paymentMethodIcon(method: string)}
	{#if method === 'online'}
		<CreditCard class="h-3 w-3" aria-hidden="true" />
	{:else if method === 'offline'}
		<Banknote class="h-3 w-3" aria-hidden="true" />
	{:else if method === 'at_the_door'}
		<Coins class="h-3 w-3" aria-hidden="true" />
	{:else if method === 'free'}
		<Gift class="h-3 w-3" aria-hidden="true" />
	{:else}
		<CreditCard class="h-3 w-3" aria-hidden="true" />
	{/if}
{/snippet}

<div class="hidden overflow-x-auto rounded-lg border md:block">
	<table class="w-full">
		<thead class="border-b bg-muted/50">
			<tr>
				<th class="px-4 py-3 text-left text-sm font-semibold"
					>{m['eventTicketsAdmin.headerAttendee']()}</th
				>
				<th class="px-4 py-3 text-left text-sm font-semibold"
					>{m['eventTicketsAdmin.headerTier']()}</th
				>
				<th class="px-4 py-3 text-left text-sm font-semibold"
					>{m['eventTicketsAdmin.headerPrice']()}</th
				>
				<th class="px-4 py-3 text-left text-sm font-semibold"
					>{m['eventTicketsAdmin.headerPaymentMethod']()}</th
				>
				<th class="px-4 py-3 text-left text-sm font-semibold"
					>{m['eventTicketsAdmin.headerStatus']()}</th
				>
				<th class="px-4 py-3 text-left text-sm font-semibold"
					>{m['eventTicketsAdmin.headerPurchased']()}</th
				>
				<th class="px-4 py-3 text-right text-sm font-semibold"
					>{m['eventTicketsAdmin.headerActions']()}</th
				>
			</tr>
		</thead>
		<tbody class="divide-y">
			{#each tickets as ticket}
				{@const guestName = getGuestNameIfDifferent(ticket)}
				{@const seatInfo = getSeatDisplay(ticket)}
				<tr class="hover:bg-muted/30">
					<td class="px-4 py-3">
						<div class="flex items-start gap-3">
							<UserAvatar
								profilePictureUrl={ticket.user.profile_picture_url}
								previewUrl={ticket.user.profile_picture_preview_url}
								thumbnailUrl={ticket.user.profile_picture_thumbnail_url}
								displayName={getUserDisplayName(ticket.user)}
								firstName={ticket.user.first_name}
								lastName={ticket.user.last_name}
								size="sm"
								clickable={true}
							/>
							<div>
								{#if guestName}
									<div class="flex flex-wrap items-center gap-x-2 gap-y-1">
										<span class="font-medium">{guestName}</span>
									</div>
									<div class="text-sm text-muted-foreground">
										(Purchased by {getUserDisplayName(ticket.user)})
									</div>
								{:else}
									<div class="flex flex-wrap items-center gap-x-2 gap-y-1">
										<span class="font-medium">{getUserDisplayName(ticket.user)}</span>
										{#if ticket.user.pronouns}
											<span class="text-xs text-muted-foreground">({ticket.user.pronouns})</span>
										{/if}
										{#if ticket.membership}
											<Badge variant="secondary" class="text-xs">
												{ticket.membership.tier?.name
													? m['memberBadge.tierName']({ tier: ticket.membership.tier.name })
													: m['memberBadge.member']()}
											</Badge>
										{/if}
									</div>
								{/if}
								<div class="text-sm text-muted-foreground">
									{ticket.user.email || 'N/A'}
								</div>
								{#if seatInfo}
									<div class="mt-1 text-xs text-primary">
										{seatInfo}
									</div>
								{/if}
							</div>
						</div>
					</td>
					<td class="px-4 py-3">
						<div class="font-medium">{ticket.tier?.name || 'N/A'}</div>
					</td>
					<td
						class="px-4 py-3"
						title={ticket.payment?.vat_amount != null
							? m['tickets.vatTooltip']({
									net: ticket.payment.net_amount ?? '',
									vat: ticket.payment.vat_amount ?? '',
									rate: String(ticket.payment.vat_rate ?? '')
								})
							: undefined}
					>
						<div class="font-medium">
							{formatPrice(
								getTicketPrice(ticket),
								ticket.payment?.currency || ticket.tier?.currency,
								m['eventTicketsAdmin.free']()
							)}
						</div>
					</td>
					<td class="px-4 py-3">
						<div class="flex items-center gap-1 text-sm">
							{@render paymentMethodIcon(ticket.tier?.payment_method || '')}
							{getPaymentMethodLabel(ticket.tier?.payment_method || '')}
						</div>
					</td>
					<td class="px-4 py-3">
						<div class="flex flex-col gap-1">
							<span
								class={cn(
									'inline-flex w-fit rounded-full px-2 py-1 text-xs font-semibold',
									getTicketStatusColor(ticket.status)
								)}
							>
								{getTicketStatusLabel(ticket.status)}
							</span>
							{#if ticket.status === 'cancelled' && ticket.payment?.refund_status}
								{@const rs = ticket.payment.refund_status as 'pending' | 'succeeded' | 'failed'}
								<span
									class={cn(
										'inline-flex w-fit items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-medium',
										rs === 'succeeded' &&
											'border-green-300 bg-green-50 text-green-700 dark:border-green-800 dark:bg-green-950 dark:text-green-300',
										rs === 'pending' &&
											'border-amber-300 bg-amber-50 text-amber-700 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-300',
										rs === 'failed' && 'border-destructive/50 bg-destructive/10 text-destructive'
									)}
									title={ticket.payment.refund_amount && ticket.payment.currency
										? `${ticket.payment.refund_amount} ${ticket.payment.currency}`
										: undefined}
								>
									{#if rs === 'succeeded'}
										{m['adminTicketTable.refundStatus.succeeded']()}
									{:else if rs === 'pending'}
										{m['adminTicketTable.refundStatus.pending']()}
									{:else}
										{m['adminTicketTable.refundStatus.failed']()}
									{/if}
								</span>
							{/if}
						</div>
					</td>
					<td class="px-4 py-3 text-sm text-muted-foreground">
						{new Date(ticket.created_at).toLocaleDateString()}
					</td>
					<td class="px-4 py-3">
						<div class="flex justify-end gap-2">
							{#if canCheckIn(ticket)}
								<Button
									size="sm"
									variant="default"
									onclick={() => onCheckIn(ticket)}
									disabled={checkInPending}
								>
									<Check class="h-4 w-4" aria-hidden="true" />
									{m['eventTicketsAdmin.actionCheckIn']()}
								</Button>
							{/if}
							{#if canConfirmPayment(ticket)}
								<Button
									size="sm"
									variant="default"
									onclick={() => onConfirmPayment(ticket)}
									disabled={confirmPaymentPending}
								>
									<Check class="h-4 w-4" aria-hidden="true" />
									{m['eventTicketsAdmin.actionConfirmPayment']()}
								</Button>
							{/if}
							{#if !ticket.membership && ticket.user?.id}
								<Button
									size="sm"
									variant="outline"
									onclick={() => onMakeMember(ticket)}
									disabled={addMemberPending || tiersLoading}
								>
									<UserPlus class="h-4 w-4" aria-hidden="true" />
									{m['makeMemberAction.button']()}
								</Button>
							{/if}
							{#if ticket.tier?.payment_method === 'online' && ticket.payment?.stripe_dashboard_url}
								<Button
									size="sm"
									variant="outline"
									onclick={() => window.open(ticket.payment.stripe_dashboard_url, '_blank')}
								>
									<ExternalLink class="h-4 w-4" aria-hidden="true" />
									Manage on Stripe
								</Button>
							{/if}
							<!-- More actions dropdown -->
							<DropdownMenu.Root>
								<DropdownMenu.Trigger>
									{#snippet child({ props })}
										<button
											{...props}
											class="inline-flex items-center justify-center rounded-md p-1 text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
											aria-label="More actions for {getUserDisplayName(ticket.user)}"
										>
											<MoreVertical class="h-4 w-4" aria-hidden="true" />
										</button>
									{/snippet}
								</DropdownMenu.Trigger>
								<DropdownMenu.Content align="end">
									{#if canUnconfirmPayment(ticket)}
										<DropdownMenu.Item
											onclick={() => onUnconfirmPayment(ticket)}
											disabled={unconfirmPaymentPending}
										>
											<Undo2 class="mr-2 h-4 w-4" aria-hidden="true" />
											{m['eventTicketsAdmin.actionUnconfirmPayment']()}
										</DropdownMenu.Item>
									{/if}
									{#if canManageTicket(ticket) && ticket.status !== 'cancelled'}
										<DropdownMenu.Item
											onclick={() => onCancelTicket(ticket)}
											disabled={cancelTicketPending}
											class="text-destructive focus:text-destructive"
										>
											<X class="mr-2 h-4 w-4" aria-hidden="true" />
											Cancel Ticket
										</DropdownMenu.Item>
									{/if}
									{#if ticket.user?.id}
										<DropdownMenu.Item
											onclick={() => onBlacklist(ticket)}
											class="text-destructive focus:text-destructive"
										>
											<Ban class="mr-2 h-4 w-4" aria-hidden="true" />
											Blacklist User
										</DropdownMenu.Item>
									{/if}
								</DropdownMenu.Content>
							</DropdownMenu.Root>
						</div>
					</td>
				</tr>
			{/each}
		</tbody>
	</table>
</div>
