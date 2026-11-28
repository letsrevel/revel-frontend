<script lang="ts">
	import * as m from '$lib/paraglide/messages.js';
	import type {
		EventInListSchema,
		TicketTierDetailSchema,
		SeriesPassAdminSchema,
		SeriesPassCreateSchema,
		SeriesPassUpdateSchema,
		PaymentMethod,
		PurchasableBy,
		Visibility
	} from '$lib/api/generated/types.gen';
	import { seriespassadminCreateSeriesPass, seriespassadminUpdateSeriesPass } from '$lib/api';
	import { invalidateAdminPasses } from '$lib/queries/series-passes';
	import { createMutation, useQueryClient } from '@tanstack/svelte-query';
	import {
		Dialog,
		DialogContent,
		DialogHeader,
		DialogTitle,
		DialogDescription
	} from '$lib/components/ui/dialog';
	import { Button } from '$lib/components/ui/button';
	import { currencyOptions } from '$lib/utils/currencies';
	import { Input } from '$lib/components/ui/input';
	import { Label } from '$lib/components/ui/label';
	import { Textarea } from '$lib/components/ui/textarea';
	import {
		CURRENCY_SYMBOLS,
		normalizeDecimalInput,
		toDatetimeLocal,
		toTimezoneAwareISO
	} from '$lib/components/events/admin/tier-form-helpers';
	import { extractErrorMessage } from '$lib/utils/errors';
	import { formatDateTimeReadback } from '$lib/utils/date';
	import PassTierMappingSection from './PassTierMappingSection.svelte';
	import { toPassFieldErrors } from './pass-field-errors';
	import { toast } from 'svelte-sonner';
	import AdminWarningList from '$lib/components/admin-warnings/AdminWarningList.svelte';
	import { compactWarnings, withFix } from '$lib/utils/admin-warnings/types';
	import {
		passVisibleInRestrictedOrg,
		passSalesEndBeforeStart,
		passSalesStartTooLate,
		passOnlineWithoutStripe,
		passDiscountCoversPrice,
		passPriceAboveTiersSum
	} from '$lib/utils/admin-warnings/series-pass';

	interface Props {
		seriesId: string;
		accessToken: string | null;
		/** Pass to edit; null/undefined = create mode. */
		pass?: SeriesPassAdminSchema | null;
		/** Upcoming (non-template) occurrences — coverage candidates for create mode. */
		upcomingEvents: EventInListSchema[];
		/** Organization visibility; unset = unknown (no visibility warning). */
		organizationVisibility?: string | null;
		/** Unset = assume connected (no payment warning). */
		organizationStripeConnected?: boolean;
		/** Injected clock (epoch ms) for the warning rules. */
		now?: number;
		onClose: () => void;
	}

	const {
		seriesId,
		accessToken,
		pass,
		upcomingEvents,
		organizationVisibility,
		organizationStripeConnected = true,
		now,
		onClose
	}: Props = $props();

	const queryClient = useQueryClient();
	const isEdit = $derived(!!pass);

	// Scalar form state, seeded from the pass in edit mode.
	let name = $state(pass?.name ?? '');
	let description = $state(pass?.description ?? '');
	let price = $state(pass?.price ?? '');
	let proRataDiscount = $state(pass?.pro_rata_discount ?? '');
	let currency = $state(pass?.currency?.toUpperCase() ?? 'EUR');
	let paymentMethod = $state<PaymentMethod>(pass?.payment_method ?? 'online');
	let purchasableBy = $state<PurchasableBy>(pass?.purchasable_by ?? 'public');
	let visibility = $state<Visibility>(pass?.visibility ?? 'public');
	let salesStartAt = $state(toDatetimeLocal(pass?.sales_start_at));
	let salesEndAt = $state(toDatetimeLocal(pass?.sales_end_at));
	let totalQuantity = $state(pass?.total_quantity != null ? String(pass.total_quantity) : '');

	// Coverage (create mode only): eventId -> tierId | null (explicitly excluded).
	let tierSelections = $state<Record<string, string | null | undefined>>({});

	// Tiers per event, reported by the mapping section once loaded (create mode).
	let loadedTiers = $state<Record<string, TicketTierDetailSchema[]> | null>(null);

	// Live setting warnings (#1314). Edit mode covers the saved links; create mode
	// covers the events with a selected tier.
	const settingWarnings = $derived.by(() => {
		const selected = upcomingEvents.filter((e) => typeof tierSelections[e.id] === 'string');
		const base = {
			coveredEventStarts: isEdit
				? (pass?.tier_links ?? []).map((l) => l.event_start)
				: selected.map((e) => e.start),
			now: now ?? Date.now(),
			...(isEdit ? { is_active: pass?.is_active } : {})
		};
		const schedule = { ...base, sales_start_at: salesStartAt, sales_end_at: salesEndAt };
		const a3 = passVisibleInRestrictedOrg({ ...base, organizationVisibility, visibility });
		const e1Order = passSalesEndBeforeStart(schedule);
		const e1Late = passSalesStartTooLate(schedule);
		const e3 = passOnlineWithoutStripe({
			...base,
			payment_method: paymentMethod,
			organizationStripeConnected
		});
		const e4a = passDiscountCoversPrice({
			...base,
			price,
			pro_rata_discount: proRataDiscount
		});
		const e4b = isEdit
			? null
			: passPriceAboveTiersSum({
					...base,
					price,
					currency,
					selectedTiers: selected.map((e) => {
						const tier = loadedTiers?.[e.id]?.find((t) => t.id === tierSelections[e.id]);
						return tier ? { price: tier.price, currency: tier.currency } : null;
					})
				});
		return compactWarnings([
			a3 && withFix(a3, 'pass-visibility', () => m['adminWarnings.fixVisibility']()),
			e1Order && withFix(e1Order, 'pass-sales-end', () => m['adminWarnings.fixPassSalesEnd']()),
			e1Late && withFix(e1Late, 'pass-sales-start', () => m['adminWarnings.fixPassSalesStart']()),
			e3 && withFix(e3, 'pass-payment-method', () => m['adminWarnings.fixPassPaymentMethod']()),
			e4a && withFix(e4a, 'pass-discount', () => m['adminWarnings.fixPassDiscount']()),
			e4b && withFix(e4b, 'pass-price', () => m['adminWarnings.fixPassPrice']())
		]);
	});

	let fieldErrors = $state<Record<string, string>>({});
	let formError = $state('');

	// Fields with their own inline slot below. Anything else (a non-field error) must
	// still reach the form-level alert, but a keyed error rendered inline is not
	// repeated there. A stricter-tier link (create) is keyed `tier`/`event`/`tier_links`
	// and shows beside the coverage control; a pass rule that would strand an existing
	// link (edit) is keyed `purchasable_by` and shows under that select.
	const INLINE_FIELDS = new Set([
		'name',
		'price',
		'pro_rata_discount',
		'currency',
		'payment_method',
		'purchasable_by',
		'total_quantity'
	]);
	// Coverage fields only have an inline slot when the mapping section is rendered
	// (create mode); in edit mode they must reach the form-level alert.
	const COVERAGE_FIELDS = new Set(['tier', 'event', 'tier_links']);
	function isInlineField(key: string): boolean {
		return INLINE_FIELDS.has(key) || (!isEdit && COVERAGE_FIELDS.has(key));
	}
	const tierLinkError = $derived(
		isEdit
			? ''
			: [fieldErrors.tier, fieldErrors.event, fieldErrors.tier_links].filter(Boolean).join(' ')
	);

	function formErrorFor(error: unknown, fallback: string): string {
		const keys = Object.keys(fieldErrors);
		if (keys.length > 0 && keys.every(isInlineField)) return '';
		return error instanceof Error ? error.message : fallback;
	}

	const createMutationObj = createMutation(() => ({
		mutationFn: async (body: SeriesPassCreateSchema) => {
			const response = await seriespassadminCreateSeriesPass({
				path: { series_id: seriesId },
				body,
				headers: { Authorization: `Bearer ${accessToken}` }
			});
			if (response.error) {
				fieldErrors = toPassFieldErrors(response.error);
				throw new Error(extractErrorMessage(response.error, m['seriesPassAdmin.createFailed']()));
			}
			return response.data;
		},
		onSuccess: async () => {
			await invalidateAdminPasses(queryClient, seriesId);
			toast.success(m['seriesPassAdmin.createSuccess']());
			onClose();
		},
		onError: (error) => {
			formError = formErrorFor(error, m['seriesPassAdmin.createFailed']());
		}
	}));

	const updateMutationObj = createMutation(() => ({
		mutationFn: async (body: SeriesPassUpdateSchema) => {
			const response = await seriespassadminUpdateSeriesPass({
				path: { series_id: seriesId, pass_id: pass?.id ?? '' },
				body,
				headers: { Authorization: `Bearer ${accessToken}` }
			});
			if (response.error) {
				fieldErrors = toPassFieldErrors(response.error);
				throw new Error(extractErrorMessage(response.error, m['seriesPassAdmin.updateFailed']()));
			}
			return response.data;
		},
		onSuccess: async () => {
			await invalidateAdminPasses(queryClient, seriesId);
			toast.success(m['seriesPassAdmin.updateSuccess']());
			onClose();
		},
		onError: (error) => {
			formError = formErrorFor(error, m['seriesPassAdmin.updateFailed']());
		}
	}));

	const isPending = $derived(createMutationObj.isPending || updateMutationObj.isPending);

	function handleSubmit(e: SubmitEvent) {
		e.preventDefault();
		fieldErrors = {};
		formError = '';

		const tierLinks = Object.entries(tierSelections)
			.filter((entry): entry is [string, string] => !!entry[1])
			.map(([event_id, tier_id]) => ({ event_id, tier_id }));

		if (!isEdit && tierLinks.length < 2) {
			formError = m['seriesPassAdmin.needTwoEvents']();
			return;
		}

		if (isEdit) {
			updateMutationObj.mutate({
				name: name.trim(),
				description: description.trim() || null,
				price: normalizeDecimalInput(price) || '0',
				pro_rata_discount: normalizeDecimalInput(proRataDiscount) || '0',
				payment_method: paymentMethod,
				purchasable_by: purchasableBy,
				visibility,
				sales_start_at: salesStartAt ? toTimezoneAwareISO(salesStartAt) : null,
				sales_end_at: salesEndAt ? toTimezoneAwareISO(salesEndAt) : null,
				total_quantity: totalQuantity ? parseInt(totalQuantity, 10) : null
			});
		} else {
			createMutationObj.mutate({
				name: name.trim(),
				description: description.trim() || null,
				price: normalizeDecimalInput(price) || '0',
				pro_rata_discount: normalizeDecimalInput(proRataDiscount) || '0',
				currency: currency as SeriesPassCreateSchema['currency'],
				payment_method: paymentMethod,
				purchasable_by: purchasableBy,
				visibility,
				sales_start_at: salesStartAt ? toTimezoneAwareISO(salesStartAt) : null,
				sales_end_at: salesEndAt ? toTimezoneAwareISO(salesEndAt) : null,
				total_quantity: totalQuantity ? parseInt(totalQuantity, 10) : null,
				tier_links: tierLinks
			});
		}
	}
</script>

<Dialog open onOpenChange={onClose}>
	<DialogContent class="max-h-[90vh] overflow-y-auto sm:max-w-[640px]">
		<DialogHeader>
			<DialogTitle>
				{isEdit ? m['seriesPassAdmin.editTitle']() : m['seriesPassAdmin.createTitle']()}
			</DialogTitle>
			<DialogDescription>
				{isEdit ? m['seriesPassAdmin.editDescription']() : m['seriesPassAdmin.createDescription']()}
			</DialogDescription>
		</DialogHeader>

		<form onsubmit={handleSubmit} class="space-y-4">
			<!-- Name -->
			<div>
				<Label for="pass-name">
					{m['seriesPassAdmin.nameLabel']()} <span class="text-destructive">*</span>
				</Label>
				<Input
					id="pass-name"
					bind:value={name}
					required
					maxlength={255}
					placeholder={m['seriesPassAdmin.namePlaceholder']()}
					disabled={isPending}
				/>
				{#if fieldErrors.name}
					<p class="mt-1 text-sm text-destructive">{fieldErrors.name}</p>
				{/if}
			</div>

			<!-- Description -->
			<div>
				<Label for="pass-description">{m['seriesPassAdmin.descriptionLabel']()}</Label>
				<Textarea
					id="pass-description"
					bind:value={description}
					rows={3}
					placeholder={m['seriesPassAdmin.descriptionPlaceholder']()}
					disabled={isPending}
				/>
			</div>

			<!-- Price / discount / currency -->
			<div class="grid gap-4 sm:grid-cols-3">
				<div>
					<Label for="pass-price">
						{m['seriesPassAdmin.priceLabel']()} <span class="text-destructive">*</span>
					</Label>
					<div class="relative">
						<span
							class="pointer-events-none absolute inset-y-0 left-3 flex items-center text-sm text-muted-foreground"
						>
							{CURRENCY_SYMBOLS[currency] ?? currency}
						</span>
						<Input
							id="pass-price"
							type="text"
							inputmode="decimal"
							bind:value={price}
							oninput={() => (price = normalizeDecimalInput(price))}
							required
							class="pl-8"
							disabled={isPending}
						/>
					</div>
					{#if fieldErrors.price}
						<p class="mt-1 text-sm text-destructive">{fieldErrors.price}</p>
					{/if}
				</div>
				<div>
					<Label for="pass-discount">
						{m['seriesPassAdmin.proRataLabel']()} <span class="text-destructive">*</span>
					</Label>
					<div class="relative">
						<span
							class="pointer-events-none absolute inset-y-0 left-3 flex items-center text-sm text-muted-foreground"
						>
							{CURRENCY_SYMBOLS[currency] ?? currency}
						</span>
						<Input
							id="pass-discount"
							type="text"
							inputmode="decimal"
							bind:value={proRataDiscount}
							oninput={() => (proRataDiscount = normalizeDecimalInput(proRataDiscount))}
							required
							class="pl-8"
							disabled={isPending}
						/>
					</div>
					<p class="mt-1 text-xs text-muted-foreground">{m['seriesPassAdmin.proRataHint']()}</p>
					{#if fieldErrors.pro_rata_discount}
						<p class="mt-1 text-sm text-destructive">{fieldErrors.pro_rata_discount}</p>
					{/if}
				</div>
				<div>
					<Label for="pass-currency">{m['seriesPassAdmin.currencyLabel']()}</Label>
					<select
						id="pass-currency"
						value={currency}
						onchange={(e) => {
							currency = e.currentTarget.value;
							// Old-currency tier picks are ineligible under the new currency —
							// drop them so the mapping section re-defaults cleanly.
							tierSelections = {};
						}}
						disabled={isPending || isEdit}
						class="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
					>
						{#each currencyOptions() as opt (opt.value)}
							<option value={opt.value}>{opt.label}</option>
						{/each}
					</select>
					{#if fieldErrors.currency}
						<p class="mt-1 text-sm text-destructive">{fieldErrors.currency}</p>
					{/if}
				</div>
			</div>

			<!-- Payment method / purchasable by / visibility -->
			<div class="grid gap-4 sm:grid-cols-3">
				<div>
					<Label for="pass-payment-method">{m['seriesPassAdmin.paymentMethodLabel']()}</Label>
					<select
						id="pass-payment-method"
						bind:value={paymentMethod}
						disabled={isPending}
						class="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
					>
						<option value="online">{m['seriesPassAdmin.paymentOnline']()}</option>
						<option value="offline">{m['seriesPassAdmin.paymentOffline']()}</option>
						<option value="free">{m['seriesPassAdmin.paymentFree']()}</option>
					</select>
					{#if fieldErrors.payment_method}
						<p class="mt-1 text-sm text-destructive">{fieldErrors.payment_method}</p>
					{/if}
				</div>
				<div>
					<Label for="pass-purchasable-by">{m['seriesPassAdmin.purchasableByLabel']()}</Label>
					<select
						id="pass-purchasable-by"
						bind:value={purchasableBy}
						disabled={isPending}
						aria-invalid={fieldErrors.purchasable_by ? 'true' : undefined}
						aria-describedby={[
							fieldErrors.purchasable_by ? 'pass-purchasable-by-error' : '',
							purchasableBy === 'non_members' || visibility === 'members-only'
								? 'pass-purchasable-by-conflict-hint'
								: '',
							purchasableBy === 'non_members' ? 'pass-non-members-help' : ''
						]
							.filter(Boolean)
							.join(' ') || undefined}
						class="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
					>
						<option value="public">{m['seriesPassAdmin.purchasablePublic']()}</option>
						<option value="members">{m['seriesPassAdmin.purchasableMembers']()}</option>
						<option value="non_members" disabled={visibility === 'members-only'}
							>{m['seriesPassAdmin.purchasableNonMembers']()}</option
						>
					</select>
					{#if purchasableBy === 'non_members' || visibility === 'members-only'}
						<p
							id="pass-purchasable-by-conflict-hint"
							class="mt-1 text-xs text-muted-foreground"
							data-testid="pass-purchasable-by-conflict-hint"
						>
							{m['tierForm.nonMembersNeedsVisible']()}
						</p>
					{/if}
					{#if purchasableBy === 'non_members'}
						<p
							id="pass-non-members-help"
							class="mt-1 text-xs text-muted-foreground"
							data-testid="pass-non-members-help"
						>
							{m['seriesPassAdmin.nonMembersHelp']()}
						</p>
					{/if}
					{#if fieldErrors.purchasable_by}
						<p
							id="pass-purchasable-by-error"
							class="mt-1 text-sm text-destructive"
							role="alert"
							data-testid="pass-purchasable-by-error"
						>
							{fieldErrors.purchasable_by}
						</p>
					{/if}
				</div>
				<div>
					<Label for="pass-visibility">{m['seriesPassAdmin.visibilityLabel']()}</Label>
					<select
						id="pass-visibility"
						bind:value={visibility}
						disabled={isPending}
						class="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
					>
						<option value="public">{m['seriesPassAdmin.visibilityPublic']()}</option>
						<option value="unlisted">{m['seriesPassAdmin.visibilityUnlisted']()}</option>
						<option value="members-only" disabled={purchasableBy === 'non_members'}
							>{m['seriesPassAdmin.visibilityMembersOnly']()}</option
						>
						<option value="private">{m['seriesPassAdmin.visibilityPrivate']()}</option>
					</select>
				</div>
			</div>

			<!-- Sales window / quantity -->
			<div class="grid gap-4 sm:grid-cols-3">
				<div>
					<Label for="pass-sales-start">{m['seriesPassAdmin.salesStartLabel']()}</Label>
					<Input
						id="pass-sales-start"
						type="datetime-local"
						bind:value={salesStartAt}
						disabled={isPending}
					/>
					{#if salesStartAt}
						<p class="mt-1 text-xs text-muted-foreground">
							{formatDateTimeReadback(salesStartAt)}
						</p>
					{/if}
				</div>
				<div>
					<Label for="pass-sales-end">{m['seriesPassAdmin.salesEndLabel']()}</Label>
					<Input
						id="pass-sales-end"
						type="datetime-local"
						bind:value={salesEndAt}
						disabled={isPending}
					/>
					{#if salesEndAt}
						<p class="mt-1 text-xs text-muted-foreground">
							{formatDateTimeReadback(salesEndAt)}
						</p>
					{/if}
				</div>
				<div>
					<Label for="pass-quantity">{m['seriesPassAdmin.quantityLabel']()}</Label>
					<Input
						id="pass-quantity"
						type="number"
						min="1"
						bind:value={totalQuantity}
						placeholder={m['seriesPassAdmin.quantityPlaceholder']()}
						disabled={isPending}
					/>
					{#if fieldErrors.total_quantity}
						<p class="mt-1 text-sm text-destructive">{fieldErrors.total_quantity}</p>
					{/if}
				</div>
			</div>

			<!-- Coverage (create only; edited via the coverage actions afterwards) -->
			{#if !isEdit}
				<PassTierMappingSection
					events={upcomingEvents}
					{accessToken}
					{currency}
					passPurchasableBy={purchasableBy}
					error={tierLinkError}
					selections={tierSelections}
					onSelectionsChange={(next) => (tierSelections = next)}
					onTiersLoaded={(tiers) => (loadedTiers = tiers)}
					disabled={isPending}
				/>
			{:else}
				<p class="rounded-md border border-dashed p-3 text-xs text-muted-foreground">
					{m['seriesPassAdmin.coverageEditNote']()}
				</p>
			{/if}

			<AdminWarningList
				warnings={settingWarnings}
				entityId={pass?.id ?? undefined}
				fallbackFocusId="pass-name"
				label={m['adminWarnings.listLabel']()}
				testId="series-pass-form-warnings"
			/>

			{#if formError}
				<p class="text-sm text-destructive" role="alert">{formError}</p>
			{/if}

			<div class="flex justify-end gap-2 pt-2">
				<Button type="button" variant="outline" onclick={onClose} disabled={isPending}>
					{m['seriesPass.cancelButton']()}
				</Button>
				<Button type="submit" disabled={isPending}>
					{#if isPending}
						{m['seriesPass.processing']()}
					{:else if isEdit}
						{m['seriesPassAdmin.saveButton']()}
					{:else}
						{m['seriesPassAdmin.createButton']()}
					{/if}
				</Button>
			</div>
		</form>
	</DialogContent>
</Dialog>
