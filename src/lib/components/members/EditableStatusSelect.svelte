<script lang="ts">
	import * as m from '$lib/paraglide/messages.js';
	import type { MembershipPaymentStatus } from '$lib/api/generated/types.gen';
	import { EDITABLE_STATUSES } from './paymentEdit';

	/**
	 * The status picker shared by "Record payment" and "Edit payment": exactly the
	 * statuses the backend accepts there (never refunded or voided, which have their
	 * own routes). When `value` is a status outside that set (a refunded row opened
	 * read-only) it is shown as one extra option so the field displays the real value
	 * instead of silently substituting another.
	 */
	interface Props {
		id: string;
		value: MembershipPaymentStatus;
		disabled?: boolean;
		describedBy?: string;
	}

	let { id, value = $bindable(), disabled = false, describedBy }: Props = $props();

	const LABELS: Record<MembershipPaymentStatus, () => string> = {
		succeeded: () => m['orgAdmin.members.subscriptions.recordPayment.statusOption.succeeded'](),
		pending: () => m['orgAdmin.members.subscriptions.recordPayment.statusOption.pending'](),
		failed: () => m['orgAdmin.members.subscriptions.recordPayment.statusOption.failed'](),
		refunded: () => m['orgAdmin.members.payments.status.refunded'](),
		voided: () => m['orgAdmin.members.payments.status.voided']()
	};

	const extra = $derived((EDITABLE_STATUSES as readonly string[]).includes(value) ? null : value);
</script>

<select
	{id}
	bind:value
	{disabled}
	aria-describedby={describedBy}
	class="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm transition-colors focus:border-ring focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60"
>
	{#each EDITABLE_STATUSES as s (s)}
		<option value={s}>{LABELS[s]()}</option>
	{/each}
	{#if extra}
		<option value={extra}>{LABELS[extra]()}</option>
	{/if}
</select>
