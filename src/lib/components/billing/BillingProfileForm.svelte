<script lang="ts">
	// 1. Imports
	import * as m from '$lib/paraglide/messages.js';
	import { createQuery, createMutation, useQueryClient } from '@tanstack/svelte-query';
	import { toast } from 'svelte-sonner';
	import { Button } from '$lib/components/ui/button';
	import { Input } from '$lib/components/ui/input';
	import { Label } from '$lib/components/ui/label';
	import { Check, AlertCircle, AlertTriangle, Loader2, Shield } from 'lucide-svelte';
	import {
		userbillingGetBillingProfile,
		userbillingCreateBillingProfile,
		userbillingUpdateBillingProfile,
		userbillingSetVatId,
		userbillingDeleteVatId
	} from '$lib/api/generated/sdk.gen';
	import type { UserBillingProfileSchema } from '$lib/api/generated/types.gen';

	// 2. Props interface
	interface Props {
		authToken: string | null;
		showSelfBilling?: boolean;
	}

	const { authToken, showSelfBilling = false }: Props = $props();

	// 3. Query client
	const queryClient = useQueryClient();

	// 4. Fetch billing profile
	const billingQuery = createQuery<UserBillingProfileSchema | null>(() => ({
		queryKey: ['user-billing-profile'],
		queryFn: async () => {
			if (!authToken) return null;
			const response = await userbillingGetBillingProfile({
				headers: { Authorization: `Bearer ${authToken}` }
			});
			if (response.response?.status === 404) return null;
			if (response.error) throw new Error('Failed to fetch billing profile');
			return (response.data as UserBillingProfileSchema) ?? null;
		},
		enabled: !!authToken,
		retry: false,
		staleTime: 60_000
	}));

	// 5. Derived profile state
	const billingProfile = $derived(billingQuery.data ?? null);
	const hasBillingProfile = $derived(billingProfile !== null && billingProfile !== undefined);
	const isBillingComplete = $derived(
		hasBillingProfile &&
			!!billingProfile?.billing_name &&
			!!billingProfile?.vat_country_code &&
			!!billingProfile?.billing_address
	);

	// 6. Form state
	let billingName = $state('');
	let billingAddress = $state('');
	let vatCountryCode = $state('');
	let billingEmail = $state('');
	let vatIdInput = $state('');
	let selfBillingAgreed = $state(false);
	let saveStatus = $state<'idle' | 'saving' | 'saved' | 'error'>('idle');

	// 7. Sync form from query data
	$effect(() => {
		if (billingProfile) {
			billingName = billingProfile.billing_name ?? '';
			billingAddress = billingProfile.billing_address ?? '';
			vatCountryCode = billingProfile.vat_country_code ?? '';
			billingEmail = billingProfile.billing_email ?? '';
			vatIdInput = billingProfile.vat_id ?? '';
			selfBillingAgreed = billingProfile.self_billing_agreed ?? false;
		}
	});

	// 8. Save mutation
	const saveMutation = createMutation(() => ({
		mutationFn: async () => {
			const headers = { Authorization: `Bearer ${authToken}` };
			const baseBody = {
				billing_name: billingName,
				billing_address: billingAddress,
				vat_country_code: vatCountryCode,
				...(billingEmail.trim() ? { billing_email: billingEmail.trim() } : {})
			};
			const body = showSelfBilling
				? { ...baseBody, self_billing_agreed: selfBillingAgreed }
				: baseBody;

			if (hasBillingProfile) {
				const response = await userbillingUpdateBillingProfile({ headers, body });
				if (response.error) throw new Error('Failed to update billing profile');
				return response.data;
			} else {
				const response = await userbillingCreateBillingProfile({ headers, body });
				if (response.error) throw new Error('Failed to create billing profile');
				return response.data;
			}
		},
		onSuccess: () => {
			saveStatus = 'saved';
			queryClient.invalidateQueries({ queryKey: ['user-billing-profile'] });
			toast.success(m['billing.form.saved']());
			setTimeout(() => (saveStatus = 'idle'), 2000);
		},
		onError: () => {
			saveStatus = 'error';
			toast.error(m['billing.form.error']());
			setTimeout(() => (saveStatus = 'idle'), 3000);
		}
	}));

	// 9. VAT ID mutations
	const vatSetMutation = createMutation(() => ({
		mutationFn: async () => {
			const response = await userbillingSetVatId({
				headers: { Authorization: `Bearer ${authToken}` },
				body: { vat_id: vatIdInput.trim().toUpperCase() }
			});
			if (response.error) throw new Error('Failed to set VAT ID');
			return response.data;
		},
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ['user-billing-profile'] });
		},
		onError: () => {
			toast.error(m['billing.form.error']());
		}
	}));

	const vatDeleteMutation = createMutation(() => ({
		mutationFn: async () => {
			const response = await userbillingDeleteVatId({
				headers: { Authorization: `Bearer ${authToken}` }
			});
			if (response.error) throw new Error('Failed to remove VAT ID');
			return response.data;
		},
		onSuccess: () => {
			vatIdInput = '';
			queryClient.invalidateQueries({ queryKey: ['user-billing-profile'] });
		},
		onError: () => {
			toast.error(m['billing.form.error']());
		}
	}));

	// 10. Submit handler
	function handleSave(): void {
		saveStatus = 'saving';
		saveMutation.mutate();
	}

	// 11. VAT ID validation status label
	const vatIdStatus = $derived.by(() => {
		if (!billingProfile?.vat_id) return 'not-set' as const;
		if (billingProfile.vat_id_validated) return 'validated' as const;
		return 'pending' as const;
	});
</script>

<!-- Incomplete warning (only shown when profile exists but is incomplete) -->
{#if hasBillingProfile && !isBillingComplete}
	<div
		class="mt-4 flex items-start gap-3 rounded-lg border border-amber-300 bg-amber-50 p-4 dark:border-amber-700 dark:bg-amber-950/30"
		role="alert"
		aria-live="polite"
	>
		<AlertTriangle
			class="mt-0.5 h-5 w-5 shrink-0 text-amber-600 dark:text-amber-400"
			aria-hidden="true"
		/>
		<div>
			<p class="font-medium text-amber-900 dark:text-amber-100">
				{m['billing.form.incomplete']()}
			</p>
			<p class="mt-1 text-sm text-amber-800 dark:text-amber-200">
				{m['billing.form.incompleteDescription']()}
			</p>
		</div>
	</div>
{/if}

<!-- Billing form -->
<form
	onsubmit={(e) => {
		e.preventDefault();
		handleSave();
	}}
	class="mt-4 space-y-4"
	aria-label={m['billing.form.title']()}
	novalidate
>
	<!-- Billing Name -->
	<div class="space-y-2">
		<Label for="billingName">
			{m['billing.form.billingName']()}
			<span aria-hidden="true" class="ml-0.5 text-destructive">*</span>
			<span class="sr-only">(required)</span>
		</Label>
		<Input
			id="billingName"
			bind:value={billingName}
			placeholder={m['billing.form.billingNamePlaceholder']()}
			required
			aria-required="true"
			autocomplete="organization"
		/>
	</div>

	<!-- Billing Address -->
	<div class="space-y-2">
		<Label for="billingAddress">
			{m['billing.form.billingAddress']()}
			<span aria-hidden="true" class="ml-0.5 text-destructive">*</span>
			<span class="sr-only">(required)</span>
		</Label>
		<Input
			id="billingAddress"
			bind:value={billingAddress}
			placeholder={m['billing.form.billingAddressPlaceholder']()}
			required
			aria-required="true"
			autocomplete="street-address"
		/>
	</div>

	<!-- VAT Country Code -->
	<div class="space-y-2">
		<Label for="vatCountryCode">
			{m['billing.form.vatCountryCode']()}
			<span aria-hidden="true" class="ml-0.5 text-destructive">*</span>
			<span class="sr-only">(required)</span>
		</Label>
		<Input
			id="vatCountryCode"
			bind:value={vatCountryCode}
			placeholder={m['billing.form.vatCountryCodePlaceholder']()}
			maxlength={2}
			class="max-w-24 uppercase"
			required
			aria-required="true"
			aria-describedby="vatCountryCodeHint"
			autocomplete="country"
			oninput={(e) => {
				vatCountryCode = (e.currentTarget as HTMLInputElement).value.toUpperCase();
			}}
		/>
		<p id="vatCountryCodeHint" class="text-xs text-muted-foreground">
			{m['billing.form.vatCountryCodePlaceholder']()}
		</p>
	</div>

	<!-- Billing Email (optional) -->
	<div class="space-y-2">
		<Label for="billingEmail">
			{m['billing.form.billingEmail']()}
		</Label>
		<Input
			id="billingEmail"
			type="email"
			bind:value={billingEmail}
			placeholder={m['billing.form.billingEmailPlaceholder']()}
			autocomplete="email"
		/>
	</div>

	<!-- Self-Billing Agreement (conditional) -->
	{#if showSelfBilling}
		<div class="rounded-lg border bg-muted/50 p-4" aria-labelledby="selfBillingHeading">
			<div class="flex items-center gap-2">
				<Shield class="h-4 w-4 text-muted-foreground" aria-hidden="true" />
				<h3 id="selfBillingHeading" class="text-sm font-semibold">
					{m['billing.form.selfBilling']()}
				</h3>
			</div>
			<p class="mt-1 text-xs text-muted-foreground">
				{m['billing.form.selfBillingDescription']()}
			</p>
			<div class="mt-3 flex items-start gap-3">
				<input
					id="selfBillingCheckbox"
					type="checkbox"
					bind:checked={selfBillingAgreed}
					class="mt-1 h-4 w-4 rounded border-input accent-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
					aria-describedby="selfBillingHeading"
				/>
				<label for="selfBillingCheckbox" class="cursor-pointer text-sm leading-relaxed">
					{m['billing.form.selfBillingCheckbox']()}
					<a
						href="/legal/terms"
						target="_blank"
						rel="noopener noreferrer"
						class="text-primary underline-offset-4 hover:underline"
					>
						{m['billing.form.termsAndConditions']()}
					</a>.
				</label>
			</div>
		</div>
	{/if}

	<!-- Submit -->
	<div class="flex items-center gap-3">
		<Button
			type="submit"
			disabled={saveMutation.isPending || !billingName.trim()}
			aria-busy={saveStatus === 'saving'}
		>
			{#if saveStatus === 'saving'}
				<Loader2 class="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />
				{m['billing.form.saving']()}
			{:else if saveStatus === 'saved'}
				<Check class="mr-2 h-4 w-4" aria-hidden="true" />
				{m['billing.form.saved']()}
			{:else}
				{hasBillingProfile ? m['billing.form.update']() : m['billing.form.save']()}
			{/if}
		</Button>

		{#if saveStatus === 'error'}
			<span class="text-sm text-destructive" role="alert" aria-live="assertive">
				<AlertCircle class="mr-1 inline h-4 w-4" aria-hidden="true" />
				{m['billing.form.error']()}
			</span>
		{/if}
	</div>
</form>

<!-- VAT ID Section -->
<div class="mt-6 border-t pt-6">
	{#if hasBillingProfile}
		<h3 class="text-sm font-semibold">{m['billing.form.vatId']()}</h3>
		<p class="mt-1 text-xs text-muted-foreground" id="vatIdDescription">
			{m['billing.form.vatIdDescription']()}
		</p>

		{#if billingProfile?.vat_id}
			<!-- Existing VAT ID display -->
			<div class="mt-3 flex flex-wrap items-center gap-3">
				<span class="font-mono text-sm" aria-label="VAT ID: {billingProfile.vat_id}">
					{billingProfile.vat_id}
				</span>

				{#if vatIdStatus === 'validated'}
					<span
						class="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-800 dark:bg-emerald-900/50 dark:text-emerald-300"
						role="status"
					>
						<Check class="h-3 w-3" aria-hidden="true" />
						{m['billing.form.vatIdValidated']()}
					</span>
				{:else if vatIdStatus === 'pending'}
					<span
						class="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800 dark:bg-amber-900/50 dark:text-amber-300"
						role="status"
					>
						<AlertCircle class="h-3 w-3" aria-hidden="true" />
						{m['billing.form.vatIdPending']()}
					</span>
				{/if}

				<Button
					variant="ghost"
					size="sm"
					onclick={() => vatDeleteMutation.mutate()}
					disabled={vatDeleteMutation.isPending}
					class="text-destructive hover:text-destructive"
					aria-label={m['billing.form.removeVatId']()}
				>
					{#if vatDeleteMutation.isPending}
						<Loader2 class="mr-1 h-3 w-3 animate-spin" aria-hidden="true" />
					{/if}
					{m['billing.form.removeVatId']()}
				</Button>
			</div>
		{:else}
			<!-- VAT ID input -->
			<div class="mt-3 flex flex-col gap-2 sm:flex-row sm:items-center">
				<span class="text-xs text-muted-foreground" role="status">
					{m['billing.form.vatIdNotSet']()}
				</span>
			</div>
			<div class="mt-2 flex flex-col gap-2 sm:flex-row">
				<Input
					bind:value={vatIdInput}
					placeholder={m['billing.form.vatIdPlaceholder']()}
					class="max-w-xs uppercase"
					aria-describedby="vatIdDescription"
					aria-label={m['billing.form.vatId']()}
					oninput={(e) => {
						vatIdInput = (e.currentTarget as HTMLInputElement).value.toUpperCase();
					}}
				/>
				<Button
					variant="outline"
					onclick={() => vatSetMutation.mutate()}
					disabled={vatSetMutation.isPending || !vatIdInput.trim()}
					aria-label={m['billing.form.setVatId']()}
				>
					{#if vatSetMutation.isPending}
						<Loader2 class="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />
					{/if}
					{m['billing.form.setVatId']()}
				</Button>
			</div>
		{/if}
	{:else}
		<h3 class="text-sm font-semibold">{m['billing.form.vatId']()}</h3>
		<p class="mt-1 text-xs text-muted-foreground">{m['billing.form.vatIdDescription']()}</p>
		<p class="mt-2 text-xs italic text-muted-foreground">
			{m['billing.form.incompleteDescription']()}
		</p>
	{/if}
</div>
