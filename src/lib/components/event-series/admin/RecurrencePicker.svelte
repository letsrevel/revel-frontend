<script lang="ts">
	import * as m from '$lib/paraglide/messages.js';
	import { Input } from '$lib/components/ui/input';
	import { Label } from '$lib/components/ui/label';
	import { RadioGroup, RadioGroupItem } from '$lib/components/ui/radio-group';
	import { cn } from '$lib/utils/cn';
	import {
		FREQUENCIES,
		WEEKDAYS,
		WEEKDAY_ORDINALS,
		type RecurrenceRuleCreate,
		type Frequency,
		type MonthlyType,
		type BoundaryKind
	} from '$lib/types/recurrence';
	import { inferBoundaryKind } from '$lib/utils/recurrence';
	import { formatEventDate } from '$lib/utils/date';

	interface Props {
		rule: Partial<RecurrenceRuleCreate>;
		onChange: (next: Partial<RecurrenceRuleCreate>) => void;
		dtstartReadOnly?: boolean;
		validationErrors?: Record<string, string>;
	}

	const { rule, onChange, dtstartReadOnly = false, validationErrors = {} }: Props = $props();

	const frequency = $derived<Frequency>(rule.frequency ?? 'weekly');
	const interval = $derived(rule.interval ?? 1);
	const monthlyType = $derived<MonthlyType>(rule.monthly_type ?? 'day');
	const selectedWeekdays = $derived<Set<number>>(new Set(rule.weekdays ?? []));
	const boundaryKind = $derived<BoundaryKind>(
		inferBoundaryKind({ frequency, until: rule.until, count: rule.count })
	);

	function patch(next: Partial<RecurrenceRuleCreate>): void {
		onChange({ ...rule, ...next });
	}

	function selectFrequency(value: Frequency): void {
		if (value === frequency) return;
		onChange({
			...rule,
			frequency: value,
			weekdays: undefined,
			monthly_type: value === 'monthly' ? 'day' : undefined,
			day_of_month: undefined,
			nth_weekday: undefined,
			weekday: undefined
		});
	}

	function toggleWeekday(day: number): void {
		const next = new Set(selectedWeekdays);
		if (next.has(day)) {
			next.delete(day);
		} else {
			next.add(day);
		}
		patch({ weekdays: [...next].sort((a, b) => a - b) });
	}

	function handleIntervalInput(event: Event): void {
		const value = Number((event.target as HTMLInputElement).value);
		if (Number.isFinite(value) && value >= 1) {
			patch({ interval: Math.floor(value) });
		}
	}

	function handleDayOfMonthInput(event: Event): void {
		const raw = (event.target as HTMLInputElement).value;
		if (raw === '') {
			patch({ day_of_month: null });
			return;
		}
		const value = Number(raw);
		if (Number.isFinite(value)) {
			patch({ day_of_month: Math.max(1, Math.min(31, Math.floor(value))) });
		}
	}

	function handleMonthlyTypeChange(value: MonthlyType): void {
		if (value === monthlyType) return;
		patch({
			monthly_type: value,
			day_of_month: undefined,
			nth_weekday: undefined,
			weekday: undefined
		});
	}

	function handleNthWeekdayChange(event: Event): void {
		const raw = (event.target as HTMLSelectElement).value;
		patch({ nth_weekday: raw === '' ? null : Number(raw) });
	}

	function handleWeekdayChange(event: Event): void {
		const raw = (event.target as HTMLSelectElement).value;
		patch({ weekday: raw === '' ? null : Number(raw) });
	}

	function handleBoundaryChange(next: string): void {
		const kind = next as BoundaryKind;
		if (kind === boundaryKind) return;
		if (kind === 'none') {
			patch({ until: null, count: null });
		} else if (kind === 'until') {
			patch({ count: null });
		} else {
			patch({ until: null });
		}
	}

	function handleUntilInput(event: Event): void {
		const raw = (event.target as HTMLInputElement).value;
		patch({ until: raw ? new Date(raw).toISOString() : null });
	}

	function handleCountInput(event: Event): void {
		const raw = (event.target as HTMLInputElement).value;
		patch({ count: raw ? Math.max(1, Math.floor(Number(raw))) : null });
	}

	const untilForInput = $derived(rule.until ? toDatetimeLocalValue(rule.until) : '');

	function toDatetimeLocalValue(iso: string): string {
		const d = new Date(iso);
		if (Number.isNaN(d.getTime())) return '';
		const pad = (n: number) => n.toString().padStart(2, '0');
		return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(
			d.getHours()
		)}:${pad(d.getMinutes())}`;
	}

	function frequencyLabel(f: Frequency): string {
		switch (f) {
			case 'daily':
				return m['recurringEvents.picker.frequency.daily']();
			case 'weekly':
				return m['recurringEvents.picker.frequency.weekly']();
			case 'monthly':
				return m['recurringEvents.picker.frequency.monthly']();
			case 'yearly':
				return m['recurringEvents.picker.frequency.yearly']();
		}
	}

	function intervalSuffix(f: Frequency): string {
		switch (f) {
			case 'daily':
				return m['recurringEvents.picker.intervalSuffix.daily']();
			case 'weekly':
				return m['recurringEvents.picker.intervalSuffix.weekly']();
			case 'monthly':
				return m['recurringEvents.picker.intervalSuffix.monthly']();
			case 'yearly':
				return m['recurringEvents.picker.intervalSuffix.yearly']();
		}
	}

	function weekdayShortLabel(n: number): string {
		switch (n) {
			case 0:
				return m['recurringEvents.picker.weekdayShort.0']();
			case 1:
				return m['recurringEvents.picker.weekdayShort.1']();
			case 2:
				return m['recurringEvents.picker.weekdayShort.2']();
			case 3:
				return m['recurringEvents.picker.weekdayShort.3']();
			case 4:
				return m['recurringEvents.picker.weekdayShort.4']();
			case 5:
				return m['recurringEvents.picker.weekdayShort.5']();
			case 6:
				return m['recurringEvents.picker.weekdayShort.6']();
			default:
				return '';
		}
	}

	function weekdayLongLabel(n: number): string {
		switch (n) {
			case 0:
				return m['recurringEvents.picker.weekdayLong.0']();
			case 1:
				return m['recurringEvents.picker.weekdayLong.1']();
			case 2:
				return m['recurringEvents.picker.weekdayLong.2']();
			case 3:
				return m['recurringEvents.picker.weekdayLong.3']();
			case 4:
				return m['recurringEvents.picker.weekdayLong.4']();
			case 5:
				return m['recurringEvents.picker.weekdayLong.5']();
			case 6:
				return m['recurringEvents.picker.weekdayLong.6']();
			default:
				return '';
		}
	}

	function ordinalLabelI18n(n: number): string {
		switch (n) {
			case 1:
				return m['recurringEvents.picker.ordinal.1']();
			case 2:
				return m['recurringEvents.picker.ordinal.2']();
			case 3:
				return m['recurringEvents.picker.ordinal.3']();
			case 4:
				return m['recurringEvents.picker.ordinal.4']();
			case -1:
				return m['recurringEvents.picker.ordinal.last']();
			default:
				return '';
		}
	}
</script>

<div class="space-y-6">
	<!-- Frequency segmented control -->
	<div class="space-y-2">
		<span class="text-sm font-medium">{m['recurringEvents.picker.frequencyLabel']()}</span>
		<div
			role="radiogroup"
			aria-label={m['recurringEvents.picker.frequencyLabel']()}
			class="grid grid-cols-2 gap-2 sm:grid-cols-4"
		>
			{#each FREQUENCIES as freq (freq)}
				<button
					type="button"
					role="radio"
					aria-checked={frequency === freq}
					onclick={() => selectFrequency(freq)}
					class={cn(
						'rounded-md border px-3 py-2 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
						frequency === freq
							? 'border-primary bg-primary text-primary-foreground'
							: 'border-input bg-background text-foreground hover:bg-accent'
					)}
				>
					{frequencyLabel(freq)}
				</button>
			{/each}
		</div>
	</div>

	<!-- Interval -->
	<div class="space-y-2">
		<Label for="recurrence-interval">{m['recurringEvents.picker.intervalLabel']()}</Label>
		<div class="flex items-center gap-2">
			<Input
				id="recurrence-interval"
				type="number"
				min={1}
				value={interval}
				oninput={handleIntervalInput}
				class="w-24"
				aria-describedby={validationErrors.interval ? 'recurrence-interval-error' : undefined}
			/>
			<span class="text-sm text-muted-foreground">{intervalSuffix(frequency)}</span>
		</div>
		{#if validationErrors.interval}
			<p id="recurrence-interval-error" class="text-sm text-destructive">
				{validationErrors.interval}
			</p>
		{/if}
	</div>

	<!-- Weekly: weekday multiselect -->
	{#if frequency === 'weekly'}
		<fieldset class="space-y-2">
			<legend class="text-sm font-medium">
				{m['recurringEvents.picker.weekdayGroupLabel']()}
			</legend>
			<div
				role="group"
				aria-label={m['recurringEvents.picker.frequency.weekly']()}
				class="grid grid-cols-4 gap-2 sm:grid-cols-7"
			>
				{#each WEEKDAYS as day (day)}
					{@const selected = selectedWeekdays.has(day)}
					<button
						type="button"
						aria-pressed={selected}
						aria-label={weekdayLongLabel(day)}
						onclick={() => toggleWeekday(day)}
						class={cn(
							'rounded-md border px-2 py-2 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
							selected
								? 'border-primary bg-primary text-primary-foreground'
								: 'border-input bg-background text-foreground hover:bg-accent'
						)}
					>
						{weekdayShortLabel(day)}
					</button>
				{/each}
			</div>
			{#if validationErrors.weekdays}
				<p class="text-sm text-destructive">{validationErrors.weekdays}</p>
			{/if}
		</fieldset>
	{/if}

	<!-- Monthly: day vs. weekday -->
	{#if frequency === 'monthly'}
		<div class="space-y-4">
			<div
				role="radiogroup"
				aria-label={m['recurringEvents.picker.monthlyType.day']()}
				class="flex flex-col gap-2 sm:flex-row"
			>
				<button
					type="button"
					role="radio"
					aria-checked={monthlyType === 'day'}
					onclick={() => handleMonthlyTypeChange('day')}
					class={cn(
						'rounded-md border px-3 py-2 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
						monthlyType === 'day'
							? 'border-primary bg-primary text-primary-foreground'
							: 'border-input bg-background text-foreground hover:bg-accent'
					)}
				>
					{m['recurringEvents.picker.monthlyType.day']()}
				</button>
				<button
					type="button"
					role="radio"
					aria-checked={monthlyType === 'weekday'}
					onclick={() => handleMonthlyTypeChange('weekday')}
					class={cn(
						'rounded-md border px-3 py-2 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
						monthlyType === 'weekday'
							? 'border-primary bg-primary text-primary-foreground'
							: 'border-input bg-background text-foreground hover:bg-accent'
					)}
				>
					{m['recurringEvents.picker.monthlyType.weekday']()}
				</button>
			</div>

			{#if monthlyType === 'day'}
				<div class="space-y-2">
					<Label for="recurrence-dom">{m['recurringEvents.picker.dayOfMonthLabel']()}</Label>
					<Input
						id="recurrence-dom"
						type="number"
						min={1}
						max={31}
						value={rule.day_of_month ?? ''}
						oninput={handleDayOfMonthInput}
						class="w-24"
						aria-describedby={validationErrors.day_of_month ? 'recurrence-dom-error' : undefined}
					/>
					{#if validationErrors.day_of_month}
						<p id="recurrence-dom-error" class="text-sm text-destructive">
							{validationErrors.day_of_month}
						</p>
					{/if}
				</div>
			{:else}
				<div class="grid gap-3 sm:grid-cols-2">
					<div class="space-y-2">
						<Label for="recurrence-nth">
							{m['recurringEvents.picker.ordinalLabel']()}
						</Label>
						<select
							id="recurrence-nth"
							value={rule.nth_weekday ?? ''}
							onchange={handleNthWeekdayChange}
							class="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
						>
							<option value="">—</option>
							{#each WEEKDAY_ORDINALS as o (o)}
								<option value={o}>{ordinalLabelI18n(o)}</option>
							{/each}
						</select>
					</div>
					<div class="space-y-2">
						<Label for="recurrence-weekday">
							{m['recurringEvents.picker.weekdayLabel']()}
						</Label>
						<select
							id="recurrence-weekday"
							value={rule.weekday ?? ''}
							onchange={handleWeekdayChange}
							class="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
						>
							<option value="">—</option>
							{#each WEEKDAYS as day (day)}
								<option value={day}>{weekdayLongLabel(day)}</option>
							{/each}
						</select>
					</div>
				</div>
				{#if validationErrors.nth_weekday || validationErrors.weekday}
					<p class="text-sm text-destructive">
						{validationErrors.nth_weekday ?? validationErrors.weekday}
					</p>
				{/if}
			{/if}
		</div>
	{/if}

	<!-- Boundary: none / until / count -->
	<fieldset class="space-y-3">
		<legend class="text-sm font-medium">{m['recurringEvents.picker.boundary.label']()}</legend>
		<RadioGroup value={boundaryKind} onValueChange={handleBoundaryChange} class="space-y-2">
			<div class="flex items-center gap-2">
				<RadioGroupItem value="none" id="boundary-none" />
				<Label for="boundary-none">{m['recurringEvents.picker.boundary.none']()}</Label>
			</div>
			<div class="flex flex-col gap-2 sm:flex-row sm:items-center">
				<div class="flex items-center gap-2">
					<RadioGroupItem value="until" id="boundary-until" />
					<Label for="boundary-until">{m['recurringEvents.picker.boundary.until']()}</Label>
				</div>
				{#if boundaryKind === 'until'}
					<Input
						type="datetime-local"
						value={untilForInput}
						oninput={handleUntilInput}
						class="sm:w-72"
						aria-label={m['recurringEvents.picker.untilLabel']()}
					/>
				{/if}
			</div>
			<div class="flex flex-col gap-2 sm:flex-row sm:items-center">
				<div class="flex items-center gap-2">
					<RadioGroupItem value="count" id="boundary-count" />
					<Label for="boundary-count">{m['recurringEvents.picker.boundary.count']()}</Label>
				</div>
				{#if boundaryKind === 'count'}
					<Input
						type="number"
						min={1}
						value={rule.count ?? ''}
						oninput={handleCountInput}
						class="sm:w-32"
						aria-label={m['recurringEvents.picker.countLabel']()}
					/>
				{/if}
			</div>
		</RadioGroup>
		{#if validationErrors.boundary}
			<p class="text-sm text-destructive">{validationErrors.boundary}</p>
		{/if}
		{#if validationErrors.until}
			<p class="text-sm text-destructive">{validationErrors.until}</p>
		{/if}
		{#if validationErrors.count}
			<p class="text-sm text-destructive">{validationErrors.count}</p>
		{/if}
	</fieldset>

	<!-- dtstart read-only notice (edit mode) -->
	{#if dtstartReadOnly && rule.dtstart}
		<div
			class="space-y-1 rounded-md border border-border bg-muted/50 p-3 text-sm text-muted-foreground"
			data-testid="recurrence-picker-anchor-readonly"
		>
			<div class="text-foreground">
				<strong>{m['recurringEvents.recurrenceDialog.anchorLabel']()}:</strong>
				<span data-testid="recurrence-picker-anchor-value">{formatEventDate(rule.dtstart)}</span>
			</div>
			<p>{m['recurringEvents.recurrenceDialog.dtstartReadOnlyHelper']()}</p>
		</div>
	{/if}
</div>
