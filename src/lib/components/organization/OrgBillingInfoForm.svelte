<script lang="ts">
	import * as m from '$lib/paraglide/messages.js';
	import { createMutation, useQueryClient } from '@tanstack/svelte-query';
	import { Button } from '$lib/components/ui/button';
	import { Input } from '$lib/components/ui/input';
	import { Label } from '$lib/components/ui/label';
	import * as Select from '$lib/components/ui/select';
	import { Info, Loader2 } from '@lucide/svelte';
	import { invalidateAll } from '$app/navigation';
	import { toast } from 'svelte-sonner';
	import { extractErrorMessage } from '$lib/utils/errors';
	import { organizationadminvatUpdateBillingInfo } from '$lib/api/generated/sdk.gen';
	import type {
		OrganizationBillingInfoSchema,
		OrganizationBillingInfoUpdateSchema
	} from '$lib/api/generated/types.gen';
	import PostalAddressFields from '$lib/components/billing/PostalAddressFields.svelte';
	import EinvoiceReadiness from '$lib/components/organization/EinvoiceReadiness.svelte';
	import {
		emptyPostalAddress,
		readPostalAddress,
		type PostalAddress
	} from '$lib/utils/postal-address';
	import { buildBillingInfoPayload, isAddressBlank } from '$lib/utils/einvoice';

	interface Props {
		slug: string;
		accessToken: string | null | undefined;
		info: OrganizationBillingInfoSchema;
		/** A VAT ID is set: the VAT country is then locked. */
		hasVatId: boolean;
	}

	const { slug, accessToken, info, hasVatId }: Props = $props();

	const queryClient = useQueryClient();

	// EU member states for the VAT country dropdown
	const EU_COUNTRIES: Array<{ code: string; name: string }> = [
		{ code: 'AT', name: 'Austria' },
		{ code: 'BE', name: 'Belgium' },
		{ code: 'BG', name: 'Bulgaria' },
		{ code: 'CY', name: 'Cyprus' },
		{ code: 'CZ', name: 'Czech Republic' },
		{ code: 'DE', name: 'Germany' },
		{ code: 'DK', name: 'Denmark' },
		{ code: 'EE', name: 'Estonia' },
		{ code: 'ES', name: 'Spain' },
		{ code: 'FI', name: 'Finland' },
		{ code: 'FR', name: 'France' },
		{ code: 'GR', name: 'Greece' },
		{ code: 'HR', name: 'Croatia' },
		{ code: 'HU', name: 'Hungary' },
		{ code: 'IE', name: 'Ireland' },
		{ code: 'IT', name: 'Italy' },
		{ code: 'LT', name: 'Lithuania' },
		{ code: 'LU', name: 'Luxembourg' },
		{ code: 'LV', name: 'Latvia' },
		{ code: 'MT', name: 'Malta' },
		{ code: 'NL', name: 'Netherlands' },
		{ code: 'PL', name: 'Poland' },
		{ code: 'PT', name: 'Portugal' },
		{ code: 'RO', name: 'Romania' },
		{ code: 'SE', name: 'Sweden' },
		{ code: 'SI', name: 'Slovenia' },
		{ code: 'SK', name: 'Slovakia' }
	];

	let countryCode = $state('');
	let vatRate = $state('');
	let billingName = $state('');
	let billingEmail = $state('');
	let vatExemptionReason = $state('');
	let address = $state<PostalAddress>(emptyPostalAddress());
	let billingFormDirty = $state(false);
	// Snapshot of the address as last synced from the server, to detect edits.
	let syncedAddress = JSON.stringify(emptyPostalAddress());

	// Sync form with server data until the user starts editing
	$effect(() => {
		if (!billingFormDirty) {
			countryCode = info.vat_country_code || '';
			vatRate = info.vat_rate || '';
			billingName = info.billing_name || '';
			billingEmail = info.billing_email || '';
			vatExemptionReason = info.vat_exemption_reason || '';
			const next = readPostalAddress(info as unknown as Record<string, unknown>, 'billing_');
			address = next;
			syncedAddress = JSON.stringify(next);
		}
	});

	$effect(() => {
		if (JSON.stringify(address) !== syncedAddress) billingFormDirty = true;
	});

	function markBillingDirty() {
		billingFormDirty = true;
	}

	// Legacy free text exists but no structured address yet: the owner must re-enter it.
	const legacyText = $derived((info.billing_address || '').trim());
	const showLegacyNote = $derived(
		legacyText !== '' && isAddressBlank(readPostalAddress(info, 'billing_'))
	);

	const invoicingOn = $derived(info.invoicing_mode === 'auto' || info.invoicing_mode === 'hybrid');
	const showEinvoiceNag = $derived(!info.einvoice_ready && invoicingOn);

	const updateBillingMutation = createMutation(() => ({
		mutationFn: async () => {
			// Backend fields are non-nullable strings with '' meaning "clear";
			// vat_rate is the only nullable field.
			const body: OrganizationBillingInfoUpdateSchema = buildBillingInfoPayload({
				countryCode,
				vatRate,
				billingName,
				billingEmail,
				vatExemptionReason,
				address,
				existingLegacyAddress: info.billing_address || ''
			});
			const response = await organizationadminvatUpdateBillingInfo({
				path: { slug },
				headers: { Authorization: `Bearer ${accessToken}` },
				body
			});
			if (response.error) {
				throw new Error(
					extractErrorMessage(response.error, m['orgAdmin.billing.billingInfo.error']())
				);
			}
			if (!response.data) throw new Error(m['orgAdmin.billing.billingInfo.error']());
			return response.data;
		},
		onSuccess: () => {
			billingFormDirty = false;
			queryClient.invalidateQueries({ queryKey: ['billing-info', slug] });
			invalidateAll();
			toast.success(m['orgAdmin.billing.billingInfo.saved']());
		},
		onError: (error: Error) => {
			toast.error(error.message);
		}
	}));

	function handleSave(e: Event) {
		e.preventDefault();
		updateBillingMutation.mutate();
	}
</script>

<div class="space-y-4">
	{#if showEinvoiceNag}
		<EinvoiceReadiness variant="warning" missingFields={info.einvoice_missing_fields} />
	{/if}

	<!-- novalidate: the address is visually required (invoicing needs it) but must not
	     block saving unrelated fields; the backend enforces it when invoicing is enabled. -->
	<form onsubmit={handleSave} class="space-y-4" novalidate>
		<!-- Country -->
		<div class="space-y-2">
			<Label for="billing-country">{m['orgAdmin.billing.billingInfo.country']()}</Label>
			{#if hasVatId}
				<div>
					<Input
						id="billing-country"
						value={EU_COUNTRIES.find((c) => c.code === countryCode)?.name || countryCode}
						disabled
					/>
					<p class="mt-1 text-xs text-muted-foreground">
						{m['orgAdmin.billing.billingInfo.countryDisabledHint']()}
					</p>
				</div>
			{:else}
				<Select.Root
					type="single"
					value={countryCode}
					onValueChange={(v) => {
						countryCode = v;
						markBillingDirty();
					}}
				>
					<Select.Trigger id="billing-country" class="w-full">
						{EU_COUNTRIES.find((c) => c.code === countryCode)?.name ||
							m['orgAdmin.billing.billingInfo.countryPlaceholder']()}
					</Select.Trigger>
					<Select.Content>
						{#each EU_COUNTRIES as country (country.code)}
							<Select.Item value={country.code}>{country.code} - {country.name}</Select.Item>
						{/each}
					</Select.Content>
				</Select.Root>
				<p class="text-xs text-muted-foreground">
					{m['orgAdmin.billing.billingInfo.countryHelp']()}
				</p>
			{/if}
		</div>

		<!-- VAT Rate -->
		<div class="space-y-2">
			<Label for="billing-vat-rate">{m['orgAdmin.billing.billingInfo.vatRate']()}</Label>
			<Input
				id="billing-vat-rate"
				type="number"
				step="0.01"
				min="0"
				max="100"
				placeholder={m['orgAdmin.billing.billingInfo.vatRatePlaceholder']()}
				bind:value={vatRate}
				oninput={markBillingDirty}
			/>
			<p class="text-xs text-muted-foreground">
				{m['orgAdmin.billing.billingInfo.vatRateHelp']()}
			</p>
		</div>

		<!-- Default VAT exemption reason -->
		<div class="space-y-2">
			<Label for="billing-vat-exemption-reason">{m['einvoice.exemptionLabel']()}</Label>
			<Input
				id="billing-vat-exemption-reason"
				type="text"
				maxlength={255}
				placeholder={m['einvoice.exemptionPlaceholder']()}
				aria-describedby="billing-vat-exemption-reason-help"
				bind:value={vatExemptionReason}
				oninput={markBillingDirty}
			/>
			<p id="billing-vat-exemption-reason-help" class="text-xs text-muted-foreground">
				{m['einvoice.exemptionHelp']()}
			</p>
		</div>

		<!-- Billing Name -->
		<div class="space-y-2">
			<Label for="billing-name">{m['orgAdmin.billing.billingInfo.billingName']()}</Label>
			<Input
				id="billing-name"
				type="text"
				placeholder={m['orgAdmin.billing.billingInfo.billingNamePlaceholder']()}
				bind:value={billingName}
				oninput={markBillingDirty}
			/>
			<p class="text-xs text-muted-foreground">
				{m['orgAdmin.billing.billingInfo.billingNameHelp']()}
			</p>
		</div>

		<!-- Billing Address (structured) -->
		<div class="space-y-3">
			{#if showLegacyNote}
				<p
					class="flex items-start gap-2 rounded-md border border-border bg-muted/40 p-3 text-sm"
					data-testid="legacy-address-note"
				>
					<Info class="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
					<span class="whitespace-pre-line">{m['einvoice.legacyNote']({ text: legacyText })}</span>
				</p>
			{/if}
			<PostalAddressFields
				idPrefix="billing-address"
				bind:value={address}
				required
				legend={m['einvoice.addressLegend']()}
			/>
		</div>

		<!-- Billing Email -->
		<div class="space-y-2">
			<Label for="billing-email">{m['orgAdmin.billing.billingInfo.billingEmail']()}</Label>
			<Input
				id="billing-email"
				type="email"
				placeholder={m['orgAdmin.billing.billingInfo.billingEmailPlaceholder']()}
				bind:value={billingEmail}
				oninput={markBillingDirty}
			/>
			<p class="text-xs text-muted-foreground">
				{m['orgAdmin.billing.billingInfo.billingEmailHelp']()}
			</p>
		</div>

		<div class="flex justify-end">
			<Button type="submit" disabled={updateBillingMutation.isPending || !billingFormDirty}>
				{#if updateBillingMutation.isPending}
					<Loader2 class="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />
					{m['orgAdmin.billing.billingInfo.saving']()}
				{:else}
					{m['orgAdmin.billing.billingInfo.saveButton']()}
				{/if}
			</Button>
		</div>
	</form>
</div>
