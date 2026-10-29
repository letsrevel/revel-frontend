<script lang="ts">
	import { untrack } from 'svelte';
	import * as m from '$lib/paraglide/messages.js';
	import { Button } from '$lib/components/ui/button';
	import { Input } from '$lib/components/ui/input';
	import { Label } from '$lib/components/ui/label';
	import { Loader2 } from '@lucide/svelte';
	import type {
		AttendeeInvoiceDetailSchema,
		UpdateAttendeeInvoiceSchema
	} from '$lib/api/generated/types.gen';
	import PostalAddressFields from '$lib/components/billing/PostalAddressFields.svelte';
	import { readPostalAddress, type PostalAddress } from '$lib/utils/postal-address';
	import { buildDraftBuyerUpdate } from '$lib/utils/attendee-invoice';

	interface Props {
		invoice: AttendeeInvoiceDetailSchema;
		pending?: boolean;
		onSave: (body: UpdateAttendeeInvoiceSchema) => void;
		onCancel: () => void;
	}

	const { invoice, pending = false, onSave, onCancel }: Props = $props();

	// Seeded once when the form opens; edits must not be overwritten by refetches.
	let name = $state(untrack(() => invoice.buyer_name || ''));
	let email = $state(untrack(() => invoice.buyer_email || ''));
	let vatId = $state(untrack(() => invoice.buyer_vat_id || ''));
	let vatCountry = $state(untrack(() => invoice.buyer_vat_country || ''));
	let legacyAddress = $state(untrack(() => invoice.buyer_address || ''));
	let address = $state<PostalAddress>(
		untrack(() => readPostalAddress(invoice as unknown as Record<string, unknown>, 'buyer_'))
	);

	function handleSubmit(e: Event) {
		e.preventDefault();
		onSave(buildDraftBuyerUpdate({ name, email, vatId, vatCountry, legacyAddress, address }));
	}
</script>

<form onsubmit={handleSubmit} class="space-y-2">
	<h3 class="font-medium">{m['orgAdmin.billing.attendeeInvoices.edit']()}</h3>
	<div>
		<Label for="edit-buyer-name">{m['orgAdmin.billing.attendeeInvoices.name']()}</Label>
		<Input id="edit-buyer-name" bind:value={name} />
	</div>
	<div>
		<Label for="edit-buyer-email">{m['orgAdmin.billing.attendeeInvoices.email']()}</Label>
		<Input id="edit-buyer-email" type="email" bind:value={email} />
	</div>
	<div class="grid grid-cols-2 gap-3">
		<div>
			<Label for="edit-buyer-vat-id">{m['orgAdmin.billing.attendeeInvoices.vatId']()}</Label>
			<Input id="edit-buyer-vat-id" bind:value={vatId} class="uppercase" />
		</div>
		<div>
			<Label for="edit-buyer-country">{m['orgAdmin.billing.attendeeInvoices.country']()}</Label>
			<Input id="edit-buyer-country" bind:value={vatCountry} class="uppercase" />
		</div>
	</div>
	<div class="pt-2">
		<PostalAddressFields
			idPrefix="edit-buyer-address"
			bind:value={address}
			legend={m['einvoice.buyerAddressLegend']()}
		/>
	</div>
	<div>
		<Label for="edit-buyer-address-legacy">{m['orgAdmin.billing.attendeeInvoices.address']()}</Label
		>
		<Input
			id="edit-buyer-address-legacy"
			bind:value={legacyAddress}
			aria-describedby="edit-buyer-address-legacy-hint"
		/>
		<p id="edit-buyer-address-legacy-hint" class="mt-1 text-xs text-muted-foreground">
			{m['einvoice.buyerLegacyHint']()}
		</p>
	</div>
	<div class="flex gap-2">
		<Button type="submit" disabled={pending}>
			{#if pending}<Loader2 class="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />{/if}
			{m['orgAdmin.billing.attendeeInvoices.save']()}
		</Button>
		<Button type="button" variant="outline" onclick={onCancel}>{m['common.cancel']()}</Button>
	</div>
</form>
