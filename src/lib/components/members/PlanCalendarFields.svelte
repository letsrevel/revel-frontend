<script lang="ts">
	import * as m from '$lib/paraglide/messages.js';
	import type {
		FirstPeriodPricing,
		PeriodAlignment,
		PeriodUnit
	} from '$lib/api/generated/types.gen';
	import { Label } from '$lib/components/ui/label';
	import { formatMonthName } from '$lib/utils/calendar';

	interface Props {
		/** Editing an existing plan: alignment and start month are create-only. */
		editing: boolean;
		alignment: PeriodAlignment;
		startMonth: number;
		firstPricing: FirstPeriodPricing;
		periodUnit: PeriodUnit;
		/** Online (Stripe) plans can only prorate the first period. */
		isOnline: boolean;
		isSaving?: boolean;
		/** Id of the rendered first-pricing error, when there is one. */
		firstPricingErrorId?: string;
	}

	let {
		editing,
		alignment = $bindable(),
		startMonth = $bindable(),
		firstPricing = $bindable(),
		periodUnit,
		isOnline,
		isSaving = false,
		firstPricingErrorId
	}: Props = $props();

	const isCalendar = $derived(alignment === 'calendar');
	const months = Array.from({ length: 12 }, (_, i) => i + 1);
	const selectClass =
		'flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm transition-colors focus:border-ring focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:opacity-50';
</script>

{#if editing}
	<div class="space-y-1 text-sm">
		<span class="font-medium">{m['orgAdmin.members.plans.form.alignment']()}</span>
		<span class="text-muted-foreground" data-testid="plan-alignment-readonly">
			{#if isCalendar}
				{m['orgAdmin.members.plans.form.alignmentCalendar']()}{#if periodUnit === 'year'}
					({m['orgAdmin.members.plans.form.calendarStartMonth']()}: {formatMonthName(
						startMonth
					)}){/if}
			{:else}
				{m['orgAdmin.members.plans.form.alignmentRolling']()}
			{/if}
		</span>
		<p class="text-xs text-muted-foreground">
			{m['orgAdmin.members.plans.form.alignmentImmutable']()}
		</p>
	</div>
{:else}
	<fieldset class="space-y-1">
		<legend class="text-sm font-medium">{m['orgAdmin.members.plans.form.alignment']()}</legend>
		<div class="space-y-2">
			<div class="flex items-start gap-2 text-sm">
				<input
					type="radio"
					id="plan-alignment-rolling"
					name="plan-alignment"
					value="rolling"
					class="mt-1"
					bind:group={alignment}
					disabled={isSaving}
					aria-describedby="plan-alignment-rolling-help"
				/>
				<div>
					<label for="plan-alignment-rolling">
						{m['orgAdmin.members.plans.form.alignmentRolling']()}
					</label>
					<span id="plan-alignment-rolling-help" class="block text-xs text-muted-foreground">
						{m['orgAdmin.members.plans.form.alignmentRollingHelp']()}
					</span>
				</div>
			</div>
			<div class="flex items-start gap-2 text-sm">
				<input
					type="radio"
					id="plan-alignment-calendar"
					name="plan-alignment"
					value="calendar"
					class="mt-1"
					bind:group={alignment}
					disabled={isSaving}
					aria-describedby="plan-alignment-calendar-help"
				/>
				<div>
					<label for="plan-alignment-calendar">
						{m['orgAdmin.members.plans.form.alignmentCalendar']()}
					</label>
					<span id="plan-alignment-calendar-help" class="block text-xs text-muted-foreground">
						{m['orgAdmin.members.plans.form.alignmentCalendarHelp']()}
					</span>
				</div>
			</div>
		</div>
	</fieldset>

	{#if isCalendar && periodUnit === 'year'}
		<div class="space-y-1">
			<Label for="plan-calendar-start-month">
				{m['orgAdmin.members.plans.form.calendarStartMonth']()}
			</Label>
			<select
				id="plan-calendar-start-month"
				bind:value={startMonth}
				disabled={isSaving}
				aria-describedby="plan-calendar-start-month-help"
				class={selectClass}
			>
				{#each months as month (month)}
					<option value={month}>{formatMonthName(month)}</option>
				{/each}
			</select>
			<p id="plan-calendar-start-month-help" class="text-xs text-muted-foreground">
				{m['orgAdmin.members.plans.form.calendarStartMonthHelp']()}
			</p>
		</div>
	{/if}
{/if}

{#if isCalendar}
	<fieldset class="space-y-1" aria-describedby={firstPricingErrorId}>
		<legend class="text-sm font-medium">{m['orgAdmin.members.plans.form.firstPricing']()}</legend>
		<div class="space-y-2">
			<div class="flex items-start gap-2 text-sm">
				<input
					type="radio"
					id="plan-first-pricing-prorated"
					name="plan-first-pricing"
					value="prorated"
					class="mt-1"
					bind:group={firstPricing}
					disabled={isSaving}
					aria-describedby={['plan-first-pricing-prorated-help', firstPricingErrorId]
						.filter(Boolean)
						.join(' ')}
				/>
				<div>
					<label for="plan-first-pricing-prorated">
						{m['orgAdmin.members.plans.form.firstPricingProrated']()}
					</label>
					<span id="plan-first-pricing-prorated-help" class="block text-xs text-muted-foreground">
						{m['orgAdmin.members.plans.form.firstPricingProratedHelp']()}
					</span>
				</div>
			</div>
			<div class="flex items-start gap-2 text-sm" class:opacity-50={isOnline}>
				<input
					type="radio"
					id="plan-first-pricing-full"
					name="plan-first-pricing"
					value="full"
					class="mt-1"
					bind:group={firstPricing}
					disabled={isSaving || isOnline}
					aria-describedby={['plan-first-pricing-full-help', firstPricingErrorId]
						.filter(Boolean)
						.join(' ')}
				/>
				<div>
					<label for="plan-first-pricing-full">
						{m['orgAdmin.members.plans.form.firstPricingFull']()}
					</label>
					<span id="plan-first-pricing-full-help" class="block text-xs text-muted-foreground">
						{isOnline
							? m['orgAdmin.members.plans.form.firstPricingFullOnlineLocked']()
							: m['orgAdmin.members.plans.form.firstPricingFullHelp']()}
					</span>
				</div>
			</div>
		</div>
	</fieldset>
{/if}
