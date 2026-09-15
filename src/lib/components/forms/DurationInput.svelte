<script lang="ts">
	import * as m from '$lib/paraglide/messages.js';
	import { Input } from '$lib/components/ui/input';
	import { Label } from '$lib/components/ui/label';
	import { Select, SelectContent, SelectItem, SelectTrigger } from '$lib/components/ui/select';
	import { cn } from '$lib/utils/cn';
	import {
		ALLOWED_UNITS,
		fromStorage,
		toDisplay,
		toStorage,
		type StorageUnit,
		type Unit
	} from '$lib/utils/duration';
	import { numericField } from '$lib/utils/numeric-input.svelte';

	/**
	 * DurationInput Component
	 *
	 * Composite number + unit picker for relative durations. Stores its value in
	 * `storageUnit` (the unit the parent form expects). Optional "no limit" chip
	 * for fields whose empty state maps to null or 0.
	 */
	interface Props {
		value: number | null;
		storageUnit: StorageUnit;
		defaultUnit: Unit;
		emptyValue?: null | 0;
		emptyLabel?: string;
		label: string;
		helpText?: string;
		id?: string;
		required?: boolean;
		disabled?: boolean;
		min?: number;
		class?: string;
	}

	let {
		value = $bindable(null),
		storageUnit,
		defaultUnit,
		emptyValue,
		emptyLabel,
		label,
		helpText,
		id,
		required = false,
		disabled = false,
		min = 0,
		class: className
	}: Props = $props();

	$effect(() => {
		if (import.meta.env.DEV) {
			const hasLabel = emptyLabel !== undefined;
			const hasValue = emptyValue !== undefined;
			if (hasLabel !== hasValue) {
				console.warn(
					'[DurationInput] emptyLabel and emptyValue must both be set or both be omitted.'
				);
			}
			if (!ALLOWED_UNITS[storageUnit].includes(defaultUnit)) {
				console.warn(
					`[DurationInput] defaultUnit "${defaultUnit}" is not allowed for storageUnit "${storageUnit}". Allowed: ${ALLOWED_UNITS[storageUnit].join(', ')}.`
				);
			}
		}
	});

	const inputId = $derived(id || `duration-${Math.random().toString(36).slice(2, 9)}`);
	const helpId = $derived(helpText ? `${inputId}-help` : undefined);
	const allowedUnits = $derived(ALLOWED_UNITS[storageUnit]);
	const hasChip = $derived(emptyLabel !== undefined && emptyValue !== undefined);
	const isEmpty = $derived(value === (emptyValue ?? null));

	let displayAmount = $state<number | ''>('');
	let displayUnit = $state<Unit>(defaultUnit);

	// The amount field runs on the shared numeric-input helper, so it inherits the
	// guards that belong to every numeric field: a half-typed entry is never
	// rewritten under the caret, a `-` on its way to `-1` is not mistaken for a
	// clear (`badInput`), and a blur that settles on the committed value writes
	// nothing. `displayAmount` stays the committed display, so the re-sync effect
	// below never reads the raw buffer — only `amountField.editing`.
	const amountField = numericField<number | null>({
		value: () => (displayAmount === '' ? null : displayAmount),
		commit: (next) => {
			displayAmount = next ?? '';
			emit(displayAmount, displayUnit);
		},
		// Empty is a durable state only where the parent gave an empty sentinel (the
		// "no limit" chip shows the same thing) — there it counts as a value and
		// commits without waiting for blur. Where the parent has none, an emptied
		// field is a half-typed state that settles back to the committed value on
		// blur, rather than a clear the parent would have to invent a number for.
		get emptyValue() {
			return emptyValue !== undefined ? null : undefined;
		},
		get min() {
			return min;
		}
	});

	$effect(() => {
		// Read defaultUnit into a local const so Svelte tracks it as a reactive dependency.
		const unit = defaultUnit;
		// While the field is being edited, whatever comes back in `value` is our own
		// emit — possibly rewritten by the parent on the way (RefundPolicyEditor maps
		// the empty value to 0). Re-picking the unit from it would silently
		// reinterpret the number under the caret: clearing a "3 Days" bracket used to
		// flip the picker to Hours, so the 7 typed next meant 7h, not 7 days (#935).
		// So mid-edit the unit is held, and changes only on an explicit pick, on a
		// chip reset, or when the incoming value can't be expressed in it. Outside an
		// edit the smart pick still runs, so a value arriving from the parent renders
		// in its largest whole unit (168h → 1 week).
		const editing = amountField.editing;
		if (isEmpty || value === null) {
			displayAmount = '';
			if (!editing) displayUnit = unit;
			return;
		}
		const current =
			displayAmount === '' ? null : toStorage(Number(displayAmount), displayUnit, storageUnit);
		if (current === value) return;
		if (editing) {
			const amount = toDisplay(value, storageUnit, displayUnit);
			if (amount !== null) {
				displayAmount = amount;
				return;
			}
		}
		const next = fromStorage(value, storageUnit);
		displayAmount = next.amount;
		displayUnit = next.unit;
	});

	function emit(amount: number | '', unit: Unit): void {
		if (amount === '' || Number.isNaN(Number(amount))) {
			value = (emptyValue ?? null) as typeof value;
			return;
		}
		value = toStorage(Number(amount), unit, storageUnit);
	}

	function handleUnitChange(next: string | undefined): void {
		if (!next) return;
		displayUnit = next as Unit;
		emit(displayAmount, displayUnit);
	}

	function handleChipClick(): void {
		amountField.reset();
		displayAmount = '';
		displayUnit = defaultUnit;
		emit('', displayUnit);
	}

	function unitLabel(u: Unit): string {
		switch (u) {
			case 'minutes':
				return m['duration.unit.minutes']();
			case 'hours':
				return m['duration.unit.hours']();
			case 'days':
				return m['duration.unit.days']();
			case 'weeks':
				return m['duration.unit.weeks']();
			case 'months':
				return m['duration.unit.months']();
			case 'years':
				return m['duration.unit.years']();
		}
	}
</script>

<div class={cn('space-y-2', className)}>
	<div class="flex items-center gap-2">
		<Label for={inputId}>
			{label}
			{#if required}<span class="text-destructive" aria-hidden="true">*</span>{/if}
		</Label>
		{#if hasChip}
			<button
				type="button"
				aria-pressed={isEmpty}
				onclick={handleChipClick}
				{disabled}
				class={cn(
					'rounded-full border px-2.5 py-0.5 text-xs transition-colors',
					isEmpty
						? 'border-primary bg-primary/10 text-primary'
						: 'border-border text-muted-foreground hover:border-primary hover:text-primary',
					disabled && 'cursor-not-allowed opacity-50'
				)}
			>
				{emptyLabel}
			</button>
		{/if}
	</div>

	<div class="flex gap-2">
		<Input
			id={inputId}
			type="number"
			class="w-28"
			value={amountField.value}
			oninput={amountField.oninput}
			onblur={amountField.onblur}
			min={String(min)}
			step="1"
			{disabled}
			{required}
			inputmode="numeric"
			aria-describedby={helpId}
		/>
		<Select
			type="single"
			value={displayUnit}
			onValueChange={handleUnitChange}
			disabled={disabled || isEmpty}
		>
			<SelectTrigger class="flex-1" aria-label="{label} unit">
				{unitLabel(displayUnit)}
			</SelectTrigger>
			<SelectContent>
				{#each allowedUnits as u (u)}
					<SelectItem value={u}>{unitLabel(u)}</SelectItem>
				{/each}
			</SelectContent>
		</Select>
	</div>

	{#if helpText}
		<p id={helpId} class="text-xs text-muted-foreground">{helpText}</p>
	{/if}
</div>
