<script lang="ts">
	import * as m from '$lib/paraglide/messages.js';
	import type { OrganizationTokenSchema } from '$lib/api/generated/types.gen';
	import { Button } from '$lib/components/ui/button';
	import { Copy, Edit, Trash2, Users, Shield } from 'lucide-svelte';
	import TokenStatusBadge from './TokenStatusBadge.svelte';
	import {
		getOrganizationTokenStatus,
		formatTokenUsage,
		getExpirationDisplay,
		getOrganizationTokenUrl
	} from '$lib/utils/tokens';
	import { toast } from 'svelte-sonner';

	interface Props {
		token: OrganizationTokenSchema;
		organizationSlug: string;
		isOwner?: boolean;
		onEdit: (token: OrganizationTokenSchema) => void;
		onDelete: (token: OrganizationTokenSchema) => void;
		onShare: (token: OrganizationTokenSchema) => void;
	}

	const { token, organizationSlug, isOwner = true, onEdit, onDelete, onShare }: Props = $props();

	const canEditOrDelete = $derived(isOwner || !token.grants_staff_status);

	const status = $derived(getOrganizationTokenStatus(token));
	const usageDisplay = $derived(formatTokenUsage(token.uses, token.max_uses));
	const expirationDisplay = $derived(getExpirationDisplay(token.expires_at));

	async function copyLink() {
		if (!token.id) {
			toast.error(m['organizationTokenCard.tokenIdMissing']());
			return;
		}
		const url = getOrganizationTokenUrl(token.id, organizationSlug);
		try {
			await navigator.clipboard.writeText(url);
			toast.success(m['organizationTokenCard.linkCopied']());
		} catch {
			toast.error(m['organizationTokenCard.copyFailed']());
		}
	}

	function getAccessTypeDisplay(): string {
		if (token.grants_staff_status) {
			return m['organizationTokenCard.staffAccess']();
		} else if (token.grants_membership) {
			return m['organizationTokenCard.memberAccess']();
		}
		return m['organizationTokenCard.viewOnly']();
	}

	const accessType = $derived(getAccessTypeDisplay());
	const Icon = $derived(token.grants_staff_status ? Shield : Users);
</script>

<div class="rounded-lg border bg-card p-4 shadow-sm transition-shadow hover:shadow-md">
	<div class="flex items-start justify-between gap-4">
		<!-- Token Info -->
		<div class="flex-1 space-y-2">
			<!-- Name and Status -->
			<div class="flex items-center gap-2">
				<Icon class="h-4 w-4 text-muted-foreground" aria-hidden="true" />
				<h3 class="font-semibold">
					{token.name || m['organizationTokenCard.unnamedToken']()}
				</h3>
				<TokenStatusBadge {status} />
				{#if token.grants_staff_status}
					<TokenStatusBadge status="staff" />
				{/if}
			</div>

			<!-- Details -->
			<div class="grid grid-cols-2 gap-2 text-sm text-muted-foreground md:grid-cols-3">
				<div>
					<span class="font-medium">{m['organizationTokenCard.type']()}</span>
					{accessType}
				</div>
				<div>
					<span class="font-medium">{m['organizationTokenCard.uses']()}</span>
					{usageDisplay}
				</div>
				<div>
					<span class="font-medium">{m['organizationTokenCard.expires']()}</span>
					{expirationDisplay}
				</div>
			</div>
		</div>

		<!-- Actions -->
		<div class="flex flex-col gap-1 sm:flex-row">
			<Button
				variant="ghost"
				size="sm"
				onclick={copyLink}
				aria-label={m['organizationTokenCard.copyInvitationLinkLabel']()}
				title={m['organizationTokenCard.copyLinkTitle']()}
			>
				<Copy class="h-4 w-4" aria-hidden="true" />
			</Button>
			{#if canEditOrDelete}
				<Button
					variant="ghost"
					size="sm"
					onclick={() => onEdit(token)}
					aria-label={m['organizationTokenCard.editTokenLabel']()}
					title={m['organizationTokenCard.editTitle']()}
				>
					<Edit class="h-4 w-4" aria-hidden="true" />
				</Button>
				<Button
					variant="ghost"
					size="sm"
					onclick={() => onDelete(token)}
					aria-label={m['organizationTokenCard.deleteTokenLabel']()}
					title={m['organizationTokenCard.deleteTitle']()}
					class="text-destructive hover:text-destructive"
				>
					<Trash2 class="h-4 w-4" aria-hidden="true" />
				</Button>
			{/if}
		</div>
	</div>
</div>
