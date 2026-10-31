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
	import { untrack } from 'svelte';
	import { browser } from '$app/environment';
	import { resolve } from '$app/paths';
	import { invalidateAll } from '$app/navigation';
	import { authStore } from '$lib/stores/auth.svelte';
	import { toast } from 'svelte-sonner';
	import { createSyncOnChange } from '$lib/utils/sync-on-change';
	import { extractErrorMessage } from '$lib/utils/errors';
	import {
		organizationadminvatGetBillingInfo,
		organizationadminvatSetVatId,
		organizationadminvatDeleteVatId,
		organizationadminvatSetInvoicingMode
	} from '$lib/api/generated/sdk.gen';
	import type { InvoicingMode } from '$lib/api/generated/types.gen';
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
	import SmallBusinessSchemeSection from '$lib/components/organization/SmallBusinessSchemeSection.svelte';
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
				enabled: !!accessToken,
				// tiers_charging_vat changes elsewhere (event editor, other tabs); never serve it stale.
				// Each form field re-syncs only when its own server value changes (see
				// createSyncOnChange), so a refetch that touches other fields won't clobber edits.
				// staleTime 0 already refetches on every mount.
				staleTime: 0,
				refetchOnWindowFocus: true
			}))
		: null;

	// Whether a VAT ID is currently set (locks the country dropdown)
	const hasVatId = $derived(!!billingQuery?.data?.vat_id);

	// ─── VAT ID State ───────────────────────────────────────────────
	let vatIdInput = $state('');
	let invoicingMode = $state<InvoicingMode>('none');
	let showRemoveDialog = $state(false);

	// SvelteKit reuses this page across orgs: drop unsaved drafts and rebuild the sync closures
	// whenever the slug changes, so org A's draft never survives into org B.
	// It also closes the remove dialog and clears the mutations' pending/error state.
	// IMPORTANT: this effect MUST stay declared BEFORE the sync effects below. Effects run in
	// creation order, so the reset has to happen before the syncs write org B's cached values.
	// The mutations are declared further down; that is fine because effects run after the
	// component script has fully initialised.
	$effect(() => {
		void slug;
		untrack(() => {
			vatIdInput = '';
			invoicingMode = 'none';
			showRemoveDialog = false;
			setVatIdMutation?.reset();
			deleteVatIdMutation?.reset();
			setInvoicingModeMutation?.reset();
		});
	});

	// Sync VAT ID input only when the server's vat_id itself changes
	const syncVatId = $derived.by(() => {
		void slug;
		return createSyncOnChange<string>((v) => (vatIdInput = v), {
			current: () => vatIdInput,
			equals: (a, b) => a.trim().toUpperCase() === b.trim().toUpperCase()
		});
	});
	$effect(() => {
		// untrack: the draft is read only for the guard; the effect must not re-run on typing.
		if (billingQuery?.data) {
			const serverVatId = billingQuery.data.vat_id || '';
			untrack(() => syncVatId(serverVatId));
		}
	});

	// ─── Set VAT ID Mutation ────────────────────────────────────────
	const setVatIdMutation = browser
		? createMutation(() => ({
				// The slug is captured at mutate time so a response landing after an org switch
				// refreshes (and writes drafts for) the org it was sent for.
				mutationFn: async ({ requestSlug, vatId }: { requestSlug: string; vatId: string }) => {
					const response = await organizationadminvatSetVatId({
						path: { slug: requestSlug },
						headers: { Authorization: `Bearer ${accessToken}` },
						body: { vat_id: vatId }
					});
					// Handle 503 (VIES unavailable) — saved but pending
					if (response.response?.status === 503) {
						return { pending: true } as const;
					}
					if (response.error) {
						const msg = extractErrorMessage(response.error, m['orgAdmin.billing.vatId.error']());
						throw new Error(msg);
					}
					if (!response.data) throw new Error(m['orgAdmin.billing.vatId.error']());
					return { pending: false, data: response.data } as const;
				},
				onSuccess: (result, { requestSlug, vatId }) => {
					queryClient.invalidateQueries({ queryKey: ['billing-info', requestSlug] });
					// Layout org data (tier form's VAT context) must refresh too.
					void invalidateAll();
					if (result.pending) {
						toast.info(m['orgAdmin.billing.vatId.savedPending']());
					} else {
						// Show the normalized value even when it equals the previous server value.
						// Keep edits made while validation was pending: only overwrite an unchanged draft.
						if (
							requestSlug === slug &&
							vatIdInput.trim().toUpperCase() === vatId &&
							result.data.vat_id
						) {
							vatIdInput = result.data.vat_id;
						}
						toast.success(m['orgAdmin.billing.vatId.saved']());
					}
				},
				onError: (error: Error, { requestSlug }) => {
					// The backend may have saved the ID unvalidated before refusing.
					queryClient.invalidateQueries({ queryKey: ['billing-info', requestSlug] });
					toast.error(error.message);
				}
			}))
		: null;

	// ─── Delete VAT ID Mutation ─────────────────────────────────────
	const deleteVatIdMutation = browser
		? createMutation(() => ({
				mutationFn: async (requestSlug: string) => {
					const response = await organizationadminvatDeleteVatId({
						path: { slug: requestSlug },
						headers: { Authorization: `Bearer ${accessToken}` }
					});
					if (response.error) {
						// A 422 ("Turn invoicing off first") names the reason.
						throw new Error(
							extractErrorMessage(response.error, m['orgAdmin.billing.vatId.error']())
						);
					}
				},
				onSuccess: (_data, requestSlug) => {
					if (requestSlug === slug) {
						vatIdInput = '';
						showRemoveDialog = false;
					}
					queryClient.invalidateQueries({ queryKey: ['billing-info', requestSlug] });
					void invalidateAll();
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
		setVatIdMutation?.mutate({ requestSlug: slug, vatId: vatIdInput.trim().toUpperCase() });
	}

	// ─── Invoicing Mode ────────────────────────────────────────────

	const syncInvoicingMode = $derived.by(() => {
		void slug;
		return createSyncOnChange<InvoicingMode>((v) => (invoicingMode = v), {
			current: () => invoicingMode
		});
	});
	$effect(() => {
		const serverMode = billingQuery?.data?.invoicing_mode;
		if (serverMode) untrack(() => syncInvoicingMode(serverMode));
	});

	const setInvoicingModeMutation = browser
		? createMutation(() => ({
				mutationFn: async ({ requestSlug, mode }: { requestSlug: string; mode: InvoicingMode }) => {
					const response = await organizationadminvatSetInvoicingMode({
						path: { slug: requestSlug },
						headers: { Authorization: `Bearer ${accessToken}` },
						body: { mode }
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
				onSuccess: (_data, { requestSlug }) => {
					queryClient.invalidateQueries({ queryKey: ['billing-info', requestSlug] });
					// The tier form reads the org's invoicing mode from the layout data.
					void invalidateAll();
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
	{:else if billingQuery?.error && !billingQuery?.data}
		<div
			class="flex items-center gap-2 rounded-lg border border-destructive/50 bg-destructive/10 p-4 text-destructive"
			role="alert"
		>
			<AlertCircle class="h-5 w-5 shrink-0" aria-hidden="true" />
			<p class="text-sm">{extractErrorMessage(billingQuery.error)}</p>
		</div>
	{:else}
		<!-- Always mounted so the notice is announced when it appears. -->
		<div role="status">
			{#if billingQuery?.error && billingQuery?.data}
				<p
					class="rounded-md border border-border bg-muted p-3 text-sm text-foreground"
					data-testid="billing-refresh-failed"
				>
					{m['orgAdmin.billing.refreshFailed']()}
				</p>
			{/if}
		</div>
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
					context={{
						country: billingQuery.data.compliance.country,
						scheme: billingQuery.data.small_business_scheme
					}}
				/>
			{/if}

			<RadioGroup.Root
				value={invoicingMode}
				onValueChange={(value) => {
					if (value) invoicingMode = value as InvoicingMode;
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
					onclick={() =>
						setInvoicingModeMutation?.mutate({ requestSlug: slug, mode: invoicingMode })}
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
				{#key slug}
					<OrgBillingInfoForm {slug} {accessToken} info={billingQuery.data} {hasVatId} />
				{/key}
			{/if}
		</section>

		<!-- ────────────────────────────────────────────────────────────
		     Section 2: VAT ID Management
		     ──────────────────────────────────────────────────────────── -->
		<section
			id="vat-id-section"
			class="scroll-mt-24 space-y-4 rounded-lg border border-border bg-card p-6 shadow-sm"
		>
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

		<!-- ────────────────────────────────────────────────────────────
		     Section 3: Small-business (Kleinunternehmer) scheme
		     ──────────────────────────────────────────────────────────── -->
		{#if billingQuery?.data}
			<section class="space-y-4 rounded-lg border border-border bg-card p-6 shadow-sm">
				<div class="flex items-center gap-2">
					<Receipt class="h-5 w-5 shrink-0 text-muted-foreground" aria-hidden="true" />
					<SectionHeader title={m['smallBiz.title']()} class="flex-1" />
				</div>
				{#key slug}
					<SmallBusinessSchemeSection {slug} {accessToken} info={billingQuery.data} />
				{/key}
			</section>
		{/if}

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
				onclick={() => deleteVatIdMutation?.mutate(slug)}
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
