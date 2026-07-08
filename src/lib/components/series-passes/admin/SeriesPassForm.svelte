<script lang="ts">
	import * as m from '$lib/paraglide/messages.js';
	import type {
		EventInListSchema,
		SeriesPassSchema,
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
	import { Input } from '$lib/components/ui/input';
	import { Label } from '$lib/components/ui/label';
	import { Textarea } from '$lib/components/ui/textarea';
	import {
		SUPPORTED_CURRENCIES,
		CURRENCY_SYMBOLS,
		normalizeDecimalInput,
		toDatetimeLocal,
		toTimezoneAwareISO
	} from '$lib/components/events/admin/tier-form-helpers';
	import { extractErrorMessage, extractFieldErrors } from '$lib/utils/errors';
	import { formatDateTimeReadback } from '$lib/utils/date';
	import PassTierMappingSection from './PassTierMappingSection.svelte';
	import { toast } from 'svelte-sonner';

	interface Props {
		seriesId: string;
		accessToken: string | null;
		/** Pass to edit; null/undefined = create mode. */
		pass?: SeriesPassSchema | null;
		/** Upcoming (non-template) occurrences — coverage candidates for create mode. */
		upcomingEvents: EventInListSchema[];
		onClose: () => void;
	}

	const { seriesId, accessToken, pass, upcomingEvents, onClose }: Props = $props();

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
	let visibility = $state<Visibility>('public');
	let salesStartAt = $state(toDatetimeLocal(pass?.sales_start_at));
	let salesEndAt = $state(toDatetimeLocal(pass?.sales_end_at));
	let totalQuantity = $state('');

	// Coverage (create mode only): eventId -> tierId | null (explicitly excluded).
	let tierSelections = $state<Record<string, string | null | undefined>>({});

	let fieldErrors = $state<Record<string, string>>({});
	let formError = $state('');

	const createMutationObj = createMutation(() => ({
		mutationFn: async (body: SeriesPassCreateSchema) => {
			const response = await seriespassadminCreateSeriesPass({
				path: { series_id: seriesId },
				body,
				headers: { Authorization: `Bearer ${accessToken}` }
			});
			if (response.error) {
				fieldErrors = Object.fromEntries(
					extractFieldErrors(response.error).map(({ field, messages }) => [
						field,
						messages.join(' ')
					])
				);
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
			formError = error instanceof Error ? error.message : m['seriesPassAdmin.createFailed']();
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
				fieldErrors = Object.fromEntries(
					extractFieldErrors(response.error).map(({ field, messages }) => [
						field,
						messages.join(' ')
					])
				);
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
			formError = error instanceof Error ? error.message : m['seriesPassAdmin.updateFailed']();
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
			// PATCH is exclude_unset and the public schema doesn't expose
			// visibility/total_quantity — only send what the form actually knows,
			// so unknown settings are never clobbered with defaults.
			updateMutationObj.mutate({
				name: name.trim(),
				description: description.trim() || null,
				price: normalizeDecimalInput(price) || '0',
				pro_rata_discount: normalizeDecimalInput(proRataDiscount) || '0',
				payment_method: paymentMethod,
				purchasable_by: purchasableBy,
				sales_start_at: salesStartAt ? toTimezoneAwareISO(salesStartAt) : null,
				sales_end_at: salesEndAt ? toTimezoneAwareISO(salesEndAt) : null
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
						{#each SUPPORTED_CURRENCIES as { code, name } (code)}
							<option value={code}>{code} — {name}</option>
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
						class="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
					>
						<option value="public">{m['seriesPassAdmin.purchasablePublic']()}</option>
						<option value="members">{m['seriesPassAdmin.purchasableMembers']()}</option>
					</select>
				</div>
				{#if !isEdit}
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
							<option value="members-only">{m['seriesPassAdmin.visibilityMembersOnly']()}</option>
							<option value="private">{m['seriesPassAdmin.visibilityPrivate']()}</option>
						</select>
					</div>
				{/if}
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
				{#if !isEdit}
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
				{/if}
			</div>

			<!-- Coverage (create only; edited via the coverage actions afterwards) -->
			{#if !isEdit}
				<PassTierMappingSection
					events={upcomingEvents}
					{accessToken}
					{currency}
					selections={tierSelections}
					onSelectionsChange={(next) => (tierSelections = next)}
					disabled={isPending}
				/>
			{:else}
				<p class="rounded-md border border-dashed p-3 text-xs text-muted-foreground">
					{m['seriesPassAdmin.coverageEditNote']()}
				</p>
			{/if}

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
