<script lang="ts">
	import * as m from '$lib/paraglide/messages.js';
	import type { EventTokenSchema } from '$lib/api/generated/types.gen';
	import { Button } from '$lib/components/ui/button';
	import { Copy, Edit, Trash2, Ticket } from '@lucide/svelte';
	import TokenStatusBadge from './TokenStatusBadge.svelte';
	import {
		getEventTokenStatus,
		formatTokenUsage,
		getExpirationDate,
		getExpirationDisplay,
		getEventTokenUrl
	} from '$lib/utils/tokens';
	import { toast } from 'svelte-sonner';

	interface Props {
		token: EventTokenSchema;
		orgSlug: string;
		eventSlug: string;
		onEdit: (token: EventTokenSchema) => void;
		onDelete: (token: EventTokenSchema) => void;
	}

	const { token, orgSlug, eventSlug, onEdit, onDelete }: Props = $props();

	const status = $derived(getEventTokenStatus(token));
	const usageDisplay = $derived(formatTokenUsage(token.uses, token.max_uses));
	const expirationDate = $derived(getExpirationDate(token.expires_at));
	const expirationCountdown = $derived(getExpirationDisplay(token.expires_at));

	async function copyLink() {
		if (!token.id) {
			toast.error(m['eventTokenCard.toastTokenIdMissing']());
			return;
		}
		const url = getEventTokenUrl(token.id, orgSlug, eventSlug);
		try {
			await navigator.clipboard.writeText(url);
			toast.success(m['eventTokenCard.toastLinkCopied']());
		} catch {
			toast.error(m['eventTokenCard.toastCopyFailed']());
		}
	}

	const hasTicketTiers = $derived((token.ticket_tiers?.length ?? 0) > 0);
	const accessType = $derived(
		token.grants_invitation
			? hasTicketTiers
				? m['eventTokenCard.accessInvitationTicket']()
				: m['eventTokenCard.accessInvitation']()
			: m['eventTokenCard.accessViewOnly']()
	);
</script>

<div class="rounded-lg border bg-card p-4 shadow-sm transition-shadow hover:shadow-md">
	<div class="flex items-start justify-between gap-4">
		<!-- Token Info -->
		<div class="flex-1 space-y-2">
			<!-- Name and Status -->
			<div class="flex items-center gap-2">
				<Ticket class="h-4 w-4 text-muted-foreground" aria-hidden="true" />
				<h3 class="font-semibold">
					{token.name || m['eventTokenCard.unnamedToken']()}
				</h3>
				<TokenStatusBadge {status} />
			</div>

			<!-- Details -->
			<div class="grid grid-cols-2 gap-2 text-sm text-muted-foreground md:grid-cols-3">
				<div>
					<span class="font-medium">{m['eventTokenCard.type']()}</span>
					{accessType}
				</div>
				<div>
					<span class="font-medium">{m['eventTokenCard.uses']()}</span>
					{usageDisplay}
				</div>
				<div>
					<span class="font-medium">{m['eventTokenCard.expires']()}</span>
					<span title={expirationCountdown}>{expirationDate}</span>
					<span class="sr-only">({expirationCountdown})</span>
				</div>
			</div>

			{#if hasTicketTiers}
				<div class="text-sm text-muted-foreground">
					<span class="font-medium">{m['eventTokenCard.ticketTier']()}</span>
					{token.ticket_tiers?.map((t) => t.name).join(', ')}
				</div>
			{/if}
		</div>

		<!-- Actions -->
		<div class="flex flex-col gap-1 sm:flex-row">
			<Button
				variant="ghost"
				size="sm"
				onclick={copyLink}
				aria-label={m['eventTokenCard.copyInvitationLink']()}
				title={m['eventTokenCard.copyLink']()}
			>
				<Copy class="h-4 w-4" aria-hidden="true" />
			</Button>
			<Button
				variant="ghost"
				size="sm"
				onclick={() => onEdit(token)}
				aria-label={m['eventTokenCard.editToken']()}
				title={m['eventTokenCard.edit']()}
			>
				<Edit class="h-4 w-4" aria-hidden="true" />
			</Button>
			<Button
				variant="ghost"
				size="sm"
				onclick={() => onDelete(token)}
				aria-label={m['eventTokenCard.deleteToken']()}
				title={m['eventTokenCard.delete']()}
				class="text-destructive hover:text-destructive"
			>
				<Trash2 class="h-4 w-4" aria-hidden="true" />
			</Button>
		</div>
	</div>
</div>
