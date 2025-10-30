<script lang="ts">
	import type { EventTokenSchema } from '$lib/api/generated/types.gen';
	import { Button } from '$lib/components/ui/button';
	import { Copy, Edit, Trash2, Ticket } from 'lucide-svelte';
	import TokenStatusBadge from './TokenStatusBadge.svelte';
	import {
		getEventTokenStatus,
		formatTokenUsage,
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
		onShare: (token: EventTokenSchema) => void;
	}

	let { token, orgSlug, eventSlug, onEdit, onDelete, onShare }: Props = $props();

	const status = $derived(getEventTokenStatus(token));
	const usageDisplay = $derived(formatTokenUsage(token.uses, token.max_uses));
	const expirationDisplay = $derived(getExpirationDisplay(token.expires_at));

	async function copyLink() {
		const url = getEventTokenUrl(token.id || '', orgSlug, eventSlug);
		try {
			await navigator.clipboard.writeText(url);
			toast.success('Link copied to clipboard!');
		} catch {
			toast.error('Failed to copy link');
		}
	}

	const hasTicketTier = $derived(!!token.ticket_tier);
	const accessType = $derived(
		token.grants_invitation ? (hasTicketTier ? 'Invitation + Ticket' : 'Invitation') : 'View Only'
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
					{token.name || 'Unnamed Token'}
				</h3>
				<TokenStatusBadge {status} />
			</div>

			<!-- Details -->
			<div class="grid grid-cols-2 gap-2 text-sm text-muted-foreground md:grid-cols-3">
				<div>
					<span class="font-medium">Type:</span>
					{accessType}
				</div>
				<div>
					<span class="font-medium">Uses:</span>
					{usageDisplay}
				</div>
				<div>
					<span class="font-medium">Expires:</span>
					{expirationDisplay}
				</div>
			</div>

			{#if hasTicketTier}
				<div class="text-sm text-muted-foreground">
					<span class="font-medium">Ticket Tier:</span>
					{token.ticket_tier}
				</div>
			{/if}
		</div>

		<!-- Actions -->
		<div class="flex flex-col gap-1 sm:flex-row">
			<Button
				variant="ghost"
				size="sm"
				onclick={copyLink}
				aria-label="Copy invitation link"
				title="Copy Link"
			>
				<Copy class="h-4 w-4" aria-hidden="true" />
			</Button>
			<Button
				variant="ghost"
				size="sm"
				onclick={() => onEdit(token)}
				aria-label="Edit token"
				title="Edit"
			>
				<Edit class="h-4 w-4" aria-hidden="true" />
			</Button>
			<Button
				variant="ghost"
				size="sm"
				onclick={() => onDelete(token)}
				aria-label="Delete token"
				title="Delete"
				class="text-destructive hover:text-destructive"
			>
				<Trash2 class="h-4 w-4" aria-hidden="true" />
			</Button>
		</div>
	</div>
</div>
