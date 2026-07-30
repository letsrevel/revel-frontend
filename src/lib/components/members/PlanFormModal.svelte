<script lang="ts">
	import * as m from '$lib/paraglide/messages.js';
	import type {
		PlanSchema,
		PlanCreateSchema,
		OrganizationAdminDetailSchema,
		PeriodUnit,
		SubscriptionPaymentMethod
	} from '$lib/api/generated/types.gen';
	import { Dialog, DialogContent, DialogHeader, DialogTitle } from '$lib/components/ui/dialog';
	import { Button } from '$lib/components/ui/button';
	import { Label } from '$lib/components/ui/label';
	import { Input } from '$lib/components/ui/input';
	import { Checkbox } from '$lib/components/ui/checkbox';
	import { Textarea } from '$lib/components/ui/textarea';
	import { Loader2 } from '@lucide/svelte';
	import { untrack } from 'svelte';
	import { CURRENCY_OPTIONS } from '$lib/utils/currencies';

	export type PlanFormPayload = PlanCreateSchema;

	interface Props {
		plan: PlanSchema | null;
		open: boolean;
		onClose: () => void;
		onSave: (payload: PlanFormPayload) => void;
		organization: OrganizationAdminDetailSchema;
		isSaving?: boolean;
	}

	const { plan, open, onClose, onSave, organization, isSaving = false }: Props = $props();

	let name = $state('');
	let description = $state('');
	let price = $state('0.00');
	let currency = $state<string>('EUR');
	let periodUnit = $state<PeriodUnit>('month');
	let periodCount = $state(1);
	let isActive = $state(true);
	let paymentMethod = $state<SubscriptionPaymentMethod>('offline');
	let salesPaused = $state(false);
	// Svelte writes `null` (not '') back into a `type="number"` binding when the
	// field is emptied, so the cleared cap has to survive as a nullish value —
	// `Number(null)` is 0, which would silently make the plan permanently sold out.
	let maxSubscriptions = $state<string | number | null>('');
	let errors = $state<{ name?: string; price?: string; period?: string; maxSubs?: string }>({});

	$effect(() => {
		// Track `open` so reopening the create modal after abandoning a prior
		// attempt resets the fields. Tracking `plan` alone misses the transition
		// from closed → open when plan is null both times.
		void open;
		if (plan) {
			name = plan.name;
			description = plan.description ?? '';
			price = String(plan.price);
			currency = plan.currency;
			periodUnit = plan.period_unit;
			periodCount = plan.period_count ?? 1;
			isActive = plan.is_active ?? true;
			paymentMethod = plan.payment_method;
			salesPaused = plan.sales_status === 'paused';
			maxSubscriptions = plan.max_subscriptions == null ? '' : String(plan.max_subscriptions);
		} else {
			name = '';
			description = '';
			price = '0.00';
			currency = 'EUR';
			periodUnit = 'month';
			periodCount = 1;
			isActive = true;
			paymentMethod = 'offline';
			salesPaused = false;
			maxSubscriptions = '';
		}
		errors = {};
	});

	/**
	 * The payment method the shape rules are judged against.
	 *
	 * It is immutable once a plan exists (`PlanUpdateSchema` has no
	 * `payment_method`), so an edit is validated against the *plan's* method —
	 * the radio group isn't even rendered then, and its state is only a leftover
	 * from whatever was last created.
	 */
	const effectiveMethod = $derived<SubscriptionPaymentMethod>(
		plan ? plan.payment_method : paymentMethod
	);
	const isFree = $derived(effectiveMethod === 'free');
	const isOnline = $derived(effectiveMethod === 'online');
	const isLifetime = $derived(periodUnit === 'lifetime');

	/**
	 * Keep the (method, price, cadence) triple coherent as the organizer types.
	 *
	 * `events.utils.subscription_plan_rules.validate_plan_shape` refuses a FREE
	 * plan that isn't priced 0 *and* lifetime, and an ONLINE plan that is
	 * lifetime — so those combinations are made unreachable here rather than
	 * offered and then rejected. `validate()` still asserts them: this effect
	 * cannot fire for a value the user never touched (e.g. a price typed before
	 * switching to Free would be cleared here, but a stale one must not slip
	 * through if the ordering ever changes).
	 */
	$effect(() => {
		if (paymentMethod === 'free') {
			price = '0.00';
			periodUnit = 'lifetime';
		} else if (paymentMethod === 'online' && untrack(() => periodUnit) === 'lifetime') {
			// Only reachable by picking lifetime under Offline and then switching to
			// Online — the option is withdrawn for Online, so it cannot be re-chosen.
			periodUnit = 'month';
		}
	});

	/** `null` = unlimited (field left empty or cleared). */
	function normalizedCap(): number | null {
		if (maxSubscriptions == null || maxSubscriptions === '') return null;
		return Number(maxSubscriptions);
	}

	function validate(): boolean {
		errors = {};
		if (!name.trim()) {
			errors.name = m['orgAdmin.members.plans.form.errors.nameRequired']();
			return false;
		}
		const numeric = Number(price);
		if (!Number.isFinite(numeric) || numeric < 0) {
			errors.price = m['orgAdmin.members.plans.form.errors.priceInvalid']();
			return false;
		}
		// The three shape rules `validate_plan_shape` enforces server-side. The
		// controls above already make each violation hard to reach, but a form that
		// can submit something the backend can only refuse is a form that lies.
		if (isFree && numeric !== 0) {
			errors.price = m['orgAdmin.members.plans.form.errors.freePriceNotZero']();
			return false;
		}
		if (isOnline && numeric <= 0) {
			errors.price = m['orgAdmin.members.plans.form.errors.onlinePriceZero']();
			return false;
		}
		if (isFree && !isLifetime) {
			errors.period = m['orgAdmin.members.plans.form.errors.freeNeedsLifetime']();
			return false;
		}
		if (isOnline && isLifetime) {
			errors.period = m['orgAdmin.members.plans.form.errors.onlineNoLifetime']();
			return false;
		}
		// A lifetime term never renews, so `period_count` describes nothing — the
		// field is withdrawn from the form and its value is not asserted.
		if (!isLifetime && (!Number.isInteger(periodCount) || periodCount < 1 || periodCount > 120)) {
			errors.period = m['orgAdmin.members.plans.form.errors.periodInvalid']();
			return false;
		}
		const cap = normalizedCap();
		if (cap !== null && (!Number.isInteger(cap) || cap < 1)) {
			errors.maxSubs = m['orgAdmin.members.plans.form.errors.maxSubsInvalid']();
			return false;
		}
		return true;
	}

	function handleSubmit(e: Event) {
		e.preventDefault();
		if (!validate()) return;
		onSave({
			name: name.trim(),
			description,
			price,
			currency: currency as PlanCreateSchema['currency'],
			period_unit: periodUnit,
			// A lifetime plan is never renewed, so the backend ignores this; pin it to
			// 1 rather than shipping whatever the (hidden) field last held.
			period_count: isLifetime ? 1 : periodCount,
			is_active: isActive,
			sales_status: salesPaused ? 'paused' : 'open',
			max_subscriptions: normalizedCap(),
			...(plan ? {} : { payment_method: paymentMethod })
		} as PlanCreateSchema);
	}
</script>

<Dialog
	{open}
	onOpenChange={(isOpen) => {
		if (!isOpen) onClose();
	}}
>
	<!-- Scrollable: this form outgrew a phone viewport (payment method, capacity
	     cap, sales pause), and the dialog is `position: fixed` — without its own
	     scroll container the submit row sits below the fold with no way to reach
	     it. -->
	<DialogContent class="max-h-[90vh] overflow-y-auto sm:max-w-md">
		<DialogHeader>
			<DialogTitle>
				{plan
					? m['orgAdmin.members.plans.form.update']()
					: m['orgAdmin.members.plans.form.create']()}
			</DialogTitle>
		</DialogHeader>

		<form onsubmit={handleSubmit} class="space-y-4">
			<div class="space-y-1">
				<Label for="plan-name">{m['orgAdmin.members.plans.form.name']()}</Label>
				<Input id="plan-name" bind:value={name} maxlength={255} required disabled={isSaving} />
				{#if errors.name}<p class="text-sm text-destructive">{errors.name}</p>{/if}
			</div>

			{#if plan}
				<div class="space-y-1 text-sm">
					<span class="font-medium">{m['orgAdmin.members.plans.form.paymentMethod']()}</span>
					<span class="text-muted-foreground">
						{#if plan.payment_method === 'online'}
							{m['orgAdmin.members.plans.form.paymentOnline']()}
						{:else if plan.payment_method === 'free'}
							{m['orgAdmin.members.plans.form.paymentFree']()}
						{:else}
							{m['orgAdmin.members.plans.form.paymentOffline']()}
						{/if}
					</span>
					<p class="text-xs text-muted-foreground">
						{m['orgAdmin.members.plans.form.paymentMethodImmutable']()}
					</p>
				</div>
			{:else}
				<fieldset class="space-y-1">
					<legend class="text-sm font-medium">
						{m['orgAdmin.members.plans.form.paymentMethod']()}
					</legend>
					<!-- Wraps on a phone: three options no longer fit one row. -->
					<div class="flex flex-wrap gap-x-4 gap-y-2">
						<label class="flex items-center gap-2 text-sm">
							<input
								type="radio"
								name="payment-method"
								value="offline"
								bind:group={paymentMethod}
								disabled={isSaving}
							/>
							{m['orgAdmin.members.plans.form.paymentOffline']()}
						</label>
						<label
							class="flex items-center gap-2 text-sm"
							class:opacity-50={!organization.is_stripe_connected}
						>
							<input
								type="radio"
								name="payment-method"
								value="online"
								bind:group={paymentMethod}
								disabled={isSaving || !organization.is_stripe_connected}
							/>
							{m['orgAdmin.members.plans.form.paymentOnline']()}
						</label>
						<!-- No Stripe gate: a FREE plan has no Stripe object at all, so it is
						     offered even to an organization that never connected an account. -->
						<label class="flex items-center gap-2 text-sm">
							<input
								type="radio"
								name="payment-method"
								value="free"
								bind:group={paymentMethod}
								disabled={isSaving}
							/>
							{m['orgAdmin.members.plans.form.paymentFree']()}
						</label>
					</div>
					<p class="text-xs text-muted-foreground">
						{organization.is_stripe_connected
							? m['orgAdmin.members.plans.form.paymentMethodHelp']()
							: m['orgAdmin.members.plans.form.paymentOnlineNeedsStripe']()}
					</p>
					{#if isFree}
						<p class="text-xs text-muted-foreground">
							{m['orgAdmin.members.plans.form.paymentFreeHelp']()}
						</p>
					{/if}
				</fieldset>
			{/if}

			<div class="space-y-1">
				<Label for="plan-desc">{m['orgAdmin.members.plans.form.description']()}</Label>
				<Textarea id="plan-desc" bind:value={description} rows={2} disabled={isSaving} />
			</div>

			<div class="grid grid-cols-2 gap-3">
				<div class="space-y-1">
					<Label for="plan-price">{m['orgAdmin.members.plans.form.price']()}</Label>
					<!-- A FREE plan is priced 0 by definition (the backend refuses anything
					     else), so the field is locked rather than left to be rejected. The
					     reason is announced with it via `aria-describedby`, not left to the
					     greyed-out styling. -->
					<Input
						id="plan-price"
						type="number"
						min="0"
						step="0.01"
						bind:value={price}
						required
						disabled={isSaving || isFree}
						aria-describedby={isFree ? 'plan-shape-locked' : undefined}
					/>
				</div>
				<div class="space-y-1">
					<Label for="plan-currency">{m['orgAdmin.members.plans.form.currency']()}</Label>
					<select
						id="plan-currency"
						bind:value={currency}
						disabled={isSaving}
						class="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm transition-colors focus:border-ring focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
					>
						{#each CURRENCY_OPTIONS as opt (opt.value)}
							<option value={opt.value}>{opt.label}</option>
						{/each}
					</select>
				</div>
			</div>
			{#if errors.price}<p class="text-sm text-destructive">{errors.price}</p>{/if}

			<div class="grid grid-cols-2 gap-3">
				{#if !isLifetime}
					<div class="space-y-1">
						<Label for="plan-period-count">{m['orgAdmin.members.plans.form.periodCount']()}</Label>
						<Input
							id="plan-period-count"
							type="number"
							min="1"
							max="120"
							bind:value={periodCount}
							required
							disabled={isSaving}
						/>
					</div>
				{/if}
				<div class="space-y-1">
					<Label for="plan-period-unit">{m['orgAdmin.members.plans.form.periodUnit']()}</Label>
					<select
						id="plan-period-unit"
						bind:value={periodUnit}
						disabled={isSaving || isFree}
						aria-describedby={isFree ? 'plan-shape-locked' : undefined}
						class="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm transition-colors focus:border-ring focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
					>
						<option value="month">{m['orgAdmin.members.plans.form.periodMonth']()}</option>
						<option value="year">{m['orgAdmin.members.plans.form.periodYear']()}</option>
						<!-- Withdrawn for ONLINE: Stripe bills monthly or yearly, so the
						     backend refuses a lifetime Stripe plan outright. -->
						{#if !isOnline}
							<option value="lifetime">
								{m['orgAdmin.members.plans.form.periodLifetime']()}
							</option>
						{/if}
					</select>
				</div>
			</div>
			{#if isFree}
				<p id="plan-shape-locked" class="text-xs text-muted-foreground">
					{m['orgAdmin.members.plans.form.freeShapeLocked']()}
				</p>
			{:else if isLifetime}
				<p class="text-xs text-muted-foreground">
					{m['orgAdmin.members.plans.form.lifetimeNoCount']()}
				</p>
			{/if}
			{#if errors.period}<p class="text-sm text-destructive">{errors.period}</p>{/if}

			<div class="space-y-1">
				<Label for="plan-max-subs">{m['orgAdmin.members.plans.form.maxSubscriptions']()}</Label>
				<Input
					id="plan-max-subs"
					type="number"
					min="1"
					bind:value={maxSubscriptions}
					placeholder={m['orgAdmin.members.plans.form.maxSubscriptionsUnlimited']()}
					disabled={isSaving}
				/>
				{#if errors.maxSubs}<p class="text-sm text-destructive">{errors.maxSubs}</p>{/if}
				<p class="text-xs text-muted-foreground">
					{m['orgAdmin.members.plans.form.maxSubscriptionsHelp']()}
				</p>
			</div>

			<div class="flex items-center gap-2">
				<Checkbox
					id="plan-sales-paused"
					checked={salesPaused}
					onCheckedChange={(checked) => {
						salesPaused = checked === true;
					}}
					disabled={isSaving}
				/>
				<div>
					<Label for="plan-sales-paused">{m['orgAdmin.members.plans.form.pauseSales']()}</Label>
					<p class="text-xs text-muted-foreground">
						{m['orgAdmin.members.plans.form.pauseSalesHelp']()}
					</p>
				</div>
			</div>

			<div class="flex items-center gap-2">
				<Checkbox
					id="plan-active"
					checked={isActive}
					onCheckedChange={(checked) => {
						isActive = checked === true;
					}}
					disabled={isSaving}
				/>
				<div>
					<Label for="plan-active">{m['orgAdmin.members.plans.form.isActive']()}</Label>
					<p class="text-xs text-muted-foreground">
						{m['orgAdmin.members.plans.form.isActiveHelp']()}
					</p>
				</div>
			</div>

			<div class="flex justify-end gap-2">
				<Button type="button" variant="outline" onclick={onClose} disabled={isSaving}>
					{m['tierForm.cancel']()}
				</Button>
				<Button type="submit" disabled={isSaving}>
					{#if isSaving}<Loader2 class="mr-2 h-4 w-4 animate-spin" />{/if}
					{plan
						? m['orgAdmin.members.plans.form.update']()
						: m['orgAdmin.members.plans.form.create']()}
				</Button>
			</div>
		</form>
	</DialogContent>
</Dialog>
