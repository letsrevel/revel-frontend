<script lang="ts">
	import * as m from '$lib/paraglide/messages.js';
	import type { RefundPolicy, RefundPolicyTier } from '$lib/api/generated/types.gen';
	import { Label } from '$lib/components/ui/label';
	import { Input } from '$lib/components/ui/input';
	import { Button } from '$lib/components/ui/button';
	import { Trash2, Plus, Undo2, Receipt } from 'lucide-svelte';

	interface Props {
		/** Optional initial policy (when editing). null = no brackets yet. */
		value: RefundPolicy | null | undefined;
		disabled?: boolean;
		currencySymbol?: string;
		/** Emits the current draft policy on every change. Even invalid drafts emit so
		 *  the parent stays in sync; parent gates on `onValidityChange` for save. */
		onChange: (next: RefundPolicy | null) => void;
		/** Emits whenever client-side validation flips. Empty (no brackets) counts as valid
		 *  — backend defaults to 100% in that case. */
		onValidityChange?: (valid: boolean) => void;
	}

	const {
		value,
		disabled = false,
		currencySymbol = '',
		onChange,
		onValidityChange
	}: Props = $props();

	// Internal editable form state. Keep numbers as strings so we don't fight
	// HTML number inputs and so empty fields are well-defined.
	type BracketDraft = {
		hoursBeforeEvent: string;
		refundPercentage: string;
	};

	function bracketsFrom(p: RefundPolicy | null | undefined): BracketDraft[] {
		if (!p?.tiers || p.tiers.length === 0) return [];
		return p.tiers.map((t) => ({
			hoursBeforeEvent: String(t.hours_before_event ?? 0),
			refundPercentage: String(t.refund_percentage ?? 0)
		}));
	}

	let brackets = $state<BracketDraft[]>(bracketsFrom(value));
	let flatFee = $state<string>(value?.flat_fee !== undefined ? String(value.flat_fee) : '');

	function normalizeDecimalInput(v: string): string {
		let normalized = v.replace(/,/g, '.');
		normalized = normalized.replace(/[^\d.]/g, '');
		const firstDot = normalized.indexOf('.');
		if (firstDot !== -1) {
			normalized =
				normalized.slice(0, firstDot + 1) + normalized.slice(firstDot + 1).replace(/\./g, '');
		}
		return normalized;
	}

	/**
	 * Pick a strictly-smaller default for the new bracket's hours_before_event.
	 * Backend rule: tiers must be sorted by strictly-descending hours, so the new
	 * bracket needs hours < last.hours. We can't add anything below 0.
	 */
	function nextBracketDefaults(last: BracketDraft | undefined): BracketDraft | null {
		if (!last) {
			// Starting fresh: 24h refund window with full refund is a sensible seed.
			return { hoursBeforeEvent: '24', refundPercentage: '100' };
		}
		const lastHours = Number(last.hoursBeforeEvent);
		if (!Number.isFinite(lastHours) || lastHours <= 0) {
			// No room below — caller should disable the button before reaching here.
			return null;
		}
		const lastPct = Number(last.refundPercentage);
		const halfHours = Math.floor(lastHours / 2);
		// Halving floors to 0 once lastHours is 1; clamp to lastHours-1 so the rule holds.
		const nextHours = Math.max(0, halfHours < lastHours ? halfHours : lastHours - 1);
		const nextPct = Math.max(0, Math.floor((Number.isFinite(lastPct) ? lastPct : 0) / 2));
		return {
			hoursBeforeEvent: String(nextHours),
			refundPercentage: String(nextPct)
		};
	}

	const canAddBracket = $derived.by(() => {
		if (brackets.length === 0) return true;
		return nextBracketDefaults(brackets[brackets.length - 1]) !== null;
	});

	function addBracket(): void {
		if (disabled) return;
		const next = nextBracketDefaults(brackets[brackets.length - 1]);
		if (!next) return;
		brackets = [...brackets, next];
		emit();
	}

	function removeBracket(index: number): void {
		if (disabled) return;
		brackets = brackets.filter((_, i) => i !== index);
		emit();
	}

	function applyDefaultPolicy(): void {
		if (disabled) return;
		brackets = [{ hoursBeforeEvent: '0', refundPercentage: '100' }];
		flatFee = '';
		emit();
	}

	function emit(): void {
		if (brackets.length === 0) {
			onChange(null);
			return;
		}
		const tiers: RefundPolicyTier[] = brackets.map((b) => ({
			hours_before_event: parseInt(b.hoursBeforeEvent || '0', 10) || 0,
			// Backend now expects refund_percentage as a string (Decimal-coerced).
			refund_percentage: b.refundPercentage === '' ? '0' : b.refundPercentage
		}));
		const fee = flatFee.trim();
		const policy: RefundPolicy = {
			tiers,
			...(fee ? { flat_fee: fee } : {})
		};
		onChange(policy);
	}

	function updateBracket<K extends keyof BracketDraft>(index: number, field: K, raw: string): void {
		const next = [...brackets];
		next[index] = { ...next[index], [field]: raw } as BracketDraft;
		brackets = next;
		emit();
	}

	// ---- Validation -----------------------------------------------------------
	const validationErrors = $derived.by((): string[] => {
		const errors: string[] = [];
		if (brackets.length === 0) return errors;
		let prevHours = Infinity;
		let prevPct = Infinity;
		for (const b of brackets) {
			const hours = Number(b.hoursBeforeEvent);
			const pct = Number(b.refundPercentage);
			if (!Number.isFinite(hours) || hours < 0) {
				errors.push(m['refundPolicy.validation.hoursMin']());
				break;
			}
			if (!Number.isFinite(pct) || pct < 0 || pct > 100) {
				errors.push(m['refundPolicy.validation.percentageRange']());
				break;
			}
			if (hours >= prevHours) {
				errors.push(m['refundPolicy.validation.hoursMustDecrease']());
				break;
			}
			if (pct > prevPct) {
				errors.push(m['refundPolicy.validation.percentageMustNotIncrease']());
				break;
			}
			prevHours = hours;
			prevPct = pct;
		}
		return errors;
	});

	// Mirror validity to the parent so it can disable Save while the policy is
	// invalid — submitting an invalid policy yields a 400 with no clear UI.
	$effect(() => {
		onValidityChange?.(validationErrors.length === 0);
	});
</script>

<div class="space-y-4">
	<!-- Header & explanation -->
	<div class="flex items-start gap-2 text-sm">
		<Receipt class="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
		<div class="space-y-1">
			<p class="font-medium">{m['refundPolicy.bracketsTitle']()}</p>
			<p class="text-xs text-muted-foreground">{m['refundPolicy.bracketsHelp']()}</p>
		</div>
	</div>

	{#if brackets.length === 0}
		<div
			class="rounded-md border border-dashed border-border bg-muted/30 p-3 text-sm text-muted-foreground"
		>
			<p>{m['refundPolicy.defaultPolicyHint']()}</p>
			<div class="mt-2 flex flex-wrap gap-2">
				<Button type="button" variant="secondary" size="sm" onclick={applyDefaultPolicy} {disabled}>
					<Undo2 class="mr-1 h-3.5 w-3.5" aria-hidden="true" />
					100% until event start
				</Button>
				<Button type="button" variant="outline" size="sm" onclick={addBracket} {disabled}>
					<Plus class="mr-1 h-3.5 w-3.5" aria-hidden="true" />
					{m['refundPolicy.addBracket']()}
				</Button>
			</div>
		</div>
	{:else}
		<div class="space-y-2">
			{#each brackets as bracket, i (i)}
				<div
					class="grid grid-cols-[1fr_1fr_auto] items-end gap-2 rounded-md border border-border bg-background p-3"
				>
					<div>
						<Label for={`refund-hours-${i}`} class="text-xs">
							{m['refundPolicy.bracketHoursLabel']()}
						</Label>
						<Input
							id={`refund-hours-${i}`}
							type="number"
							min="0"
							step="1"
							value={bracket.hoursBeforeEvent}
							oninput={(e) =>
								updateBracket(
									i,
									'hoursBeforeEvent',
									(e.currentTarget as HTMLInputElement).value.replace(/[^\d]/g, '')
								)}
							{disabled}
						/>
					</div>
					<div>
						<Label for={`refund-pct-${i}`} class="text-xs">
							{m['refundPolicy.bracketPercentageLabel']()}
						</Label>
						<div class="relative">
							<Input
								id={`refund-pct-${i}`}
								type="text"
								inputmode="decimal"
								value={bracket.refundPercentage}
								oninput={(e) =>
									updateBracket(
										i,
										'refundPercentage',
										normalizeDecimalInput((e.currentTarget as HTMLInputElement).value)
									)}
								{disabled}
								class="pr-8"
							/>
							<span
								class="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground"
							>
								%
							</span>
						</div>
					</div>
					<Button
						type="button"
						variant="ghost"
						size="icon"
						aria-label={m['refundPolicy.removeBracket']()}
						onclick={() => removeBracket(i)}
						{disabled}
					>
						<Trash2 class="h-4 w-4 text-destructive" aria-hidden="true" />
					</Button>
				</div>
			{/each}
		</div>

		<Button
			type="button"
			variant="outline"
			size="sm"
			onclick={addBracket}
			disabled={disabled || !canAddBracket}
			title={!canAddBracket
				? 'Last bracket already covers up to 0 hours before the event — remove or edit it first.'
				: undefined}
		>
			<Plus class="mr-1 h-3.5 w-3.5" aria-hidden="true" />
			{m['refundPolicy.addBracket']()}
		</Button>

		<!-- Flat fee -->
		<div>
			<Label for="refund-flat-fee">{m['refundPolicy.flatFeeLabel']()}</Label>
			<div class="relative">
				{#if currencySymbol}
					<span
						class="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground"
					>
						{currencySymbol}
					</span>
				{/if}
				<Input
					id="refund-flat-fee"
					type="text"
					inputmode="decimal"
					value={flatFee}
					oninput={(e) => {
						flatFee = normalizeDecimalInput((e.currentTarget as HTMLInputElement).value);
						emit();
					}}
					placeholder={m['refundPolicy.flatFeePlaceholder']()}
					{disabled}
					class={currencySymbol ? 'pl-9' : ''}
				/>
			</div>
			<p class="mt-1 text-xs text-muted-foreground">{m['refundPolicy.flatFeeHelp']()}</p>
		</div>

		<!-- Live summary -->
		<ul
			class="space-y-1 rounded-md border border-border bg-muted/30 p-3 text-xs text-muted-foreground"
		>
			{#each brackets as b, i (i)}
				<li class="tabular-nums">
					{m['refundPolicy.bracketSummary']({
						hours: b.hoursBeforeEvent || '0',
						pct: b.refundPercentage || '0'
					})}
				</li>
			{/each}
		</ul>

		<!-- Validation errors -->
		{#if validationErrors.length > 0}
			<ul
				class="space-y-1 rounded-md border border-destructive/40 bg-destructive/5 p-2 text-xs text-destructive"
			>
				{#each validationErrors as err}
					<li>{err}</li>
				{/each}
			</ul>
		{/if}
	{/if}
</div>
