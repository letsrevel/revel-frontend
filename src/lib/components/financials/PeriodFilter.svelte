<script lang="ts">
	import * as m from '$lib/paraglide/messages.js';
	import type { PeriodValue } from './period';

	interface Props {
		value: PeriodValue;
		onChange: (value: PeriodValue) => void;
	}

	const { value, onChange }: Props = $props();

	// Year options: current year back to five years prior. The catalog supplies a
	// neutral numeric label, so no translation is required per year.
	const currentYear = new Date().getFullYear();
	const years = $derived(Array.from({ length: 6 }, (_, i) => currentYear - i));

	// A single "period within year" control encodes the month/quarter choice so the
	// two can never be set at once (the backend rejects month+quarter with a 422).
	const periodKey = $derived(
		value.quarter ? `q${value.quarter}` : value.month ? `m${value.month}` : 'all'
	);

	const monthLabels = $derived([
		m['financials.period.month1'](),
		m['financials.period.month2'](),
		m['financials.period.month3'](),
		m['financials.period.month4'](),
		m['financials.period.month5'](),
		m['financials.period.month6'](),
		m['financials.period.month7'](),
		m['financials.period.month8'](),
		m['financials.period.month9'](),
		m['financials.period.month10'](),
		m['financials.period.month11'](),
		m['financials.period.month12']()
	]);

	function handleYear(event: Event) {
		const year = Number((event.currentTarget as HTMLSelectElement).value);
		onChange({ ...value, year });
	}

	function handlePeriod(event: Event) {
		const key = (event.currentTarget as HTMLSelectElement).value;
		if (key === 'all') {
			onChange({ year: value.year, month: null, quarter: null });
		} else if (key.startsWith('q')) {
			onChange({ year: value.year, month: null, quarter: Number(key.slice(1)) });
		} else {
			onChange({ year: value.year, month: Number(key.slice(1)), quarter: null });
		}
	}
</script>

<div class="flex flex-wrap items-end gap-3">
	<div class="flex flex-col gap-1">
		<label for="financials-year" class="text-xs font-medium text-muted-foreground">
			{m['financials.period.year']()}
		</label>
		<select
			id="financials-year"
			value={value.year}
			onchange={handleYear}
			class="h-9 rounded-md border border-input bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
		>
			{#each years as year (year)}
				<option value={year}>{year}</option>
			{/each}
		</select>
	</div>

	<div class="flex flex-col gap-1">
		<label for="financials-period" class="text-xs font-medium text-muted-foreground">
			{m['financials.period.period']()}
		</label>
		<select
			id="financials-period"
			value={periodKey}
			onchange={handlePeriod}
			class="h-9 rounded-md border border-input bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
		>
			<option value="all">{m['financials.period.fullYear']()}</option>
			<optgroup label={m['financials.period.quarters']()}>
				<option value="q1">{m['financials.period.q1']()}</option>
				<option value="q2">{m['financials.period.q2']()}</option>
				<option value="q3">{m['financials.period.q3']()}</option>
				<option value="q4">{m['financials.period.q4']()}</option>
			</optgroup>
			<optgroup label={m['financials.period.months']()}>
				{#each monthLabels as label, i (i)}
					<option value={`m${i + 1}`}>{label}</option>
				{/each}
			</optgroup>
		</select>
	</div>
</div>
