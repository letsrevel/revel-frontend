<script lang="ts">
	import * as m from '$lib/paraglide/messages.js';
	import type { EventComplianceSchema } from '$lib/api/generated/types.gen';
	import { Label } from '$lib/components/ui/label';
	import ComplianceCallout from '$lib/components/compliance/ComplianceCallout.svelte';
	import ComplianceNotices from '$lib/components/compliance/ComplianceNotices.svelte';
	import { noticesFor, onlinePaymentBlockedText } from '$lib/utils/compliance';

	type PaymentMethod = 'free' | 'offline' | 'at_the_door' | 'online';

	interface Props {
		paymentMethod: PaymentMethod;
		isPending: boolean;
		organizationStripeConnected: boolean;
		/**
		 * The event's `compliance` (#1001), never the org's: it accounts for where
		 * the event is held, so it matches the 422 the API would answer.
		 */
		compliance?: EventComplianceSchema | null;
	}

	let {
		paymentMethod = $bindable(),
		isPending,
		organizationStripeConnected,
		compliance = null
	}: Props = $props();

	const onlineBlocked = $derived(compliance?.online_payment === 'blocked');
	const salesNotices = $derived(noticesFor(compliance?.notices, 'ticket_sales'));
	const offlineNotices = $derived(noticesFor(compliance?.notices, 'offline_payment'));
</script>

<div class="space-y-2">
	<ComplianceNotices notices={salesNotices} />

	<div>
		<Label for="payment-method">{m['tierForm.paymentMethod']()}</Label>
		<select
			id="payment-method"
			bind:value={paymentMethod}
			disabled={isPending}
			aria-describedby={onlineBlocked ? 'tier-online-blocked' : undefined}
			class="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm transition-colors focus:border-ring focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
		>
			<option value="free">{m['tierForm.free']()}</option>
			<option value="offline">{m['tierForm.offline']()}</option>
			<option value="at_the_door">{m['tierForm.atTheDoor']()}</option>
			<option value="online" disabled={!organizationStripeConnected || onlineBlocked}>
				{m['tierForm.onlineStripe']()}
				{#if onlineBlocked}
					{m['compliance.tier.onlineUnavailableSuffix']()}
				{:else if !organizationStripeConnected}
					{m['tierForm.notConnectedSuffix']()}
				{/if}
			</option>
		</select>
		<p class="mt-1 text-xs text-muted-foreground">
			{#if paymentMethod === 'free'}
				{m['tierForm.paymentHelpFree']()}
			{:else if paymentMethod === 'offline'}
				{m['tierForm.paymentHelpOffline']()}
			{:else if paymentMethod === 'at_the_door'}
				{m['tierForm.paymentHelpAtTheDoor']()}
			{:else if paymentMethod === 'online'}
				{m['tierForm.paymentHelpOnline']()}
			{/if}
		</p>
	</div>

	{#if onlineBlocked}
		<ComplianceCallout id="tier-online-blocked" tone="blocked" testId="tier-online-blocked">
			<p>{onlinePaymentBlockedText(compliance?.venue_country ?? '')}</p>
		</ComplianceCallout>
	{/if}

	<!-- Offline / at-the-door rules (e.g. AT Registrierkasse): shown whatever the
	     current pick, since the selector itself is where those methods are chosen. -->
	<ComplianceNotices notices={offlineNotices} />
</div>
