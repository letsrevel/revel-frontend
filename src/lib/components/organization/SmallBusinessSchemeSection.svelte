<script lang="ts">
	import * as m from '$lib/paraglide/messages.js';
	import { createMutation, useQueryClient } from '@tanstack/svelte-query';
	import { Button } from '$lib/components/ui/button';
	import { Checkbox } from '$lib/components/ui/checkbox';
	import { Input } from '$lib/components/ui/input';
	import { Label } from '$lib/components/ui/label';
	import { AlertCircle, Check, Info, Loader2 } from '@lucide/svelte';
	import { resolve } from '$app/paths';
	import { invalidateAll } from '$app/navigation';
	import { toast } from 'svelte-sonner';
	import { extractErrorMessage } from '$lib/utils/errors';
	import { countryName } from '$lib/utils/compliance';
	import { organizationadminvatUpdateBillingInfo } from '$lib/api/generated/sdk.gen';
	import type {
		OrganizationBillingInfoSchema,
		OrganizationBillingInfoUpdateSchema,
		SmallBusinessScheme
	} from '$lib/api/generated/types.gen';
	import {
		TAX_NUMBER_EXAMPLES,
		isTaxNumberValid,
		resolveOrgCountry,
		schemeBlockers,
		schemeCountry,
		schemeExemptionNote,
		schemeForCountry,
		schemeRequiresVatId,
		vatRateIsPositive,
		type SchemeBlocker
	} from '$lib/utils/small-business';

	interface Props {
		slug: string;
		accessToken: string | null | undefined;
		info: OrganizationBillingInfoSchema;
	}

	const { slug, accessToken, info }: Props = $props();

	const queryClient = useQueryClient();

	const current = $derived<SmallBusinessScheme>(info.small_business_scheme ?? 'none');
	const country = $derived(
		resolveOrgCountry({
			vatCountryCode: info.vat_country_code,
			vatId: info.vat_id,
			billingCountryCode: info.billing_country_code,
			fallback: info.compliance?.country
		})
	);
	/** The scheme this organization may declare given where it is established. */
	const available = $derived(schemeForCountry(country));
	/** A declared scheme that does not fit the country (legacy data): can only be removed. */
	const mismatched = $derived(current !== 'none' && schemeCountry(current) !== country);

	let enabled = $state(false);
	let taxNumber = $state('');
	let confirmZero = $state(false);
	let touched = $state(false);
	let dirty = $state(false);

	// Follow the server until the user starts editing.
	$effect(() => {
		if (!dirty) {
			enabled = current !== 'none';
			taxNumber = info.tax_registration_number ?? '';
			confirmZero = false;
			touched = false;
		}
	});

	/** The scheme the form would save. */
	const formScheme = $derived<SmallBusinessScheme>(enabled ? (available ?? current) : 'none');
	const formCountry = $derived(schemeCountry(formScheme));
	const needsZeroRate = $derived(enabled && vatRateIsPositive(info.vat_rate));
	const blockers = $derived(
		schemeBlockers({
			scheme: formScheme,
			country,
			vatIdValidated: info.vat_id_validated === true,
			taxNumber,
			vatRate: info.vat_rate,
			vatRateZeroConfirmed: confirmZero
		})
	);
	const isDirty = $derived(
		formScheme !== current ||
			(enabled && taxNumber.trim() !== (info.tax_registration_number ?? '').trim())
	);
	const declaring = $derived(enabled && current === 'none');
	const taxNumberRequired = $derived(formScheme === 'at_6_1_27');
	const taxNumberExample = $derived(TAX_NUMBER_EXAMPLES[formCountry] ?? '');
	const taxNumberError = $derived.by(() => {
		if (!touched || !enabled) return '';
		const trimmed = taxNumber.trim();
		if (trimmed === '') {
			return taxNumberRequired ? m['smallBiz.taxNumberRequired']() : '';
		}
		if (isTaxNumberValid(formCountry, trimmed)) return '';
		return formCountry === 'AT'
			? m['smallBiz.taxNumberInvalidAt']({ example: taxNumberExample })
			: m['smallBiz.taxNumberInvalidDe']({ example: taxNumberExample });
	});
	const taxNumberDescribedBy = $derived(
		['small-business-tax-number-hint', taxNumberError ? 'small-business-tax-number-error' : '']
			.filter(Boolean)
			.join(' ')
	);
	const toggleLabel = $derived.by(() => {
		const scheme = available ?? current;
		if (scheme === 'at_6_1_27') return m['smallBiz.toggleAt']();
		if (scheme === 'de_19') return m['smallBiz.toggleDe']();
		return m['smallBiz.toggleRemove']();
	});

	const BLOCKER_TEXT: Record<SchemeBlocker, () => string> = {
		wrong_country: () => m['smallBiz.blocker.wrong_country'](),
		vat_id_not_validated: () => m['smallBiz.blocker.vat_id_not_validated'](),
		tax_number_required: () => m['smallBiz.blocker.tax_number_required'](),
		tax_number_invalid: () => m['smallBiz.blocker.tax_number_invalid'](),
		vat_rate_not_zero: () => m['smallBiz.blocker.vat_rate_not_zero']()
	};

	const saveMutation = createMutation(() => ({
		mutationFn: async () => {
			const body: OrganizationBillingInfoUpdateSchema = { small_business_scheme: formScheme };
			if (enabled) {
				body.tax_registration_number = taxNumber.trim();
				if (needsZeroRate) body.vat_rate = 0;
			}
			const response = await organizationadminvatUpdateBillingInfo({
				path: { slug },
				headers: { Authorization: `Bearer ${accessToken}` },
				body
			});
			if (response.error) {
				throw new Error(extractErrorMessage(response.error, m['smallBiz.error']()));
			}
			if (!response.data) throw new Error(m['smallBiz.error']());
			return response.data;
		},
		onSuccess: () => {
			dirty = false;
			queryClient.invalidateQueries({ queryKey: ['billing-info', slug] });
			// The tier form reads the scheme from the layout org.
			void invalidateAll();
			toast.success(m['smallBiz.saved']());
		},
		// No toast: the persistent role="alert" block below is the feedback, and a toast on top
		// would announce the same refusal twice. The local handler also replaces the global toast.
		onError: () => undefined
	}));

	function edited() {
		dirty = true;
		saveMutation.reset();
	}

	function handleSubmit(e: Event) {
		e.preventDefault();
		touched = true;
		if (blockers.length > 0 || !isDirty || saveMutation.isPending) return;
		saveMutation.mutate();
	}
</script>

<div class="space-y-4" data-testid="small-business-section">
	<p class="text-sm text-muted-foreground">{m['smallBiz.intro']()}</p>

	{#if country}
		<p class="text-sm text-muted-foreground">
			{m['smallBiz.establishedIn']({ country: countryName(country) })}
		</p>
	{/if}

	{#if mismatched}
		<p
			class="flex items-start gap-2 rounded-md border border-border bg-muted/40 p-3 text-sm"
			data-testid="small-business-mismatch"
		>
			<Info class="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
			<span>{m['smallBiz.mismatch']()}</span>
		</p>
	{/if}

	{#if !available && !mismatched}
		<div class="space-y-1 text-sm" data-testid="small-business-unavailable">
			<p>{m['smallBiz.unavailable']()}</p>
			{#if !country}
				<p class="text-muted-foreground">{m['smallBiz.unavailableUndeclared']()}</p>
			{/if}
		</div>
	{:else}
		<form onsubmit={handleSubmit} class="space-y-4" novalidate>
			<div class="flex items-start gap-2">
				<Checkbox
					id="small-business-enabled"
					class="mt-0.5"
					checked={enabled}
					onCheckedChange={(v) => {
						enabled = v === true;
						edited();
					}}
					disabled={saveMutation.isPending}
				/>
				<div class="grid gap-1">
					<Label for="small-business-enabled" class="cursor-pointer font-medium">
						{toggleLabel}
					</Label>
					{#if current !== 'none' && !enabled}
						<p class="text-xs text-muted-foreground">{m['smallBiz.removeHint']()}</p>
					{/if}
				</div>
			</div>

			{#if enabled && available}
				<div class="space-y-2">
					<Label for="small-business-tax-number">
						{m['smallBiz.taxNumberLabel']()}
						{#if !taxNumberRequired}
							<span class="font-normal text-muted-foreground">{m['smallBiz.optional']()}</span>
						{/if}
					</Label>
					<Input
						id="small-business-tax-number"
						type="text"
						maxlength={32}
						autocomplete="off"
						bind:value={taxNumber}
						oninput={edited}
						onblur={() => (touched = true)}
						required={taxNumberRequired || undefined}
						aria-required={taxNumberRequired ? 'true' : undefined}
						aria-invalid={taxNumberError ? 'true' : undefined}
						aria-describedby={taxNumberDescribedBy}
						disabled={saveMutation.isPending}
					/>
					<p id="small-business-tax-number-hint" class="text-xs text-muted-foreground">
						{m['smallBiz.taxNumberHint']({ example: taxNumberExample })}
					</p>
					{#if taxNumberError}
						<p id="small-business-tax-number-error" class="text-sm text-destructive">
							{taxNumberError}
						</p>
					{/if}
				</div>

				{#if schemeRequiresVatId(formScheme)}
					<div
						class="space-y-2 rounded-md border border-border bg-muted/40 p-3 text-sm"
						data-testid="small-business-vat-id-note"
					>
						<p>{m['smallBiz.vatIdNote']()}</p>
						<p class="flex items-center gap-2 font-medium">
							{#if info.vat_id_validated}
								<Check class="h-4 w-4 shrink-0" aria-hidden="true" />
								{m['smallBiz.vatIdOk']()}
							{:else}
								<AlertCircle class="h-4 w-4 shrink-0" aria-hidden="true" />
								{m['smallBiz.vatIdMissing']()}
							{/if}
						</p>
						<!-- eslint-disable-next-line svelte/no-navigation-without-resolve -- in-page anchor -->
						<a href="#vat-id-section" class="text-primary underline underline-offset-2">
							{m['smallBiz.vatIdLink']()}
						</a>
					</div>
				{/if}

				{#if needsZeroRate}
					<div
						class="space-y-2 rounded-md border border-highlight/40 bg-highlight/20 p-3 text-sm"
						data-testid="small-business-vat-rate"
					>
						<p class="font-medium">
							{m['smallBiz.vatRateCallout']({ rate: String(parseFloat(String(info.vat_rate))) })}
						</p>
						<div class="flex items-start gap-2">
							<Checkbox
								id="small-business-zero-rate"
								class="mt-0.5"
								checked={confirmZero}
								onCheckedChange={(v) => {
									confirmZero = v === true;
									edited();
								}}
								disabled={saveMutation.isPending}
							/>
							<Label for="small-business-zero-rate" class="cursor-pointer font-medium">
								{m['smallBiz.vatRateConfirm']()}
							</Label>
						</div>
					</div>
				{/if}

				{#if declaring}
					<p class="text-sm text-muted-foreground" data-testid="small-business-tiers-hint">
						{m['smallBiz.tiersHint']()}
						<a
							href={resolve('/(auth)/org/[slug]/admin/events', { slug })}
							class="text-primary underline underline-offset-2"
						>
							{m['smallBiz.tiersLink']()}
						</a>
					</p>
				{/if}

				<div class="space-y-1">
					<p class="text-sm font-medium" id="small-business-note-label">
						{m['smallBiz.noteLabel']()}
					</p>
					<blockquote
						lang="de"
						aria-labelledby="small-business-note-label"
						class="rounded-md border-l-4 border-border bg-muted/40 px-3 py-2 text-sm"
						data-testid="small-business-note"
					>
						{schemeExemptionNote(formScheme)}
					</blockquote>
				</div>
			{/if}

			{#if blockers.length > 0}
				<div class="text-sm" data-testid="small-business-blockers">
					<p class="font-medium">{m['smallBiz.blockersTitle']()}</p>
					<ul class="list-disc space-y-0.5 pl-5">
						{#each blockers as b (b)}
							<li>{BLOCKER_TEXT[b]()}</li>
						{/each}
					</ul>
				</div>
			{/if}

			{#if saveMutation.error}
				<div
					class="flex items-start gap-2 rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-foreground"
					role="alert"
					data-testid="small-business-error"
				>
					<AlertCircle class="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
					<p>{saveMutation.error.message}</p>
				</div>
			{/if}

			<div class="flex justify-end">
				<Button type="submit" disabled={saveMutation.isPending || !isDirty || blockers.length > 0}>
					{#if saveMutation.isPending}
						<Loader2 class="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />
						{m['smallBiz.saving']()}
					{:else}
						{m['smallBiz.save']()}
					{/if}
				</Button>
			</div>
		</form>
	{/if}
</div>
