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

<div class="space-y-4 md:hidden">
	{#each tickets as ticket}
		{@const guestName = getGuestNameIfDifferent(ticket)}
		{@const seatInfo = getSeatDisplay(ticket)}
		<div class="rounded-lg border bg-card p-4">
			<div class="mb-3 flex items-start justify-between gap-2">
				<div class="flex flex-1 items-start gap-3">
					<UserAvatar
						profilePictureUrl={ticket.user.profile_picture_url}
						previewUrl={ticket.user.profile_picture_preview_url}
						thumbnailUrl={ticket.user.profile_picture_thumbnail_url}
						displayName={getUserDisplayName(ticket.user)}
						firstName={ticket.user.first_name}
						lastName={ticket.user.last_name}
						size="md"
						clickable={true}
					/>
					<div>
						{#if guestName}
							<div class="flex flex-wrap items-center gap-x-2 gap-y-1">
								<span class="font-semibold">{guestName}</span>
							</div>
							<div class="text-sm text-muted-foreground">
								(Purchased by {getUserDisplayName(ticket.user)})
							</div>
						{:else}
							<div class="flex flex-wrap items-center gap-x-2 gap-y-1">
								<span class="font-semibold">{getUserDisplayName(ticket.user)}</span>
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
						<div class="text-sm text-muted-foreground">{ticket.user.email || 'N/A'}</div>
						{#if seatInfo}
							<div class="mt-1 text-xs text-primary">{seatInfo}</div>
						{/if}
					</div>
				</div>
				<div class="flex shrink-0 flex-col items-end gap-1">
					<span
						class={cn(
							'rounded-full px-2 py-1 text-xs font-semibold',
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
			</div>

			<div class="space-y-2 text-sm">
				<div class="flex items-center justify-between">
					<span class="text-muted-foreground">{m['eventTicketsAdmin.headerTier']()}:</span>
					<span class="font-medium">{ticket.tier?.name || 'N/A'}</span>
				</div>
				<div class="flex items-center justify-between">
					<span class="text-muted-foreground">{m['eventTicketsAdmin.headerPrice']()}:</span>
					<span class="font-medium"
						>{formatPrice(
							getTicketPrice(ticket),
							ticket.payment?.currency || ticket.tier?.currency,
							m['eventTicketsAdmin.free']()
						)}</span
					>
				</div>
				<div class="flex items-center justify-between">
					<span class="text-muted-foreground">{m['eventTicketsAdmin.labelPayment']()}:</span>
					<span class="flex items-center gap-1">
						{@render paymentMethodIcon(ticket.tier?.payment_method || '')}
						{getPaymentMethodLabel(ticket.tier?.payment_method || '')}
					</span>
				</div>
				<div class="flex items-center justify-between">
					<span class="text-muted-foreground">{m['eventTicketsAdmin.headerPurchased']()}:</span>
					<span>{new Date(ticket.created_at).toLocaleDateString()}</span>
				</div>
				{#if ticket.payment?.vat_amount != null}
					<div class="mt-2 space-y-1 border-t pt-2">
						<p class="text-xs font-medium text-muted-foreground">
							{m['tickets.vatBreakdown']()}
						</p>
						<div class="flex items-center justify-between text-xs">
							<span class="text-muted-foreground">{m['tickets.vatNet']()}:</span>
							<span class="font-mono"
								>{formatPrice(
									ticket.payment.net_amount,
									ticket.payment.currency || ticket.tier?.currency
								)}</span
							>
						</div>
						<div class="flex items-center justify-between text-xs">
							<span class="text-muted-foreground"
								>{m['tickets.vatLabel']({
									rate: String(ticket.payment.vat_rate ?? '')
								})}:</span
							>
							<span class="font-mono"
								>{formatPrice(
									ticket.payment.vat_amount,
									ticket.payment.currency || ticket.tier?.currency
								)}</span
							>
						</div>
						{#if ticket.payment.platform_fee_net != null}
							<div class="flex items-center justify-between text-xs">
								<span class="text-muted-foreground">{m['tickets.platformFeeNet']()}:</span>
								<span class="font-mono"
									>{formatPrice(
										ticket.payment.platform_fee_net,
										ticket.payment.currency || ticket.tier?.currency
									)}</span
								>
							</div>
							{#if ticket.payment.platform_fee_reverse_charge}
								<div class="flex items-center justify-between text-xs">
									<span class="text-muted-foreground">{m['tickets.reverseCharge']()}:</span>
									<span class="font-medium text-blue-600 dark:text-blue-400"
										>{m['tickets.reverseChargeYes']()}</span
									>
								</div>
							{/if}
						{/if}
					</div>
				{/if}
			</div>

			<div class="mt-3 flex flex-wrap gap-2">
				{#if canCheckIn(ticket)}
					<Button
						size="sm"
						variant="default"
						onclick={() => onCheckIn(ticket)}
						disabled={checkInPending}
						class="flex-1"
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
						class="flex-1"
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
						class="flex-1"
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
						class="w-full"
					>
						<ExternalLink class="h-4 w-4" aria-hidden="true" />
						Manage on Stripe
					</Button>
				{/if}
				<!-- More actions dropdown for mobile -->
				<DropdownMenu.Root>
					<DropdownMenu.Trigger>
						{#snippet child({ props })}
							<button
								{...props}
								class="inline-flex items-center justify-center rounded-md border border-input bg-background px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
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
		</div>
	{/each}
</div>
