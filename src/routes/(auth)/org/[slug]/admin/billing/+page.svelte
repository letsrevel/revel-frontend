<script lang="ts">
	import * as m from '$lib/paraglide/messages.js';
	import { createQuery, createMutation, useQueryClient } from '@tanstack/svelte-query';
	import { Button } from '$lib/components/ui/button';
	import { Input } from '$lib/components/ui/input';
	import { Label } from '$lib/components/ui/label';
	import {
		AlertCircle,
		Check,
		CircleDot,
		FileCheck2,
		FileText,
		Loader2,
		Receipt,
		Shield,
		Trash2,
		Users
	} from '@lucide/svelte';
	import * as RadioGroup from '$lib/components/ui/radio-group';
	import { browser } from '$app/environment';
	import { resolve } from '$app/paths';
	import { authStore } from '$lib/stores/auth.svelte';
	import { toast } from 'svelte-sonner';
	import { extractErrorMessage } from '$lib/utils/errors';
	import {
		organizationadminvatGetBillingInfo,
		organizationadminvatSetVatId,
		organizationadminvatDeleteVatId,
		organizationadminvatSetInvoicingMode
	} from '$lib/api/generated/sdk.gen';
	import type { LayoutData } from '../$types';
	import { formatDate } from '$lib/utils/date';
	import {
		Dialog,
		DialogContent,
		DialogHeader,
		DialogTitle,
		DialogDescription,
		DialogFooter
	} from '$lib/components/ui/dialog';
	import PageHeader from '$lib/components/common/PageHeader.svelte';
	import SectionHeader from '$lib/components/common/SectionHeader.svelte';
	import StatusBadge from '$lib/components/common/StatusBadge.svelte';
	import type { Tone } from '$lib/components/common/tones';
	import CountryRulesCard from '$lib/components/compliance/CountryRulesCard.svelte';
	import ComplianceNotices from '$lib/components/compliance/ComplianceNotices.svelte';
	import ComplianceCallout from '$lib/components/compliance/ComplianceCallout.svelte';
	import OrgBillingInfoForm from '$lib/components/organization/OrgBillingInfoForm.svelte';
	import EinvoiceReadiness from '$lib/components/organization/EinvoiceReadiness.svelte';
	import { invoicingNotice, noticesFor } from '$lib/utils/compliance';

	interface Props {
		data: LayoutData;
	}

	const { data }: Props = $props();

	const slug = $derived(data.organization.slug);
	const accessToken = $derived(authStore.accessToken);
	const queryClient = useQueryClient();

	// ─── Billing Info Query ─────────────────────────────────────────
	const billingQuery = browser
		? createQuery(() => ({
				queryKey: ['billing-info', slug],
				queryFn: async () => {
					const response = await organizationadminvatGetBillingInfo({
						path: { slug },
						headers: { Authorization: `Bearer ${accessToken}` }
					});
					if (response.error || !response.data) throw new Error('Failed to load billing info');
					return response.data;
				},
				enabled: !!accessToken
			}))
		: null;

	// Whether a VAT ID is currently set (locks the country dropdown)
	const hasVatId = $derived(!!billingQuery?.data?.vat_id);

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
					if (response.response?.status === 503) {
						queryClient.invalidateQueries({ queryKey: ['billing-info', slug] });
						return { pending: true } as const;
					}
					if (response.error) {
						const msg = extractErrorMessage(response.error, m['orgAdmin.billing.vatId.error']());
						throw new Error(msg);
					}
					if (!response.data) throw new Error(m['orgAdmin.billing.vatId.error']());
					return { pending: false, data: response.data } as const;
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
					if (!response.data) throw new Error(m['orgAdmin.billing.invoicingMode.error']());
					return response.data;
				},
				onSuccess: () => {
					queryClient.invalidateQueries({ queryKey: ['billing-info', slug] });
					toast.success(m['orgAdmin.billing.invoicingMode.saved']());
				},
				// No toast: the inline role="alert" under the radios is the feedback,
				// and a toast on top would announce the same refusal twice. The local
				// handler also stands in for the global "Action failed" toast.
				onError: () => undefined
			}))
		: null;

	// ─── Country compliance (#1001) ────────────────────────────────
	const compliance = $derived(billingQuery?.data?.compliance);
	const invoicingBlocked = $derived(compliance?.attendee_invoicing === 'blocked');
	const invoicingComplianceNotice = $derived(compliance ? invoicingNotice(compliance) : null);
	// Fiscal-system notices (#1007) sit next to the mode selector; the country
	// card below shows every other notice, so none appears twice on the page.
	const invoicingNotices = $derived(noticesFor(compliance?.notices, 'attendee_invoicing'));
	const cardCompliance = $derived(
		compliance && {
			...compliance,
			notices: compliance.notices.filter((n) => n.applies_to !== 'attendee_invoicing')
		}
	);

	// ─── VAT Validation Status ──────────────────────────────────────
	type VatStatusType = 'not-set' | 'validated' | 'pending';

	const vatStatus = $derived.by((): { type: VatStatusType; label: string } => {
		if (!billingQuery?.data?.vat_id) {
			return { type: 'not-set', label: m['orgAdmin.billing.vatId.statusNotSet']() };
		}
		if (billingQuery.data.vat_id_validated) {
			return { type: 'validated', label: m['orgAdmin.billing.vatId.statusValidated']() };
		}
		return { type: 'pending', label: m['orgAdmin.billing.vatId.statusPending']() };
	});

	// `pending` (awaiting the VIES check) is `info`, not `warning`: it is an
	// ordinary in-progress state, not something the organizer needs to act on.
	const VAT_STATUS_TONE: Record<VatStatusType, Tone> = {
		validated: 'success',
		pending: 'info',
		'not-set': 'neutral'
	};
</script>

<svelte:head>
	<title>{m['orgAdmin.billing.pageTitle']()} - {data.organization.name}</title>
</svelte:head>

<div class="space-y-8 px-4">
	<PageHeader
		title={m['orgAdmin.billing.pageTitle']()}
		subtitle={m['orgAdmin.billing.pageDescription']()}
	/>

	<!-- Quick Links -->
	<div class="flex flex-wrap gap-3">
		<a
			href={resolve('/(auth)/org/[slug]/admin/billing/invoices', { slug: slug })}
			class="inline-flex items-center gap-2 rounded-md border border-border bg-card px-4 py-2 text-sm font-medium transition-colors hover:bg-accent"
		>
			<FileText class="h-4 w-4" aria-hidden="true" />
			{m['orgAdmin.billing.invoices.title']()}
		</a>
		<a
			href={resolve('/(auth)/org/[slug]/admin/billing/credit-notes', { slug: slug })}
			class="inline-flex items-center gap-2 rounded-md border border-border bg-card px-4 py-2 text-sm font-medium transition-colors hover:bg-accent"
		>
			<Receipt class="h-4 w-4" aria-hidden="true" />
			{m['orgAdmin.billing.creditNotes.title']()}
		</a>
		<a
			href={resolve('/(auth)/org/[slug]/admin/billing/attendee-invoices', { slug: slug })}
			class="inline-flex items-center gap-2 rounded-md border border-border bg-card px-4 py-2 text-sm font-medium transition-colors hover:bg-accent"
		>
			<Users class="h-4 w-4" aria-hidden="true" />
			{m['orgAdmin.billing.attendeeInvoices.title']()}
		</a>
		<a
			href={resolve('/(auth)/org/[slug]/admin/billing/attendee-credit-notes', { slug: slug })}
			class="inline-flex items-center gap-2 rounded-md border border-border bg-card px-4 py-2 text-sm font-medium transition-colors hover:bg-accent"
		>
			<Receipt class="h-4 w-4" aria-hidden="true" />
			{m['orgAdmin.billing.attendeeCreditNotes.title']()}
		</a>
		<a
			href={resolve('/(auth)/org/[slug]/admin/billing/skipped-documents', { slug: slug })}
			class="inline-flex items-center gap-2 rounded-md border border-border bg-card px-4 py-2 text-sm font-medium transition-colors hover:bg-accent"
		>
			<FileCheck2 class="h-4 w-4" aria-hidden="true" />
			{m['compliance.skipped.title']()}
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
				<Users class="h-5 w-5 shrink-0 text-muted-foreground" aria-hidden="true" />
				<SectionHeader title={m['orgAdmin.billing.invoicingMode.title']()} class="flex-1" />
			</div>
			<p class="text-sm text-muted-foreground">
				{m['orgAdmin.billing.invoicingMode.description']()}
			</p>

			{#if invoicingComplianceNotice}
				<ComplianceCallout
					id="invoicing-compliance-notice"
					testId="invoicing-compliance-notice"
					tone={invoicingComplianceNotice.kind === 'blocked'
						? 'blocked'
						: invoicingComplianceNotice.kind === 'upcoming'
							? 'warning'
							: 'info'}
				>
					<p>{invoicingComplianceNotice.text}</p>
				</ComplianceCallout>
			{/if}
			<ComplianceNotices notices={invoicingNotices} />
			{#if billingQuery?.data && !billingQuery.data.einvoice_ready && billingQuery.data.invoicing_mode === 'none'}
				<EinvoiceReadiness
					variant="info"
					missingFields={billingQuery.data.einvoice_missing_fields}
				/>
			{/if}

			<RadioGroup.Root
				value={invoicingMode}
				onValueChange={(value) => {
					if (value) invoicingMode = value;
					// A new pick makes the last refusal stale.
					setInvoicingModeMutation?.reset();
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
						<RadioGroup.Item
							value="hybrid"
							id="invoicing-hybrid"
							class="mt-0.5"
							disabled={invoicingBlocked}
							aria-describedby={invoicingBlocked ? 'invoicing-compliance-notice' : undefined}
						/>
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
						<RadioGroup.Item
							value="auto"
							id="invoicing-auto"
							class="mt-0.5"
							disabled={invoicingBlocked}
							aria-describedby={invoicingBlocked ? 'invoicing-compliance-notice' : undefined}
						/>
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

			{#if setInvoicingModeMutation?.error}
				<!-- A refused mode change (422, country rules) names the reason; keep it
				     on the page, not only in a toast that disappears. -->
				<div
					class="flex items-start gap-2 rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-foreground"
					role="alert"
					data-testid="invoicing-mode-error"
				>
					<AlertCircle class="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
					<p>{setInvoicingModeMutation.error.message}</p>
				</div>
			{/if}

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
				<Receipt class="h-5 w-5 shrink-0 text-muted-foreground" aria-hidden="true" />
				<SectionHeader title={m['orgAdmin.billing.billingInfo.title']()} class="flex-1" />
			</div>
			<p class="text-sm text-muted-foreground">
				{m['orgAdmin.billing.billingInfo.description']()}
			</p>

			{#if billingQuery?.data}
				<OrgBillingInfoForm {slug} {accessToken} info={billingQuery.data} {hasVatId} />
			{/if}
		</section>

		<!-- ────────────────────────────────────────────────────────────
		     Section 2: VAT ID Management
		     ──────────────────────────────────────────────────────────── -->
		<section class="space-y-4 rounded-lg border border-border bg-card p-6 shadow-sm">
			<div class="flex items-center gap-2">
				<Shield class="h-5 w-5 shrink-0 text-muted-foreground" aria-hidden="true" />
				<SectionHeader title={m['orgAdmin.billing.vatId.title']()} class="flex-1" />
			</div>
			<p class="text-sm text-muted-foreground">
				{m['orgAdmin.billing.vatId.description']()}
			</p>

			<!-- VAT Status Badge -->
			<div class="flex items-center gap-2">
				<StatusBadge
					tone={VAT_STATUS_TONE[vatStatus.type]}
					label={vatStatus.label}
					icon={vatStatus.type === 'validated'
						? Check
						: vatStatus.type === 'pending'
							? CircleDot
							: undefined}
				/>
				{#if vatStatus.type === 'validated' && billingQuery?.data?.vat_id_validated_at}
					<span class="text-xs text-muted-foreground">
						{m['orgAdmin.billing.vatId.validatedAt']({
							date: formatDate(billingQuery.data.vat_id_validated_at)
						})}
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

		{#if cardCompliance}
			<CountryRulesCard compliance={cardCompliance} />
		{/if}
	{/if}
</div>

<!-- Remove VAT ID Confirmation Dialog -->
<Dialog open={showRemoveDialog} onOpenChange={(open) => (showRemoveDialog = open)}>
	<DialogContent class="max-h-[90vh] overflow-y-auto">
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
