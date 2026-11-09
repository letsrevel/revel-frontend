<script lang="ts">
	import * as m from '$lib/paraglide/messages.js';
	import { Unlink } from '@lucide/svelte';
	import type { MembershipRecordSchema } from '$lib/api/generated/types.gen';
	import SectionHeader from '$lib/components/common/SectionHeader.svelte';
	import StatusBadge from '$lib/components/common/StatusBadge.svelte';
	import { Button } from '$lib/components/ui/button';
	import { formatDateTime } from '$lib/utils/date';
	import { canUnlink } from '$lib/member-register/reconcile';

	interface Props {
		record: MembershipRecordSchema;
		onUnlink: (record: MembershipRecordSchema) => void;
	}

	const { record, onUnlink }: Props = $props();

	function viaLabel(via: MembershipRecordSchema['linked_via']): string | null {
		switch (via) {
			case 'auto_email':
				return m['memberRegister.badgeLinkedAuto']();
			case 'invite':
				return m['memberPeople.sheet.via.invite']();
			case 'approval':
				return m['memberPeople.sheet.via.approval']();
			case 'merge':
				return m['memberPeople.sheet.via.merge']();
			default:
				return null;
		}
	}

	const via = $derived(viaLabel(record.linked_via));
</script>

<section aria-labelledby="person-account-heading" class="space-y-3" data-testid="person-account">
	<SectionHeader
		id="person-account-heading"
		level={3}
		title={m['memberPeople.sheet.accountHeading']()}
	/>

	{#if record.has_account}
		<div class="space-y-1 text-sm">
			{#if via}<p>{via}</p>{/if}
			{#if record.linked_at}
				<p class="text-muted-foreground">
					{m['memberPeople.sheet.linkedAt']({ date: formatDateTime(record.linked_at) })}
				</p>
			{/if}
		</div>
	{:else}
		<p class="text-sm text-muted-foreground">{m['memberPeople.sheet.noAccount']()}</p>
	{/if}

	{#if record.has_duplicate_claim}
		<div class="flex flex-wrap items-center gap-2 text-sm" data-testid="person-duplicate-hint">
			<StatusBadge tone="warning" label={m['memberRegister.badgeDuplicateClaim']()} size="sm" />
			<span>{m['memberPeople.sheet.duplicateHint']()}</span>
		</div>
	{/if}

	{#if canUnlink(record)}
		<Button variant="outline" onclick={() => onUnlink(record)} data-testid="person-unlink">
			<Unlink aria-hidden="true" />
			{m['memberRegister.actionUnlink']()}
		</Button>
	{/if}
</section>
