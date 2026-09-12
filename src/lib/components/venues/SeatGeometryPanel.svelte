<script lang="ts">
	import * as m from '$lib/paraglide/messages.js';
	import { TriangleAlert, RotateCcw } from '@lucide/svelte';
	import {
		CURVE_MAX,
		CURVE_MIN,
		CURVE_STEP,
		ROW_SHIFT_LIMIT,
		STAGGER_MAX,
		STAGGER_MIN,
		defaultRowLayout,
		type RowLayoutRecipe,
		type RowOverride
	} from './row-layout';
	import { numericField } from '$lib/utils/numeric-input.svelte';

	export interface RowOption {
		rank: number;
		label: string;
	}

	interface Props {
		recipe: RowLayoutRecipe;
		rowOptions: RowOption[];
		unsupported: boolean;
		/**
		 * Seats carry custom positions but no saved recipe — the next save will
		 * rebuild them from these controls. Warning only; saving stays allowed.
		 */
		desynced?: boolean;
		/**
		 * Mirrors the editor's row inversion. Positive curve always displaces a
		 * row toward +y; the stage sits at y = 0 for a normal sector and at the
		 * max-y side for an inverted one, so the help text's "toward"/"away from
		 * the stage" flips with it.
		 */
		invertRowOrder?: boolean;
		/**
		 * Record an undo point BEFORE the write. A `coalesceKey` marks a
		 * continuous control (slider, typed number), whose whole burst of input
		 * events must undo in ONE step rather than one per event.
		 */
		onBeforeEdit?: (coalesceKey?: string) => void;
	}

	let {
		recipe = $bindable(),
		rowOptions,
		unsupported,
		desynced = false,
		invertRowOrder = false,
		onBeforeEdit
	}: Props = $props();

	let selectedRank = $state<number | null>(null);
	const staggerOn = $derived(recipe.stagger !== 0);
	const selectedOverride = $derived.by(() => {
		const rank = selectedRank;
		return rank === null
			? undefined
			: recipe.rowOverrides.find((override) => override.row === rank);
	});

	// Every write below reassigns `recipe` wholesale (rather than mutating a
	// nested field) so the component reacts correctly regardless of whether
	// the caller's own value is itself a deeply-reactive $state object —
	// reassigning the bindable prop is what actually notifies the binding.
	function updateRecipe(
		patch: Partial<Omit<RowLayoutRecipe, 'version' | 'kind'>>,
		coalesceKey?: string
	) {
		onBeforeEdit?.(coalesceKey);
		recipe = { ...recipe, ...patch };
	}

	function toggleStagger(checked: boolean) {
		updateRecipe({ stagger: checked ? 0.5 : 0 });
	}

	// An out-of-range typed value still never reaches `recipe` (WCAG 3.3.1:
	// prevention beats post-hoc error identification) — but it is now kept out by
	// NOT committing it, rather than by rewriting the field under the caret, and
	// blur clamps whatever is left into range (#924). `type="number"` reports an
	// empty value for a lone "-", so clamping per keystroke made a negative curve
	// or shift awkward to type: the minus sign was replaced before its digits.
	const curveField = numericField({
		value: () => recipe.curve,
		commit: (curve) => updateRecipe({ curve }, 'curve'),
		min: CURVE_MIN,
		max: CURVE_MAX,
		decimal: true
	});

	const staggerField = numericField({
		value: () => recipe.stagger,
		commit: (stagger) => updateRecipe({ stagger }, 'stagger'),
		min: STAGGER_MIN,
		max: STAGGER_MAX,
		decimal: true
	});

	// Per-row overrides are genuinely clearable: an empty field means "this row
	// doesn't override the recipe", which drops the entry entirely.
	const overrideCurveField = numericField<number | null>({
		value: () => selectedOverride?.curve ?? null,
		commit: (curve) => writeOverride({ curve: curve ?? undefined }),
		min: CURVE_MIN,
		max: CURVE_MAX,
		decimal: true,
		emptyValue: null
	});

	const overrideDxField = numericField<number | null>({
		value: () => selectedOverride?.dx ?? null,
		commit: (dx) => writeOverride({ dx: dx ?? undefined }),
		min: -ROW_SHIFT_LIMIT,
		max: ROW_SHIFT_LIMIT,
		decimal: true,
		emptyValue: null
	});

	const overrideDyField = numericField<number | null>({
		value: () => selectedOverride?.dy ?? null,
		commit: (dy) => writeOverride({ dy: dy ?? undefined }),
		min: -ROW_SHIFT_LIMIT,
		max: ROW_SHIFT_LIMIT,
		decimal: true,
		emptyValue: null
	});

	function writeOverride(patch: Partial<Omit<RowOverride, 'row'>>) {
		if (selectedRank === null) return;
		const rest = recipe.rowOverrides.filter((override) => override.row !== selectedRank);
		const merged: RowOverride = { row: selectedRank, ...selectedOverride, ...patch };
		const hasContent =
			merged.curve !== undefined ||
			merged.stagger !== undefined ||
			merged.dx !== undefined ||
			merged.dy !== undefined;
		updateRecipe({ rowOverrides: hasContent ? [...rest, merged] : rest }, 'row-override');
	}

	function clearOverride() {
		if (selectedRank === null) return;
		updateRecipe({
			rowOverrides: recipe.rowOverrides.filter((override) => override.row !== selectedRank)
		});
	}

	function resetAll() {
		onBeforeEdit?.();
		recipe = defaultRowLayout();
		selectedRank = null;
	}

	function onRowSelectChange(raw: string) {
		selectedRank = raw === '' ? null : Number(raw);
	}
</script>

<div class="rounded-lg border bg-card p-4">
	<h3 class="mb-4 font-semibold">{m['seatGridEditor.geometry.title']()}</h3>

	{#if unsupported}
		<div
			role="alert"
			class="mb-3 flex items-start gap-1.5 text-xs text-highlight-foreground dark:text-highlight"
		>
			<TriangleAlert class="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
			{m['seatGridEditor.geometry.unsupportedRecipe']()}
		</div>
	{/if}

	{#if desynced}
		<div
			role="alert"
			class="mb-3 flex items-start gap-1.5 text-xs text-highlight-foreground dark:text-highlight"
		>
			<TriangleAlert class="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
			{m['seatGridEditor.geometry.desyncedRecipe']()}
		</div>
	{/if}

	<p class="mb-4 text-xs text-muted-foreground">
		{m['seatGridEditor.geometry.explainer']()}
	</p>

	<div class="flex flex-wrap gap-4">
		<!-- Curve -->
		<div class="w-full">
			<label for="geo-curve" class="mb-1.5 block text-sm font-medium">
				{m['seatGridEditor.geometry.curveLabel']()}
			</label>
			<div class="flex items-center gap-3">
				<input
					id="geo-curve"
					type="range"
					min={CURVE_MIN}
					max={CURVE_MAX}
					step={CURVE_STEP}
					value={recipe.curve}
					aria-describedby="geo-curve-help"
					oninput={(e) => updateRecipe({ curve: Number(e.currentTarget.value) }, 'curve')}
					class="w-full max-w-xs"
				/>
				<span aria-hidden="true" class="w-10 text-sm tabular-nums">{recipe.curve}</span>
				<label for="geo-curve-exact" class="sr-only">
					{m['seatGridEditor.geometry.curveExactLabel']()}
				</label>
				<input
					id="geo-curve-exact"
					type="number"
					min={CURVE_MIN}
					max={CURVE_MAX}
					step={CURVE_STEP}
					value={curveField.value}
					aria-describedby="geo-curve-help"
					oninput={curveField.oninput}
					onblur={curveField.onblur}
					class="w-20 rounded-md border border-input bg-background px-3 py-2 text-sm"
				/>
			</div>
			<p id="geo-curve-help" class="mt-1 text-xs text-muted-foreground">
				{invertRowOrder
					? m['seatGridEditor.geometry.curveHelpInverted']()
					: m['seatGridEditor.geometry.curveHelp']()}
			</p>
		</div>

		<!-- Stagger -->
		<div>
			<div class="flex items-center gap-2">
				<input
					id="geo-stagger"
					type="checkbox"
					checked={staggerOn}
					onchange={(e) => toggleStagger(e.currentTarget.checked)}
					class="h-4 w-4 rounded border-input focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
				/>
				<label for="geo-stagger" class="text-sm font-medium">
					{m['seatGridEditor.geometry.staggerLabel']()}
				</label>
			</div>
			{#if staggerOn}
				<div class="mt-1.5">
					<label for="geo-stagger-amount" class="mb-1.5 block text-sm font-medium">
						{m['seatGridEditor.geometry.staggerAmountLabel']()}
					</label>
					<input
						id="geo-stagger-amount"
						type="number"
						min={STAGGER_MIN}
						max={STAGGER_MAX}
						step="0.1"
						value={staggerField.value}
						oninput={staggerField.oninput}
						onblur={staggerField.onblur}
						class="w-24 rounded-md border border-input bg-background px-3 py-2 text-sm"
					/>
				</div>
			{/if}
		</div>

		<!-- Align -->
		<div>
			<label for="geo-align" class="mb-1.5 block text-sm font-medium">
				{m['seatGridEditor.geometry.alignLabel']()}
			</label>
			<select
				id="geo-align"
				value={recipe.align}
				onchange={(e) => updateRecipe({ align: e.currentTarget.value as RowLayoutRecipe['align'] })}
				class="rounded-md border border-input bg-background px-3 py-2 text-sm"
			>
				<option value="left">{m['seatGridEditor.geometry.alignLeft']()}</option>
				<option value="center">{m['seatGridEditor.geometry.alignCenter']()}</option>
				<option value="right">{m['seatGridEditor.geometry.alignRight']()}</option>
			</select>
		</div>
	</div>

	<!-- Per-row overrides -->
	<div class="mt-4 border-t pt-4">
		<h4 class="mb-2 text-sm font-semibold">
			{m['seatGridEditor.geometry.rowOverridesTitle']()}
		</h4>
		<div class="flex flex-wrap items-end gap-4">
			<div>
				<label for="geo-row" class="mb-1.5 block text-sm font-medium">
					{m['seatGridEditor.geometry.rowSelectLabel']()}
				</label>
				<select
					id="geo-row"
					value={selectedRank === null ? '' : String(selectedRank)}
					onchange={(e) => onRowSelectChange(e.currentTarget.value)}
					class="rounded-md border border-input bg-background px-3 py-2 text-sm"
				>
					<option value="">{m['seatGridEditor.geometry.rowSelectPlaceholder']()}</option>
					{#each rowOptions as option (option.rank)}
						<option value={String(option.rank)}>{option.label}</option>
					{/each}
				</select>
			</div>

			{#if selectedRank !== null}
				<div>
					<label for="geo-row-curve" class="mb-1.5 block text-sm font-medium">
						{m['seatGridEditor.geometry.overrideCurveLabel']()}
					</label>
					<input
						id="geo-row-curve"
						type="number"
						min={CURVE_MIN}
						max={CURVE_MAX}
						step={CURVE_STEP}
						value={overrideCurveField.value}
						oninput={overrideCurveField.oninput}
						onblur={overrideCurveField.onblur}
						class="w-24 rounded-md border border-input bg-background px-3 py-2 text-sm"
					/>
				</div>
				<div>
					<label for="geo-row-dx" class="mb-1.5 block text-sm font-medium">
						{m['seatGridEditor.geometry.overrideDxLabel']()}
					</label>
					<input
						id="geo-row-dx"
						type="number"
						step="0.1"
						value={overrideDxField.value}
						oninput={overrideDxField.oninput}
						onblur={overrideDxField.onblur}
						class="w-24 rounded-md border border-input bg-background px-3 py-2 text-sm"
					/>
				</div>
				<div>
					<label for="geo-row-dy" class="mb-1.5 block text-sm font-medium">
						{m['seatGridEditor.geometry.overrideDyLabel']()}
					</label>
					<input
						id="geo-row-dy"
						type="number"
						step="0.1"
						value={overrideDyField.value}
						oninput={overrideDyField.oninput}
						onblur={overrideDyField.onblur}
						class="w-24 rounded-md border border-input bg-background px-3 py-2 text-sm"
					/>
				</div>
				<button
					type="button"
					onclick={clearOverride}
					class="rounded-md border border-input px-4 py-2 text-sm font-medium hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
				>
					{m['seatGridEditor.geometry.clearOverride']()}
				</button>
			{/if}
		</div>
	</div>

	<div class="mt-4 border-t pt-4">
		<button
			type="button"
			onclick={resetAll}
			class="inline-flex items-center gap-1.5 rounded-md border border-input px-4 py-2 text-sm font-medium hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
		>
			<RotateCcw class="h-3.5 w-3.5" aria-hidden="true" />
			{m['seatGridEditor.geometry.resetAll']()}
		</button>
	</div>
</div>
