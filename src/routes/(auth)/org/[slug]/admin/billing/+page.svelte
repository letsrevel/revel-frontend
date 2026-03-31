<script lang="ts">
	import * as m from '$lib/paraglide/messages.js';
	import { createQuery, createMutation, useQueryClient } from '@tanstack/svelte-query';
	import { Button } from '$lib/components/ui/button';
	import { Input } from '$lib/components/ui/input';
	import { Label } from '$lib/components/ui/label';
	import { Textarea } from '$lib/components/ui/textarea';
	import * as Select from '$lib/components/ui/select';
	import {
		AlertCircle,
		Check,
		CircleDot,
		FileText,
		Loader2,
		Receipt,
		Shield,
		Trash2,
		Users
	} from 'lucide-svelte';
	import * as RadioGroup from '$lib/components/ui/radio-group';
	import { browser } from '$app/environment';
	import { invalidateAll } from '$app/navigation';
	import { authStore } from '$lib/stores/auth.svelte';
	import { toast } from 'svelte-sonner';
	import { extractErrorMessage } from '$lib/utils/errors';
	import {
		organizationadminvatGetBillingInfo,
		organizationadminvatUpdateBillingInfo,
		organizationadminvatSetVatId,
		organizationadminvatDeleteVatId,
		organizationadminvatSetInvoicingMode
	} from '$lib/api/generated/sdk.gen';
	import type { LayoutData } from '../$types';
	import {
		Dialog,
		DialogContent,
		DialogHeader,
		DialogTitle,
		DialogDescription,
		DialogFooter
	} from '$lib/components/ui/dialog';

	interface Props {
		data: LayoutData;
	}

	const { data }: Props = $props();

	const slug = $derived(data.organization.slug);
	const accessToken = $derived(authStore.accessToken);
	const queryClient = useQueryClient();

	// EU member states for the country dropdown
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

	// ─── Billing Info Query ─────────────────────────────────────────
	const billingQuery = browser
		? createQuery(() => ({
				queryKey: ['billing-info', slug],
				queryFn: async () => {
					const response = await organizationadminvatGetBillingInfo({
						path: { slug },
						headers: { Authorization: `Bearer ${accessToken}` }
					});
					if (response.error) throw new Error('Failed to load billing info');
					return response.data!;
				},
				enabled: !!accessToken
			}))
		: null;

	// ─── Billing Info Form State ────────────────────────────────────
	let countryCode = $state('');
	let vatRate = $state('');
	let billingName = $state('');
	let billingAddress = $state('');
	let billingEmail = $state('');
	let billingFormDirty = $state(false);

	// Sync form with query data
	$effect(() => {
		if (billingQuery?.data && !billingFormDirty) {
			countryCode = billingQuery.data.vat_country_code || '';
			vatRate = billingQuery.data.vat_rate || '';
			billingName = billingQuery.data.billing_name || '';
			billingAddress = billingQuery.data.billing_address || '';
			billingEmail = billingQuery.data.billing_email || '';
		}
	});

	function markBillingDirty() {
		billingFormDirty = true;
	}

	// Whether a VAT ID is currently set (locks the country dropdown)
	const hasVatId = $derived(!!billingQuery?.data?.vat_id);

	// ─── Update Billing Info Mutation ───────────────────────────────
	const updateBillingMutation = browser
		? createMutation(() => ({
				mutationFn: async () => {
					const body: Record<string, string | number | null> = {};
					if (countryCode) body.vat_country_code = countryCode;
					else body.vat_country_code = null;
					if (vatRate) body.vat_rate = parseFloat(vatRate);
					else body.vat_rate = null;
					body.billing_name = billingName || null;
					body.billing_address = billingAddress || null;
					body.billing_email = billingEmail || null;

					const response = await organizationadminvatUpdateBillingInfo({
						path: { slug },
						headers: { Authorization: `Bearer ${accessToken}` },
						body: body as any
					});
					if (response.error) {
						const msg = extractErrorMessage(
							response.error,
							m['orgAdmin.billing.billingInfo.error']()
						);
						throw new Error(msg);
					}
					return response.data!;
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
			}))
		: null;

	function handleSaveBillingInfo(e: Event) {
		e.preventDefault();
		updateBillingMutation?.mutate();
	}

	// ─── VAT ID State ───────────────────────────────────────────────
	let vatIdInput = $state('');
	let showRemoveDialog = $state(false);

	// Sync VAT ID input with query data
	$effect(() => {
		if (billingQuery?.data) {
			vatIdInput = billingQuery.data.vat_id || '';
		}
	});

	// ─── Set VAT ID Mutation ────────────────────────────────────────
	const setVatIdMutation = browser
		? createMutation(() => ({
				mutationFn: async () => {
					const response = await organizationadminvatSetVatId({
						path: { slug },
						headers: { Authorization: `Bearer ${accessToken}` },
						body: { vat_id: vatIdInput.trim().toUpperCase() }
					});
					// Handle 503 (VIES unavailable) — saved but pending
					if (response.response.status === 503) {
						queryClient.invalidateQueries({ queryKey: ['billing-info', slug] });
						return { pending: true } as const;
					}
					if (response.error) {
						const msg = extractErrorMessage(response.error, m['orgAdmin.billing.vatId.error']());
						throw new Error(msg);
					}
					return { pending: false, data: response.data! } as const;
				},
				onSuccess: (result) => {
					if (result.pending) {
						toast.info(m['orgAdmin.billing.vatId.savedPending']());
					} else {
						queryClient.invalidateQueries({ queryKey: ['billing-info', slug] });
						toast.success(m['orgAdmin.billing.vatId.saved']());
					}
				},
				onError: (error: Error) => {
					toast.error(error.message);
				}
			}))
		: null;

	// ─── Delete VAT ID Mutation ─────────────────────────────────────
	const deleteVatIdMutation = browser
		? createMutation(() => ({
				mutationFn: async () => {
					const response = await organizationadminvatDeleteVatId({
						path: { slug },
						headers: { Authorization: `Bearer ${accessToken}` }
					});
					if (response.error) {
						throw new Error(m['orgAdmin.billing.vatId.error']());
					}
				},
				onSuccess: () => {
					vatIdInput = '';
					showRemoveDialog = false;
					queryClient.invalidateQueries({ queryKey: ['billing-info', slug] });
					toast.success(m['orgAdmin.billing.vatId.removed']());
				},
				onError: (error: Error) => {
					toast.error(error.message);
				}
			}))
		: null;

	function handleValidateVatId(e: Event) {
		e.preventDefault();
		if (!vatIdInput.trim()) return;
		setVatIdMutation?.mutate();
	}

	// ─── Invoicing Mode ────────────────────────────────────────────
	let invoicingMode = $state('none');

	$effect(() => {
		if (billingQuery?.data?.invoicing_mode) {
			invoicingMode = billingQuery.data.invoicing_mode;
		}
	});

	const setInvoicingModeMutation = browser
		? createMutation(() => ({
				mutationFn: async () => {
					const response = await organizationadminvatSetInvoicingMode({
						path: { slug },
						headers: { Authorization: `Bearer ${accessToken}` },
						body: { mode: invoicingMode as 'none' | 'hybrid' | 'auto' }
					});
					if (response.error) {
						const msg = extractErrorMessage(
							response.error,
							m['orgAdmin.billing.invoicingMode.error']()
						);
						throw new Error(msg);
					}
					return response.data!;
				},
				onSuccess: () => {
					queryClient.invalidateQueries({ queryKey: ['billing-info', slug] });
					toast.success(m['orgAdmin.billing.invoicingMode.saved']());
				},
				onError: (error: Error) => {
					toast.error(error.message);
				}
			}))
		: null;

	// ─── VAT Validation Status ──────────────────────────────────────
	const vatStatus = $derived.by(() => {
		if (!billingQuery?.data?.vat_id) {
			return { type: 'not-set' as const, label: m['orgAdmin.billing.vatId.statusNotSet']() };
		}
		if (billingQuery.data.vat_id_validated) {
			return {
				type: 'validated' as const,
				label: m['orgAdmin.billing.vatId.statusValidated']()
			};
		}
		return { type: 'pending' as const, label: m['orgAdmin.billing.vatId.statusPending']() };
	});
</script>

<svelte:head>
	<title>{m['orgAdmin.billing.pageTitle']()} - {data.organization.name}</title>
</svelte:head>

<div class="space-y-8 px-4">
	<!-- Page Header -->
	<div>
		<h1 class="text-2xl font-bold tracking-tight">{m['orgAdmin.billing.pageTitle']()}</h1>
		<p class="mt-1 text-sm text-muted-foreground">
			{m['orgAdmin.billing.pageDescription']()}
		</p>
	</div>

	<!-- Quick Links -->
	<div class="flex flex-wrap gap-3">
		<a
			href="/org/{slug}/admin/billing/invoices"
			class="inline-flex items-center gap-2 rounded-md border border-border bg-card px-4 py-2 text-sm font-medium transition-colors hover:bg-accent"
		>
			<FileText class="h-4 w-4" aria-hidden="true" />
			{m['orgAdmin.billing.invoices.title']()}
		</a>
		<a
			href="/org/{slug}/admin/billing/credit-notes"
			class="inline-flex items-center gap-2 rounded-md border border-border bg-card px-4 py-2 text-sm font-medium transition-colors hover:bg-accent"
		>
			<Receipt class="h-4 w-4" aria-hidden="true" />
			{m['orgAdmin.billing.creditNotes.title']()}
		</a>
		<a
			href="/org/{slug}/admin/billing/attendee-invoices"
			class="inline-flex items-center gap-2 rounded-md border border-border bg-card px-4 py-2 text-sm font-medium transition-colors hover:bg-accent"
		>
			<Users class="h-4 w-4" aria-hidden="true" />
			{m['orgAdmin.billing.attendeeInvoices.title']()}
		</a>
		<a
			href="/org/{slug}/admin/billing/attendee-credit-notes"
			class="inline-flex items-center gap-2 rounded-md border border-border bg-card px-4 py-2 text-sm font-medium transition-colors hover:bg-accent"
		>
			<Receipt class="h-4 w-4" aria-hidden="true" />
			{m['orgAdmin.billing.attendeeCreditNotes.title']()}
		</a>
	</div>

	{#if billingQuery?.isLoading}
		<div class="flex items-center justify-center py-12">
			<Loader2
				class="h-6 w-6 animate-spin text-muted-foreground"
				aria-label={m['common.loading']()}
			/>
		</div>
	{:else if billingQuery?.error}
		<div
			class="flex items-center gap-2 rounded-lg border border-destructive/50 bg-destructive/10 p-4 text-destructive"
			role="alert"
		>
			<AlertCircle class="h-5 w-5 shrink-0" aria-hidden="true" />
			<p class="text-sm">{extractErrorMessage(billingQuery.error)}</p>
		</div>
	{:else}
		<!-- ────────────────────────────────────────────────────────────
		     Section 0: Attendee Invoicing Mode
		     ──────────────────────────────────────────────────────────── -->
		<section class="space-y-4 rounded-lg border border-border bg-card p-6 shadow-sm">
			<div class="flex items-center gap-2">
				<Users class="h-5 w-5 text-muted-foreground" aria-hidden="true" />
				<div>
					<h2 class="text-lg font-semibold">
						{m['orgAdmin.billing.invoicingMode.title']()}
					</h2>
					<p class="text-sm text-muted-foreground">
						{m['orgAdmin.billing.invoicingMode.description']()}
					</p>
				</div>
			</div>

			<RadioGroup.Root
				value={invoicingMode}
				onValueChange={(value) => {
					if (value) invoicingMode = value;
				}}
			>
				<div class="space-y-3">
					<div class="flex items-start space-x-3">
						<RadioGroup.Item value="none" id="invoicing-none" class="mt-0.5" />
						<div>
							<Label for="invoicing-none" class="font-medium">
								{m['orgAdmin.billing.invoicingMode.none']()}
							</Label>
							<p class="text-sm text-muted-foreground">
								{m['orgAdmin.billing.invoicingMode.noneDescription']()}
							</p>
						</div>
					</div>
					<div class="flex items-start space-x-3">
						<RadioGroup.Item value="hybrid" id="invoicing-hybrid" class="mt-0.5" />
						<div>
							<Label for="invoicing-hybrid" class="font-medium">
								{m['orgAdmin.billing.invoicingMode.hybrid']()}
							</Label>
							<p class="text-sm text-muted-foreground">
								{m['orgAdmin.billing.invoicingMode.hybridDescription']()}
							</p>
						</div>
					</div>
					<div class="flex items-start space-x-3">
						<RadioGroup.Item value="auto" id="invoicing-auto" class="mt-0.5" />
						<div>
							<Label for="invoicing-auto" class="font-medium">
								{m['orgAdmin.billing.invoicingMode.auto']()}
							</Label>
							<p class="text-sm text-muted-foreground">
								{m['orgAdmin.billing.invoicingMode.autoDescription']()}
							</p>
						</div>
					</div>
				</div>
			</RadioGroup.Root>

			<div class="flex justify-end">
				<Button
					onclick={() => setInvoicingModeMutation?.mutate()}
					disabled={setInvoicingModeMutation?.isPending}
				>
					{#if setInvoicingModeMutation?.isPending}
						<Loader2 class="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />
						{m['orgAdmin.billing.invoicingMode.saving']()}
					{:else}
						{m['common.actions_save']()}
					{/if}
				</Button>
			</div>
		</section>

		<!-- ────────────────────────────────────────────────────────────
		     Section 1: Billing Information Form
		     ──────────────────────────────────────────────────────────── -->
		<section class="space-y-4 rounded-lg border border-border bg-card p-6 shadow-sm">
			<div class="flex items-center gap-2">
				<Receipt class="h-5 w-5 text-muted-foreground" aria-hidden="true" />
				<div>
					<h2 class="text-lg font-semibold">{m['orgAdmin.billing.billingInfo.title']()}</h2>
					<p class="text-sm text-muted-foreground">
						{m['orgAdmin.billing.billingInfo.description']()}
					</p>
				</div>
			</div>

			<form onsubmit={handleSaveBillingInfo} class="space-y-4">
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
								{#snippet children()}
									{EU_COUNTRIES.find((c) => c.code === countryCode)?.name ||
										m['orgAdmin.billing.billingInfo.countryPlaceholder']()}
								{/snippet}
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

				<!-- Billing Address -->
				<div class="space-y-2">
					<Label for="billing-address">{m['orgAdmin.billing.billingInfo.billingAddress']()}</Label>
					<Textarea
						id="billing-address"
						placeholder={m['orgAdmin.billing.billingInfo.billingAddressPlaceholder']()}
						bind:value={billingAddress}
						oninput={markBillingDirty}
						rows={3}
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

				<!-- Save Button -->
				<div class="flex justify-end">
					<Button type="submit" disabled={updateBillingMutation?.isPending || !billingFormDirty}>
						{#if updateBillingMutation?.isPending}
							<Loader2 class="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />
							{m['orgAdmin.billing.billingInfo.saving']()}
						{:else}
							{m['orgAdmin.billing.billingInfo.saveButton']()}
						{/if}
					</Button>
				</div>
			</form>
		</section>

		<!-- ────────────────────────────────────────────────────────────
		     Section 2: VAT ID Management
		     ──────────────────────────────────────────────────────────── -->
		<section class="space-y-4 rounded-lg border border-border bg-card p-6 shadow-sm">
			<div class="flex items-center gap-2">
				<Shield class="h-5 w-5 text-muted-foreground" aria-hidden="true" />
				<div>
					<h2 class="text-lg font-semibold">{m['orgAdmin.billing.vatId.title']()}</h2>
					<p class="text-sm text-muted-foreground">
						{m['orgAdmin.billing.vatId.description']()}
					</p>
				</div>
			</div>

			<!-- VAT Status Badge -->
			<div class="flex items-center gap-2">
				{#if vatStatus.type === 'validated'}
					<span
						class="inline-flex items-center gap-1.5 rounded-full bg-green-100 px-3 py-1 text-xs font-medium text-green-800 dark:bg-green-900/30 dark:text-green-300"
					>
						<Check class="h-3.5 w-3.5" aria-hidden="true" />
						{vatStatus.label}
					</span>
					{#if billingQuery?.data?.vat_id_validated_at}
						<span class="text-xs text-muted-foreground">
							{m['orgAdmin.billing.vatId.validatedAt']({
								date: new Date(billingQuery.data.vat_id_validated_at).toLocaleDateString()
							})}
						</span>
					{/if}
				{:else if vatStatus.type === 'pending'}
					<span
						class="inline-flex items-center gap-1.5 rounded-full bg-yellow-100 px-3 py-1 text-xs font-medium text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300"
					>
						<CircleDot class="h-3.5 w-3.5" aria-hidden="true" />
						{vatStatus.label}
					</span>
				{:else}
					<span
						class="inline-flex items-center gap-1.5 rounded-full bg-muted px-3 py-1 text-xs font-medium text-muted-foreground"
					>
						{vatStatus.label}
					</span>
				{/if}
			</div>

			<!-- VAT ID Input + Actions -->
			<form onsubmit={handleValidateVatId} class="flex flex-col gap-3 sm:flex-row sm:items-end">
				<div class="flex-1 space-y-2">
					<Label for="vat-id-input">{m['orgAdmin.billing.vatId.title']()}</Label>
					<Input
						id="vat-id-input"
						placeholder={m['orgAdmin.billing.vatId.inputPlaceholder']()}
						bind:value={vatIdInput}
						class="uppercase"
					/>
					<p class="text-xs text-muted-foreground">
						{m['orgAdmin.billing.vatId.inputHelp']()}
					</p>
				</div>
				<div class="flex gap-2">
					<Button type="submit" disabled={setVatIdMutation?.isPending || !vatIdInput.trim()}>
						{#if setVatIdMutation?.isPending}
							<Loader2 class="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />
							{m['orgAdmin.billing.vatId.validating']()}
						{:else}
							{m['orgAdmin.billing.vatId.validateButton']()}
						{/if}
					</Button>
					{#if hasVatId}
						<Button
							type="button"
							variant="destructive"
							onclick={() => (showRemoveDialog = true)}
							disabled={deleteVatIdMutation?.isPending}
						>
							<Trash2 class="mr-2 h-4 w-4" aria-hidden="true" />
							{m['orgAdmin.billing.vatId.removeButton']()}
						</Button>
					{/if}
				</div>
			</form>
		</section>
	{/if}
</div>

<!-- Remove VAT ID Confirmation Dialog -->
<Dialog open={showRemoveDialog} onOpenChange={(open) => (showRemoveDialog = open)}>
	<DialogContent>
		<DialogHeader>
			<DialogTitle>{m['orgAdmin.billing.vatId.removeConfirmTitle']()}</DialogTitle>
			<DialogDescription>
				{m['orgAdmin.billing.vatId.removeConfirmDescription']()}
			</DialogDescription>
		</DialogHeader>
		<DialogFooter>
			<Button variant="outline" onclick={() => (showRemoveDialog = false)}
				>{m['common.cancel']()}</Button
			>
			<Button
				variant="destructive"
				onclick={() => deleteVatIdMutation?.mutate()}
				disabled={deleteVatIdMutation?.isPending}
			>
				{#if deleteVatIdMutation?.isPending}
					<Loader2 class="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />
				{/if}
				{m['orgAdmin.billing.vatId.removeConfirmButton']()}
			</Button>
		</DialogFooter>
	</DialogContent>
</Dialog>
