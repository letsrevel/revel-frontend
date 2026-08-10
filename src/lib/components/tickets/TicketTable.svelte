<script lang="ts">
	import * as m from '$lib/paraglide/messages.js';
	import { getUserDisplayName } from '$lib/utils/user-display';
	import { getTicketStatusTone, getTicketStatusLabel } from '$lib/utils/status-colors';
	import { formatPrice } from '$lib/utils/format';
	import { formatDate } from '$lib/utils/date';
	import {
		getGuestNameIfDifferent,
		getSeatDisplay,
		getTicketPrice,
		canCheckIn,
		canConfirmPayment,
		canAdminCancelTicket,
		canRefundTicketPayment,
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
		Undo2,
		Armchair,
		Pencil,
		ChevronUp,
		ChevronDown,
		ChevronsUpDown
	} from '@lucide/svelte';
	import * as DropdownMenu from '$lib/components/ui/dropdown-menu';
	import UserAvatar from '$lib/components/common/UserAvatar.svelte';
	import StatusBadge from '$lib/components/common/StatusBadge.svelte';
	import RefundStatusBadge from './RefundStatusBadge.svelte';
	import TicketDiscountBadge from './TicketDiscountBadge.svelte';
	import SeriesPassBadge from './SeriesPassBadge.svelte';
	import { sortDirection, type TicketOrderBy, type TicketSortField } from './ticket-sort';
	import type { AdminTicketSchema } from '$lib/api';

	interface Props {
		tickets: AdminTicketSchema[];
		/** Active sort, or undefined for the backend default order. */
		orderBy?: TicketOrderBy;
		/** Toggle sort on a column. Omit to render non-sortable headers. */
		onSort?: (field: TicketSortField) => void;
		checkInPending: boolean;
		confirmPaymentPending: boolean;
		cancelTicketPending: boolean;
		addMemberPending: boolean;
		unconfirmPaymentPending: boolean;
		tiersLoading: boolean;
		onCheckIn: (ticket: AdminTicketSchema) => void;
		onConfirmPayment: (ticket: AdminTicketSchema) => void;
		onMakeMember: (ticket: AdminTicketSchema) => void;
		onCancelTicket: (ticket: AdminTicketSchema) => void;
		onBlacklist: (ticket: AdminTicketSchema) => void;
		onUnconfirmPayment: (ticket: AdminTicketSchema) => void;
		/** Move a seated ticket to another seat. Omit to hide the action. */
		onReseat?: (ticket: AdminTicketSchema) => void;
		/** Rename the holder on a ticket. Omit to hide the action. */
		onRenameHolder?: (ticket: AdminTicketSchema) => void;
		/** Refund an online payment (full/partial). Omit to hide the action. */
		onRefundTicket?: (ticket: AdminTicketSchema) => void;
	}

	const {
		tickets,
		orderBy,
		onSort,
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
		onUnconfirmPayment,
		onReseat,
		onRenameHolder,
		onRefundTicket
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

{#snippet sortableHeader(label: string, field: TicketSortField)}
	{@const dir = sortDirection(orderBy, field)}
	<th
		class="px-4 py-3 text-left text-xs font-extrabold uppercase tracking-[0.12em] text-muted-foreground"
		aria-sort={dir === 'asc' ? 'ascending' : dir === 'desc' ? 'descending' : 'none'}
	>
		{#if onSort}
			<button
				type="button"
				class="-mx-1 inline-flex items-center gap-1 rounded px-1 transition-colors hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
				onclick={() => onSort(field)}
			>
				{label}
				{#if dir === 'asc'}
					<ChevronUp class="h-3.5 w-3.5 text-primary" aria-hidden="true" />
				{:else if dir === 'desc'}
					<ChevronDown class="h-3.5 w-3.5 text-primary" aria-hidden="true" />
				{:else}
					<ChevronsUpDown class="h-3.5 w-3.5 text-muted-foreground/40" aria-hidden="true" />
				{/if}
			</button>
		{:else}
			{label}
		{/if}
	</th>
{/snippet}

<div class="hidden overflow-x-auto rounded-lg border md:block">
	<table class="w-full">
		<thead class="border-b bg-muted/50">
			<tr>
				<th
					class="px-4 py-3 text-left text-xs font-extrabold uppercase tracking-[0.12em] text-muted-foreground"
					>{m['eventTicketsAdmin.headerAttendee']()}</th
				>
				{@render sortableHeader(m['eventTicketsAdmin.headerTier'](), 'tier__name')}
				{@render sortableHeader(m['eventTicketsAdmin.headerPrice'](), 'price')}
				{@render sortableHeader(
					m['eventTicketsAdmin.headerPaymentMethod'](),
					'tier__payment_method'
				)}
				{@render sortableHeader(m['eventTicketsAdmin.headerStatus'](), 'status')}
				{@render sortableHeader(m['eventTicketsAdmin.headerPurchased'](), 'created_at')}
				<th
					class="px-4 py-3 text-right text-xs font-extrabold uppercase tracking-[0.12em] text-muted-foreground"
					>{m['eventTicketsAdmin.headerActions']()}</th
				>
			</tr>
		</thead>
		<tbody class="divide-y">
			{#each tickets as ticket (ticket.id)}
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
										{m['ticketTable.purchasedBy']({ name: getUserDisplayName(ticket.user) })}
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
						<div class="whitespace-nowrap font-medium">{ticket.tier?.name || 'N/A'}</div>
						{#if ticket.series_pass}
							<SeriesPassBadge seriesPass={ticket.series_pass} class="mt-0.5" />
						{/if}
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
						<div class="whitespace-nowrap font-medium">
							{formatPrice(
								getTicketPrice(ticket),
								ticket.payment?.currency || ticket.tier?.currency,
								m['eventTicketsAdmin.free']()
							)}
						</div>
						<TicketDiscountBadge {ticket} />
					</td>
					<td class="px-4 py-3">
						<div class="flex items-center gap-1 whitespace-nowrap text-sm">
							{@render paymentMethodIcon(ticket.tier?.payment_method || '')}
							{getPaymentMethodLabel(ticket.tier?.payment_method || '')}
						</div>
					</td>
					<td class="px-4 py-3">
						<div class="flex flex-col gap-1">
							<StatusBadge
								tone={getTicketStatusTone(ticket.status ?? '')}
								label={getTicketStatusLabel(ticket.status ?? '')}
								class="w-fit whitespace-nowrap"
							/>
							<!-- Refund state renders independent of ticket status: since
							     organizer refunds, an active ticket can carry a (partial)
							     refund — never infer cancellation from refund state. -->
							<RefundStatusBadge
								status={ticket.payment?.refund_status}
								amount={ticket.payment?.refund_amount}
								currency={ticket.payment?.currency}
							/>
						</div>
					</td>
					<td class="whitespace-nowrap px-4 py-3 text-sm text-muted-foreground">
						{formatDate(ticket.created_at)}
					</td>
					<td class="px-4 py-3">
						<div class="flex justify-end gap-2">
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
							{#if onRefundTicket && canRefundTicketPayment(ticket)}
								<Button size="sm" variant="outline" onclick={() => onRefundTicket(ticket)}>
									<Undo2 class="h-4 w-4" aria-hidden="true" />
									{m['refundTicket.menuItem']()}
								</Button>
							{/if}
							{#if canAdminCancelTicket(ticket)}
								<Button
									size="sm"
									variant="outline"
									class="text-destructive hover:text-destructive"
									onclick={() => onCancelTicket(ticket)}
									disabled={cancelTicketPending}
								>
									<X class="h-4 w-4" aria-hidden="true" />
									{m['ticketTable.cancelTicket']()}
								</Button>
							{/if}
							<!-- More actions dropdown -->
							<DropdownMenu.Root>
								<DropdownMenu.Trigger>
									{#snippet child({ props })}
										<button
											{...props}
											class="inline-flex items-center justify-center rounded-md p-1 text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
											aria-label={m['ticketTable.moreActionsFor']({
												name: getUserDisplayName(ticket.user)
											})}
										>
											<MoreVertical class="h-4 w-4" aria-hidden="true" />
										</button>
									{/snippet}
								</DropdownMenu.Trigger>
								<DropdownMenu.Content align="end">
									{#if !ticket.membership && ticket.user?.id}
										<DropdownMenu.Item
											onclick={() => onMakeMember(ticket)}
											disabled={addMemberPending || tiersLoading}
										>
											<UserPlus class="mr-2 h-4 w-4" aria-hidden="true" />
											{m['makeMemberAction.button']()}
										</DropdownMenu.Item>
									{/if}
									{#if ticket.tier?.payment_method === 'online' && ticket.payment?.stripe_dashboard_url}
										<DropdownMenu.Item
											onclick={() => window.open(ticket.payment?.stripe_dashboard_url, '_blank')}
										>
											<ExternalLink class="mr-2 h-4 w-4" aria-hidden="true" />
											{m['ticketTable.manageOnStripe']()}
										</DropdownMenu.Item>
									{/if}
									{#if onRenameHolder && ticket.status !== 'checked_in' && ticket.status !== 'cancelled'}
										<DropdownMenu.Item onclick={() => onRenameHolder(ticket)}>
											<Pencil class="mr-2 h-4 w-4" aria-hidden="true" />
											{m['ticketTable.renameHolder']?.() ?? 'Rename holder'}
										</DropdownMenu.Item>
									{/if}
									{#if onReseat && ticket.seat?.id && ticket.status !== 'cancelled'}
										<DropdownMenu.Item onclick={() => onReseat(ticket)}>
											<Armchair class="mr-2 h-4 w-4" aria-hidden="true" />
											{m['ticketTable.moveSeat']?.() ?? 'Move seat'}
										</DropdownMenu.Item>
									{/if}
									{#if canUnconfirmPayment(ticket)}
										<DropdownMenu.Item
											onclick={() => onUnconfirmPayment(ticket)}
											disabled={unconfirmPaymentPending}
										>
											<Undo2 class="mr-2 h-4 w-4" aria-hidden="true" />
											{m['eventTicketsAdmin.actionUnconfirmPayment']()}
										</DropdownMenu.Item>
									{/if}
									{#if ticket.user?.id}
										<DropdownMenu.Item
											onclick={() => onBlacklist(ticket)}
											class="text-destructive focus:text-destructive"
										>
											<Ban class="mr-2 h-4 w-4" aria-hidden="true" />
											{m['ticketTable.blacklistUser']()}
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
