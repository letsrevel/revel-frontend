<script lang="ts">
	import { resolve } from '$app/paths';
	import { tick, untrack } from 'svelte';
	// 1. Imports
	import * as m from '$lib/paraglide/messages.js';
	import { createQuery, createMutation, useQueryClient } from '@tanstack/svelte-query';
	import { toast } from 'svelte-sonner';
	import { Button } from '$lib/components/ui/button';
	import { Input } from '$lib/components/ui/input';
	import { Label } from '$lib/components/ui/label';
	import { Check, AlertCircle, AlertTriangle, Loader2, Shield } from '@lucide/svelte';
	import StatusBadge from '$lib/components/common/StatusBadge.svelte';
	import {
		userbillingGetBillingProfile,
		userbillingCreateBillingProfile,
		userbillingUpdateBillingProfile,
		userbillingSetVatId,
		userbillingDeleteVatId
	} from '$lib/api/generated/sdk.gen';
	import type { UserBillingProfileSchema } from '$lib/api/generated/types.gen';
	import PostalAddressFields from '$lib/components/billing/PostalAddressFields.svelte';
	import { extractErrorMessage } from '$lib/utils/errors';
	import { isAddressBlank, legacyAddressForPayload } from '$lib/utils/einvoice';
	import {
		emptyPostalAddress,
		isPostalAddressComplete,
		missingRequiredFields,
		type RequiredAddressField,
		readPostalAddress,
		toBillingFields,
		type PostalAddress
	} from '$lib/utils/postal-address';

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
			// "Nothing saved yet" is 200 + null since BE #861 (404 kept for
			// deploy-lag tolerance with older backends).
			if (response.response?.status === 404) return null;
			if (response.error) throw new Error('Failed to fetch billing profile');
			return (response.data as UserBillingProfileSchema | null | undefined) ?? null;
		},
		enabled: !!authToken,
		retry: false,
		staleTime: 60_000
	}));

	// 5. Derived profile state
	const billingProfile = $derived(billingQuery.data ?? null);
	const hasBillingProfile = $derived(billingProfile !== null && billingProfile !== undefined);
	const profileAddress = $derived(
		readPostalAddress(billingProfile as Record<string, unknown> | null, 'billing_')
	);
	const legacyText = $derived((billingProfile?.billing_address ?? '').trim());
	// Legacy free text exists but no structured address yet: ask to re-enter it.
	const showLegacyNote = $derived(legacyText !== '' && isAddressBlank(profileAddress));
	const isBillingComplete = $derived(
		hasBillingProfile &&
			!!billingProfile?.billing_name &&
			!!billingProfile?.vat_country_code &&
			(isPostalAddressComplete(profileAddress) ||
				(isAddressBlank(profileAddress) && legacyText !== ''))
	);

	// 6. Form state
	let billingName = $state('');
	let address = $state<PostalAddress>(emptyPostalAddress());
	let vatCountryCode = $state('');
	let billingEmail = $state('');
	let vatIdInput = $state('');
	let selfBillingAgreed = $state(false);
	let addressErrors = $state<Partial<Record<RequiredAddressField, string>>>({});
	let saveStatus = $state<'idle' | 'saving' | 'saved' | 'error'>('idle');

	// 7. Sync form from query data. A refetch (e.g. window focus) must not wipe in-progress
	// edits: seed on first load, afterwards only while the form still matches the last
	// seeded/saved snapshot (i.e. is not dirty).
	const formSnapshot = (): string =>
		JSON.stringify([billingName, address, vatCountryCode, billingEmail, selfBillingAgreed]);
	let syncedSnapshot: string | null = null;

	$effect(() => {
		const profile = billingProfile;
		if (!profile) return;
		untrack(() => {
			if (syncedSnapshot !== null && formSnapshot() !== syncedSnapshot) return;
			billingName = profile.billing_name ?? '';
			address = readPostalAddress(profile as Record<string, unknown>, 'billing_');
			vatCountryCode = profile.vat_country_code ?? '';
			billingEmail = profile.billing_email ?? '';
			if (syncedSnapshot === null) vatIdInput = profile.vat_id ?? '';
			selfBillingAgreed = profile.self_billing_agreed ?? false;
			syncedSnapshot = formSnapshot();
		});
	});

	// Show an error only while its field is still missing, so it clears as the user fixes it.
	const shownAddressErrors = $derived.by(() => {
		const still = new Set<string>(missingRequiredFields(address));
		return Object.fromEntries(Object.entries(addressErrors).filter(([k]) => still.has(k)));
	});

	// 8. Save mutation
	const saveMutation = createMutation(() => ({
		mutationFn: async () => {
			const headers = { Authorization: `Bearer ${authToken}` };
			const baseBody = {
				billing_name: billingName,
				// PUT is a full replace: always send all six structured fields.
				billing_address: legacyAddressForPayload(
					address,
					billingProfile?.billing_address ?? '',
					profileAddress
				),
				...toBillingFields(address),
				vat_country_code: vatCountryCode,
				...(billingEmail.trim() ? { billing_email: billingEmail.trim() } : {})
			};
			const body = showSelfBilling
				? { ...baseBody, self_billing_agreed: selfBillingAgreed }
				: baseBody;

			if (hasBillingProfile) {
				const response = await userbillingUpdateBillingProfile({ headers, body });
				if (response.error) {
					throw new Error(extractErrorMessage(response.error, m['billing.form.error']()));
				}
				return response.data;
			} else {
				const response = await userbillingCreateBillingProfile({ headers, body });
				if (response.error) {
					throw new Error(extractErrorMessage(response.error, m['billing.form.error']()));
				}
				return response.data;
			}
		},
		onSuccess: () => {
			// The form now equals what was saved: let the refetch re-seed it again.
			syncedSnapshot = formSnapshot();
			saveStatus = 'saved';
			queryClient.invalidateQueries({ queryKey: ['user-billing-profile'] });
			toast.success(m['billing.form.saved']());
			setTimeout(() => (saveStatus = 'idle'), 2000);
		},
		onError: (err: Error) => {
			saveStatus = 'error';
			toast.error(err.message || m['billing.form.error']());
			setTimeout(() => (saveStatus = 'idle'), 3000);
		}
	}));

	// 9. VAT ID mutations
	// Setting/deleting a VAT ID makes the backend change `vat_country_code`. The dirty guard
	// above would skip re-seeding while the user has other edits, so the next full-replace
	// PUT would send the stale country: refetch, then re-seed just the server-derived fields.
	async function refreshServerDerivedFields(): Promise<void> {
		await queryClient.invalidateQueries({ queryKey: ['user-billing-profile'] });
		const fresh = queryClient.getQueryData<UserBillingProfileSchema | null>([
			'user-billing-profile'
		]);
		if (!fresh) return;
		vatCountryCode = fresh.vat_country_code ?? '';
		vatIdInput = fresh.vat_id ?? '';
	}

	const vatSetMutation = createMutation(() => ({
		mutationFn: async () => {
			const response = await userbillingSetVatId({
				headers: { Authorization: `Bearer ${authToken}` },
				body: { vat_id: vatIdInput.trim().toUpperCase() }
			});
			if (response.error) throw new Error('Failed to set VAT ID');
			return response.data;
		},
		onSuccess: async () => {
			await refreshServerDerivedFields();
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
		onSuccess: async () => {
			vatIdInput = '';
			await refreshServerDerivedFields();
		},
		onError: () => {
			toast.error(m['billing.form.error']());
		}
	}));

	// 10. Submit handler
	function validateAddress(): boolean {
		addressErrors = {};
		// A legacy-only profile may keep its free text with a blank structured address.
		if (isAddressBlank(address) && legacyText !== '' && isAddressBlank(profileAddress)) {
			return true;
		}
		const missing = missingRequiredFields(address);
		if (missing.length === 0) return true;
		addressErrors = Object.fromEntries(missing.map((f) => [f, m[`postalAddress.errors.${f}`]()]));
		// Errors are role="alert" (announced); also move focus to the first one.
		void tick().then(() =>
			document.getElementById(`billing-profile-address-${missing[0]}`)?.focus()
		);
		return false;
	}

	function handleSave(): void {
		if (!validateAddress()) return;
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

<!-- Incomplete warning (only shown when profile exists but is incomplete).
     Warning tint mirrors ToneTile's amber recipe (see security page). -->
{#if hasBillingProfile && !isBillingComplete}
	<div
		class="mt-4 flex items-start gap-3 rounded-lg border border-highlight/40 bg-highlight/20 p-4"
		role="alert"
		aria-live="polite"
	>
		<AlertTriangle
			class="mt-0.5 h-5 w-5 shrink-0 text-highlight-foreground dark:text-highlight"
			aria-hidden="true"
		/>
		<div>
			<p class="font-medium text-highlight-foreground dark:text-highlight">
				{m['billing.form.incomplete']()}
			</p>
			<p class="mt-1 text-sm text-foreground">
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
		{#if showLegacyNote}
			<p
				class="rounded-md border border-highlight/40 bg-highlight/20 p-3 text-sm text-foreground"
				data-testid="legacy-address-note"
			>
				<span class="whitespace-pre-line">{m['einvoice.legacyNote']({ text: legacyText })}</span>
			</p>
		{/if}
		<PostalAddressFields
			idPrefix="billing-profile-address"
			bind:value={address}
			legend={m['billing.form.billingAddress']()}
			required
			errors={shownAddressErrors}
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
						href={resolve('/(public)/legal/terms', {})}
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
					<StatusBadge
						tone="success"
						icon={Check}
						label={m['billing.form.vatIdValidated']()}
						size="sm"
						role="status"
					/>
				{:else if vatIdStatus === 'pending'}
					<StatusBadge
						tone="warning"
						icon={AlertCircle}
						label={m['billing.form.vatIdPending']()}
						size="sm"
						role="status"
					/>
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
