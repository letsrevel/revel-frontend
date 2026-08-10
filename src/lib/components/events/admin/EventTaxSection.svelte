<script lang="ts">
	import * as m from '$lib/paraglide/messages.js';
	import { AlertTriangle, ChevronDown, ChevronRight, Landmark } from '@lucide/svelte';

	interface Props {
		formData: { is_virtual?: boolean; vat_country_code?: string };
		/**
		 * Server-derived country (venue city → event city → org country) from the
		 * loaded EventDetailSchema. Empty/undefined in create mode — no readout.
		 */
		effectiveVatCountry?: string;
		/**
		 * Server-computed organizer warning (BE #869): the event's effective VAT
		 * country differs from the organization's. Always false for virtual
		 * events, so no client-side gating is needed.
		 */
		vatCountryMismatch?: boolean;
		isOpen: boolean;
		onToggle: () => void;
		onUpdate: (data: { is_virtual?: boolean; vat_country_code?: string }) => void;
	}

	const {
		formData,
		effectiveVatCountry = '',
		vatCountryMismatch = false,
		isOpen,
		onToggle,
		onUpdate
	}: Props = $props();
</script>

<div class="overflow-hidden rounded-lg border border-border">
	<button
		type="button"
		onclick={onToggle}
		class="flex w-full items-center justify-between bg-muted/50 p-4 text-left transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
		aria-expanded={isOpen}
		data-testid="tax-section-toggle"
	>
		<div class="flex items-center gap-2 font-semibold">
			<Landmark class="h-5 w-5" aria-hidden="true" />
			{m['detailsStep.taxes']()}
		</div>
		{#if isOpen}
			<ChevronDown class="h-5 w-5" aria-hidden="true" />
		{:else}
			<ChevronRight class="h-5 w-5" aria-hidden="true" />
		{/if}
	</button>

	{#if isOpen}
		<div class="space-y-4 p-4">
			<!-- Virtual event toggle -->
			<label
				class="flex cursor-pointer items-center gap-3 rounded-md border border-input p-3 transition-colors hover:bg-accent"
			>
				<input
					type="checkbox"
					checked={formData.is_virtual || false}
					onchange={(e) => onUpdate({ is_virtual: e.currentTarget.checked })}
					class="h-4 w-4 rounded border-input text-primary focus:ring-2 focus:ring-ring"
				/>
				<div class="flex-1">
					<div class="font-medium">{m['detailsStep.virtualEvent']()}</div>
					<div class="text-sm text-muted-foreground">
						{m['detailsStep.virtualEventHint']()}
					</div>
				</div>
			</label>

			<!-- VAT country override -->
			<div class="space-y-2">
				<label for="vat-country-override" class="text-sm font-medium">
					{m['detailsStep.vatCountry']()}
				</label>
				<input
					id="vat-country-override"
					type="text"
					maxlength="2"
					autocomplete="off"
					value={formData.vat_country_code || ''}
					placeholder={m['detailsStep.vatCountryPlaceholder']()}
					aria-describedby="vat-country-override-hint{effectiveVatCountry
						? ' vat-country-effective'
						: ''}"
					oninput={(e) => onUpdate({ vat_country_code: e.currentTarget.value.toUpperCase() })}
					class="flex h-10 w-24 rounded-md border border-input bg-background px-3 py-2 text-sm uppercase transition-colors placeholder:text-muted-foreground focus:border-ring focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
				/>
				<p id="vat-country-override-hint" class="text-xs text-muted-foreground">
					{m['detailsStep.vatCountryHint']()}
				</p>
				{#if effectiveVatCountry}
					<p id="vat-country-effective" class="text-xs text-muted-foreground">
						{m['detailsStep.effectiveVatCountry']({ country: effectiveVatCountry })}
					</p>
				{/if}
			</div>

			<!-- Mismatch warning (server-computed; never fires for virtual events).
			     Tint/text pair mirrors MyTicketModal's audited warning banner
			     (bg-highlight/20 over --background: highlight-foreground light /
			     highlight dark, both ≥4.5 — COMPOSITED_PAIRS rows exist). -->
			{#if vatCountryMismatch}
				<!-- role="status" (4.1.3): the flag is server-computed and can appear
				     on a re-render after save while the section is already open. -->
				<div class="rounded-lg border border-highlight/40 bg-highlight/20 p-4" role="status">
					<div class="flex items-start gap-3">
						<AlertTriangle
							class="mt-0.5 h-5 w-5 shrink-0 text-highlight-foreground dark:text-highlight"
							aria-hidden="true"
						/>
						<div class="flex-1 space-y-1 text-highlight-foreground dark:text-highlight">
							<p class="font-medium">{m['detailsStep.vatCountryMismatchTitle']()}</p>
							<p class="text-sm">
								{m['detailsStep.vatCountryMismatchBody']({ country: effectiveVatCountry })}
							</p>
						</div>
					</div>
				</div>
			{/if}
		</div>
	{/if}
</div>
