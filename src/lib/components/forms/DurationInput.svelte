<script lang="ts">
	import * as m from '$lib/paraglide/messages.js';
	import { Input } from '$lib/components/ui/input';
	import { Label } from '$lib/components/ui/label';
	import { Select, SelectContent, SelectItem, SelectTrigger } from '$lib/components/ui/select';
	import { cn } from '$lib/utils/cn';
	import {
		ALLOWED_UNITS,
		fromStorage,
		toStorage,
		type StorageUnit,
		type Unit
	} from '$lib/utils/duration';

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

	$effect(() => {
		// Read defaultUnit into a local const so Svelte tracks it as a reactive dependency.
		const unit = defaultUnit;
		if (isEmpty || value === null) {
			displayAmount = '';
			displayUnit = unit;
			return;
		}
		const current =
			displayAmount === '' ? null : toStorage(Number(displayAmount), displayUnit, storageUnit);
		if (current !== value) {
			const next = fromStorage(value, storageUnit);
			displayAmount = next.amount;
			displayUnit = next.unit;
		}
	});

	function emit(amount: number | '', unit: Unit): void {
		if (amount === '' || Number.isNaN(Number(amount))) {
			value = (emptyValue ?? null) as typeof value;
			return;
		}
		value = toStorage(Number(amount), unit, storageUnit);
	}

	function handleAmountInput(e: Event): void {
		const raw = (e.currentTarget as HTMLInputElement).value;
		if (raw === '') {
			displayAmount = '';
			emit('', displayUnit);
			return;
		}
		const n = Number(raw);
		if (!Number.isFinite(n)) {
			displayAmount = '';
			emit('', displayUnit);
			return;
		}
		if (n < min) {
			displayAmount = min;
			emit(min, displayUnit);
			return;
		}
		displayAmount = n;
		emit(displayAmount, displayUnit);
	}

	function handleUnitChange(next: string | undefined): void {
		if (!next) return;
		displayUnit = next as Unit;
		emit(displayAmount, displayUnit);
	}

	function handleChipClick(): void {
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
			value={displayAmount}
			oninput={handleAmountInput}
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
